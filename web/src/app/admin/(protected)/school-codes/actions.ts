"use server";

import { APP_FEATURES, SUPPORTED_LOCALES } from "@prawko/config";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdminSession } from "../../../../lib/admin-auth";
import { logServerError } from "../../../../lib/server-error-logging";
import { getWebServerEnv } from "../../../../lib/server-env";
import { getWebSupabaseAdminClient } from "../../../../lib/supabase-admin";

const schoolFormSchema = z.object({
  city: z.string().trim().max(120).optional(),
  displayName: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  supportedLocales: z.array(z.enum(SUPPORTED_LOCALES)).min(1),
});

const schoolCodeFormSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(4)
      .max(32)
      .regex(/^[A-Z0-9-]+$/),
    grantedFeatures: z.array(z.enum(APP_FEATURES)).min(1),
    grantsDays: z.coerce.number().int().min(1).max(365),
    maxRedemptions: z.union([
      z.literal(""),
      z.coerce.number().int().min(1).max(10000),
    ]),
    schoolId: z.string().uuid(),
    validFrom: z.string().trim().optional(),
    validUntil: z.string().trim().optional(),
  })
  .superRefine((value, context) => {
    if (value.validFrom && value.validUntil && value.validUntil < value.validFrom) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validUntil must be after validFrom",
        path: ["validUntil"],
      });
    }
  });

const schoolCodeStatusSchema = z.object({
  codeId: z.string().uuid(),
  nextStatus: z.enum(["active", "disabled"]),
});

export async function createSchoolAction(formData: FormData) {
  await requireAdminSession();

  if (!canUseAdminDatabase()) {
    redirect("/admin/school-codes?error=database_not_configured");
  }

  const parsed = schoolFormSchema.safeParse({
    city: String(formData.get("city") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
    slug: String(formData.get("slug") ?? "").trim().toLowerCase(),
    supportedLocales: formData.getAll("supportedLocales"),
  });

  if (!parsed.success) {
    redirect("/admin/school-codes?error=invalid_school_form");
  }

  const { error } = await getWebSupabaseAdminClient().from("schools").insert({
    city: emptyToNull(parsed.data.city),
    display_name: parsed.data.displayName,
    metadata: {
      created_from: "admin_web",
    },
    slug: parsed.data.slug,
    supported_locales: parsed.data.supportedLocales,
  });

  if (error) {
    await logServerError({
      area: "admin_school_codes",
      error,
      eventName: "create_school_failed",
      message: "Failed to create a school from the admin dashboard.",
      metadata: {
        city: emptyToNull(parsed.data.city),
        slug: parsed.data.slug,
        supported_locales: parsed.data.supportedLocales,
      },
    });
    redirect("/admin/school-codes?error=school_create_failed");
  }

  revalidateAdminPages();
  redirect("/admin/school-codes?notice=school_created");
}

export async function createSchoolCodeAction(formData: FormData) {
  await requireAdminSession();

  if (!canUseAdminDatabase()) {
    redirect("/admin/school-codes?error=database_not_configured");
  }

  const parsed = schoolCodeFormSchema.safeParse({
    code: String(formData.get("code") ?? "").trim().toUpperCase(),
    grantedFeatures: formData.getAll("grantedFeatures"),
    grantsDays: formData.get("grantsDays"),
    maxRedemptions: formData.get("maxRedemptions"),
    schoolId: String(formData.get("schoolId") ?? ""),
    validFrom: String(formData.get("validFrom") ?? "").trim(),
    validUntil: String(formData.get("validUntil") ?? "").trim(),
  });

  if (!parsed.success) {
    redirect("/admin/school-codes?error=invalid_code_form");
  }

  const { error } = await getWebSupabaseAdminClient().from("school_codes").insert({
    code: parsed.data.code,
    granted_features: parsed.data.grantedFeatures,
    grants_days: parsed.data.grantsDays,
    max_redemptions:
      parsed.data.maxRedemptions === "" ? null : parsed.data.maxRedemptions,
    metadata: {
      created_from: "admin_web",
    },
    school_id: parsed.data.schoolId,
    valid_from: dateInputToStartOfDayIso(parsed.data.validFrom),
    valid_until: dateInputToEndOfDayIso(parsed.data.validUntil),
  });

  if (error) {
    await logServerError({
      area: "admin_school_codes",
      error,
      eventName: "create_school_code_failed",
      message: "Failed to create a school code from the admin dashboard.",
      metadata: {
        code_length: parsed.data.code.length,
        granted_features: parsed.data.grantedFeatures,
        grants_days: parsed.data.grantsDays,
        max_redemptions:
          parsed.data.maxRedemptions === "" ? null : parsed.data.maxRedemptions,
        school_id: parsed.data.schoolId,
      },
    });
    redirect("/admin/school-codes?error=code_create_failed");
  }

  revalidateAdminPages();
  redirect("/admin/school-codes?notice=code_created");
}

export async function setSchoolCodeStatusAction(formData: FormData) {
  await requireAdminSession();

  if (!canUseAdminDatabase()) {
    redirect("/admin/school-codes?error=database_not_configured");
  }

  const parsed = schoolCodeStatusSchema.safeParse({
    codeId: String(formData.get("codeId") ?? ""),
    nextStatus: String(formData.get("nextStatus") ?? ""),
  });

  if (!parsed.success) {
    redirect("/admin/school-codes?error=invalid_status_form");
  }

  const { error } = await getWebSupabaseAdminClient()
    .from("school_codes")
    .update({
      status: parsed.data.nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.codeId);

  if (error) {
    await logServerError({
      area: "admin_school_codes",
      error,
      eventName: "set_school_code_status_failed",
      message: "Failed to update a school-code status from the admin dashboard.",
      metadata: {
        code_id: parsed.data.codeId,
        next_status: parsed.data.nextStatus,
      },
    });
    redirect("/admin/school-codes?error=code_status_failed");
  }

  revalidateAdminPages();
  redirect("/admin/school-codes?notice=code_status_updated");
}

function revalidateAdminPages() {
  revalidatePath("/admin");
  revalidatePath("/admin/school-codes");
}

function canUseAdminDatabase() {
  const env = getWebServerEnv();
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

function emptyToNull(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function dateInputToStartOfDayIso(value?: string) {
  return value ? `${value}T00:00:00.000Z` : null;
}

function dateInputToEndOfDayIso(value?: string) {
  return value ? `${value}T23:59:59.999Z` : null;
}
