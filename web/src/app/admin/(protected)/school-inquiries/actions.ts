"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdminSession } from "../../../../lib/admin-auth";
import { logServerError } from "../../../../lib/server-error-logging";
import { getWebServerEnv } from "../../../../lib/server-env";
import { getWebSupabaseAdminClient } from "../../../../lib/supabase-admin";

const schoolInquiryUpdateSchema = z.object({
  adminNotes: z.string().trim().max(2000).optional(),
  inquiryId: z.string().uuid(),
  nextStatus: z.enum(["new", "contacted", "qualified", "won", "lost", "spam"]),
});

export async function setSchoolInquiryStatusAction(formData: FormData) {
  const session = await requireAdminSession();

  if (!canUseAdminDatabase()) {
    redirect("/admin/school-inquiries?error=database_not_configured");
  }

  const parsed = schoolInquiryUpdateSchema.safeParse({
    adminNotes: String(formData.get("adminNotes") ?? ""),
    inquiryId: String(formData.get("inquiryId") ?? ""),
    nextStatus: String(formData.get("nextStatus") ?? ""),
  });

  if (!parsed.success) {
    redirect("/admin/school-inquiries?error=invalid_inquiry_form");
  }

  const { error } = await getWebSupabaseAdminClient()
    .from("school_inquiries")
    .update({
      admin_notes: emptyToNull(parsed.data.adminNotes),
      handled_at: new Date().toISOString(),
      handled_by_email: session.email,
      status: parsed.data.nextStatus,
    })
    .eq("id", parsed.data.inquiryId);

  if (error) {
    await logServerError({
      area: "admin_school_inquiries",
      error,
      eventName: "set_school_inquiry_status_failed",
      message: "Failed to update a school inquiry from the admin dashboard.",
      metadata: {
        inquiry_id: parsed.data.inquiryId,
        next_status: parsed.data.nextStatus,
      },
    });
    redirect("/admin/school-inquiries?error=inquiry_save_failed");
  }

  revalidateSchoolInquiryPages();
  redirect("/admin/school-inquiries?notice=inquiry_saved");
}

function revalidateSchoolInquiryPages() {
  revalidatePath("/admin/school-inquiries");
}

function canUseAdminDatabase() {
  const env = getWebServerEnv();
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

function emptyToNull(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
