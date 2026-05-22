"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdminSession } from "../../../../lib/admin-auth";
import { logServerError } from "../../../../lib/server-error-logging";
import { getWebServerEnv } from "../../../../lib/server-env";
import { getWebSupabaseAdminClient } from "../../../../lib/supabase-admin";

const aiMessageReviewSchema = z.object({
  aiMessageId: z.string().uuid(),
  reviewNotes: z.string().trim().max(2000).optional(),
  reviewStatus: z.enum(["pending", "approved", "flagged", "rejected"]),
});

export async function setAiMessageReviewAction(formData: FormData) {
  const session = await requireAdminSession();

  if (!canUseAdminDatabase()) {
    redirect("/admin/ai-review?error=database_not_configured");
  }

  const parsed = aiMessageReviewSchema.safeParse({
    aiMessageId: String(formData.get("aiMessageId") ?? ""),
    reviewNotes: String(formData.get("reviewNotes") ?? ""),
    reviewStatus: String(formData.get("reviewStatus") ?? ""),
  });

  if (!parsed.success) {
    redirect("/admin/ai-review?error=invalid_review_form");
  }

  const reviewNotes = emptyToNull(parsed.data.reviewNotes);
  const isPending = parsed.data.reviewStatus === "pending";
  const reviewedAt = isPending ? null : new Date().toISOString();
  const reviewerEmail = isPending ? null : session.email;

  const { error } = await getWebSupabaseAdminClient()
    .from("ai_message_reviews")
    .upsert(
      {
        ai_message_id: parsed.data.aiMessageId,
        metadata: {
          updated_from: "admin_web",
        },
        review_notes: reviewNotes,
        review_status: parsed.data.reviewStatus,
        reviewed_at: reviewedAt,
        reviewer_email: reviewerEmail,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "ai_message_id",
      }
    );

  if (error) {
    await logServerError({
      area: "admin_ai_review",
      error,
      eventName: "set_ai_message_review_failed",
      message: "Failed to save an AI message review decision from the admin dashboard.",
      metadata: {
        ai_message_id: parsed.data.aiMessageId,
        review_status: parsed.data.reviewStatus,
      },
    });
    redirect("/admin/ai-review?error=review_save_failed");
  }

  revalidateAiReviewPages();
  redirect("/admin/ai-review?notice=review_saved");
}

function revalidateAiReviewPages() {
  revalidatePath("/admin");
  revalidatePath("/admin/ai-review");
}

function canUseAdminDatabase() {
  const env = getWebServerEnv();
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

function emptyToNull(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
