"use server";

import { SUPPORTED_LOCALES } from "@prawko/config";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logServerError } from "../../lib/server-error-logging";
import { getWebServerEnv } from "../../lib/server-env";
import { getWebSupabaseAdminClient } from "../../lib/supabase-admin";

const schoolInquirySchema = z.object({
  city: z.string().trim().max(120).optional(),
  contactName: z.string().trim().min(2).max(120),
  currentSolution: z.string().trim().max(160).optional(),
  email: z.string().trim().email().max(160),
  estimatedStudents: z.union([
    z.literal(""),
    z.coerce.number().int().min(1).max(5000),
  ]),
  message: z.string().trim().min(10).max(2000),
  organizationName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40).optional(),
  sourcePage: z.string().trim().min(1).max(120),
  studentLocales: z.array(z.enum(SUPPORTED_LOCALES)).min(1),
  websiteUrl: z.string().trim().max(240).optional(),
});

export type SchoolInquiryActionState = {
  message: string;
  status: "error" | "idle" | "success";
};

export async function submitSchoolInquiryAction(
  _previousState: SchoolInquiryActionState,
  formData: FormData
): Promise<SchoolInquiryActionState> {
  if (String(formData.get("faxNumber") ?? "").trim()) {
    return {
      status: "success",
      message: "Thanks. The pilot request was received.",
    };
  }

  if (!canUseAdminDatabase()) {
    return {
      status: "error",
      message:
        "School inquiry storage is not configured yet. Use the support email for the pilot request.",
    };
  }

  const parsed = schoolInquirySchema.safeParse({
    city: String(formData.get("city") ?? ""),
    contactName: String(formData.get("contactName") ?? ""),
    currentSolution: String(formData.get("currentSolution") ?? ""),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    estimatedStudents: formData.get("estimatedStudents"),
    message: String(formData.get("message") ?? ""),
    organizationName: String(formData.get("organizationName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    sourcePage: String(formData.get("sourcePage") ?? "/schools"),
    studentLocales: formData.getAll("studentLocales"),
    websiteUrl: String(formData.get("websiteUrl") ?? ""),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message:
        "Check the school name, contact details, student languages, and short pilot note.",
    };
  }

  const estimatedStudents =
    parsed.data.estimatedStudents === "" ? null : parsed.data.estimatedStudents;

  try {
    const { error } = await getWebSupabaseAdminClient().from("school_inquiries").insert({
      city: emptyToNull(parsed.data.city),
      contact_name: parsed.data.contactName,
      current_solution: emptyToNull(parsed.data.currentSolution),
      email: parsed.data.email,
      estimated_students: estimatedStudents,
      message: parsed.data.message,
      metadata: {
        created_from: "web_school_form",
      },
      organization_name: parsed.data.organizationName,
      phone: emptyToNull(parsed.data.phone),
      source_page: parsed.data.sourcePage,
      student_locales: parsed.data.studentLocales,
      website_url: emptyToNull(parsed.data.websiteUrl),
    });

    if (error) {
      await logServerError({
        area: "school_inquiry",
        error,
        eventName: "school_inquiry_insert_failed",
        message: "Failed to persist a school inquiry from the public school page.",
        metadata: {
          estimated_students: estimatedStudents,
          organization_name: parsed.data.organizationName,
          source_page: parsed.data.sourcePage,
          student_locales: parsed.data.studentLocales,
        },
        authMode: "public",
      });

      return {
        status: "error",
        message:
          "The request could not be saved right now. Use support email if the pilot is urgent.",
      };
    }

    revalidatePath("/admin/school-inquiries");

    return {
      status: "success",
      message:
        "Pilot request sent. The next step is a concrete reply about cohort size, access window, and launch timing.",
    };
  } catch (error) {
    await logServerError({
      area: "school_inquiry",
      error,
      eventName: "school_inquiry_submit_failed",
      message: "The public school inquiry action crashed before saving the lead.",
      metadata: {
        source_page: parsed.data.sourcePage,
      },
      authMode: "public",
    });

    return {
      status: "error",
      message:
        "The request could not be sent right now. Use support email if you need a pilot reply today.",
    };
  }
}

function canUseAdminDatabase() {
  const env = getWebServerEnv();
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

function emptyToNull(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
