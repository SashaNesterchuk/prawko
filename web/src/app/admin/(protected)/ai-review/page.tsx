import type { Metadata } from "next";

import { AdminMessage, AdminPageHeader } from "../../../../components/admin/AdminPageHeader";
import { SectionTitle, StatGrid } from "../../../../components/marketing/site-shell";
import {
  formatAdminDateTime,
  getAdminAiReviewData,
  truncateAdminText,
} from "../../../../lib/admin-dashboard";
import { setAiMessageReviewAction } from "./actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "AI Review",
};

export default async function AdminAiReviewPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const notice = firstSearchParam(params.notice);
  const error = firstSearchParam(params.error);
  const data = await getAdminAiReviewData();

  return (
    <div className="admin-stack">
      <AdminPageHeader
        eyebrow="AI review"
        title="Review assistant output and resolve the pending queue."
        description="This page is now an operational queue, not only a dashboard: inspect recent assistant output, prioritize fallback or explanation messages, and save a manual decision with notes."
      />

      {notice ? <AdminMessage tone="success">{getNoticeMessage(notice)}</AdminMessage> : null}
      {error ? <AdminMessage tone="error">{getErrorMessage(error)}</AdminMessage> : null}
      {data.errors.length ? (
        <AdminMessage tone="error">
          <strong>Some AI queries failed.</strong>
          <ul className="admin-inline-list">
            {data.errors.map((item) => (
              <li key={`${item.area}:${item.message}`}>
                {item.area}: {item.message}
              </li>
            ))}
          </ul>
        </AdminMessage>
      ) : null}

      <StatGrid items={data.metrics} />

      <section className="section">
        <SectionTitle
          eyebrow="Provider mix"
          title="Recent provider breakdown."
          description="This is sampled from the latest assistant messages, so it gives operational signal without a separate analytics warehouse."
        />
        {data.providerMetrics.length ? (
          <StatGrid items={data.providerMetrics} />
        ) : (
          <div className="content-card">
            <p className="admin-empty">No provider activity recorded yet.</p>
          </div>
        )}
      </section>

      <section className="section">
        <SectionTitle
          eyebrow="Priority queue"
          title="Messages that still need a manual decision."
          description="Review explanation outputs and fallback messages first. Save a status so the queue becomes an actual operating surface instead of a passive log."
        />
        {data.pendingReviewMessages.length ? (
          <div className="feature-grid">
            {data.pendingReviewMessages.slice(0, 12).map((message) => (
              <article key={message.id} className="content-card">
                <p className="section-kicker">
                  {message.messageKind} · {formatAdminDateTime(message.createdAt)}
                </p>
                <h3>
                  {message.questionId
                    ? `Question ${truncateAdminText(message.questionId, 20)}`
                    : "Conversation output"}
                </h3>
                <p>{truncateAdminText(message.content, 260)}</p>
                <ul className="admin-inline-list">
                  <li>Provider: {message.provider ?? "unknown"}</li>
                  <li>Model: {message.model ?? "—"}</li>
                  <li>Latency: {message.latencyMs ?? "—"} ms</li>
                  <li>Fallback: {message.fallbackUsed ? "Yes" : "No"}</li>
                </ul>

                <form action={setAiMessageReviewAction} className="admin-form-grid">
                  <input name="aiMessageId" type="hidden" value={message.id} />
                  <label className="field">
                    <span>Status</span>
                    <select
                      className="admin-select"
                      defaultValue={message.reviewStatus}
                      name="reviewStatus"
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="flagged">Flagged</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Review note</span>
                    <input
                      defaultValue={message.reviewNotes ?? ""}
                      name="reviewNotes"
                      placeholder="Why this output is fine, risky, or should be rejected."
                    />
                  </label>
                  <button className="primary-button" type="submit">
                    Save review
                  </button>
                </form>
              </article>
            ))}
          </div>
        ) : (
          <div className="content-card">
            <p className="admin-empty">
              No pending review items in the sampled window.
            </p>
          </div>
        )}
      </section>

      <section className="section split-section">
        <div className="admin-table-card">
          <SectionTitle
            eyebrow="Recently reviewed"
            title="Latest manual decisions."
            description="This confirms that the queue is being processed and shows who marked a message approved, flagged, or rejected."
          />
          {data.recentReviewedMessages.length ? (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Reviewed</th>
                  <th>Status</th>
                  <th>Reviewer</th>
                  <th>Kind</th>
                  <th>Question</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {data.recentReviewedMessages.slice(0, 12).map((message) => (
                  <tr key={message.id}>
                    <td>{formatAdminDateTime(message.reviewedAt ?? message.createdAt)}</td>
                    <td>
                      <span className={getReviewBadgeClass(message.reviewStatus)}>
                        {message.reviewStatus}
                      </span>
                    </td>
                    <td>{message.reviewedByEmail ?? "—"}</td>
                    <td>{message.messageKind}</td>
                    <td>{message.questionId ?? "—"}</td>
                    <td>{message.reviewNotes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="admin-empty">No reviewed assistant messages yet.</p>
          )}
        </div>

        <div className="admin-table-card">
          <SectionTitle
            eyebrow="Fallback sample"
            title="Messages that used fallback output."
            description="Fallbacks are not automatically bad, but they are exactly the subset worth checking first when the queue grows."
          />
          {data.fallbackMessages.length ? (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Kind</th>
                  <th>Provider</th>
                  <th>Status</th>
                  <th>Preview</th>
                </tr>
              </thead>
              <tbody>
                {data.fallbackMessages.slice(0, 10).map((message) => (
                  <tr key={message.id}>
                    <td>{formatAdminDateTime(message.createdAt)}</td>
                    <td>{message.messageKind}</td>
                    <td>{message.provider ?? "unknown"}</td>
                    <td>
                      <span className={getReviewBadgeClass(message.reviewStatus)}>
                        {message.reviewStatus}
                      </span>
                    </td>
                    <td>{truncateAdminText(message.content, 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="admin-empty">No recent fallback messages in the sampled window.</p>
          )}
        </div>
      </section>

      <section className="section">
        <SectionTitle
          eyebrow="Recent assistant output"
          title="Latest visible assistant messages."
          description="Review the preview text, provider, model, latency, and manual status before deeper QA."
        />
        <div className="admin-table-card">
          {data.recentAssistantMessages.length ? (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Status</th>
                  <th>Provider</th>
                  <th>Model</th>
                  <th>Kind</th>
                  <th>Latency</th>
                  <th>Tokens</th>
                  <th>Question</th>
                  <th>Preview</th>
                </tr>
              </thead>
              <tbody>
                {data.recentAssistantMessages.map((message) => (
                  <tr key={message.id}>
                    <td>{formatAdminDateTime(message.createdAt)}</td>
                    <td>
                      <span className={getReviewBadgeClass(message.reviewStatus)}>
                        {message.reviewStatus}
                      </span>
                    </td>
                    <td>{message.provider ?? "unknown"}</td>
                    <td>{message.model ?? "—"}</td>
                    <td>{message.messageKind}</td>
                    <td>{message.latencyMs ?? "—"} ms</td>
                    <td>
                      {message.inputTokens ?? "—"} / {message.outputTokens ?? "—"}
                    </td>
                    <td>{message.questionId ?? "—"}</td>
                    <td>{truncateAdminText(message.content, 120)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="admin-empty">No assistant messages available for review.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function firstSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getNoticeMessage(notice: string) {
  switch (notice) {
    case "review_saved":
      return "AI review saved.";
    default:
      return "AI review updated.";
  }
}

function getErrorMessage(error: string) {
  switch (error) {
    case "database_not_configured":
      return "Admin database env is missing. Set the service-role Supabase env first.";
    case "invalid_review_form":
      return "The AI review form is invalid. Check the selected status and note.";
    case "review_save_failed":
      return "Saving the AI review failed. Check app_error_logs for details.";
    default:
      return "The AI review request failed.";
  }
}

function getReviewBadgeClass(reviewStatus: string) {
  if (reviewStatus === "approved") {
    return "admin-badge admin-badge-success";
  }

  if (reviewStatus === "flagged") {
    return "admin-badge admin-badge-warning";
  }

  return "admin-badge";
}
