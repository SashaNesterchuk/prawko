import type { Metadata } from "next";

import { AdminMessage, AdminPageHeader } from "../../../../components/admin/AdminPageHeader";
import { SectionTitle, StatGrid } from "../../../../components/marketing/site-shell";
import {
  formatAdminDateTime,
  getAdminAiReviewData,
  truncateAdminText,
} from "../../../../lib/admin-dashboard";

export const metadata: Metadata = {
  title: "AI Review",
};

export default async function AdminAiReviewPage() {
  const data = await getAdminAiReviewData();

  return (
    <div className="admin-stack">
      <AdminPageHeader
        eyebrow="AI review"
        title="Inspect assistant output quality and fallback behavior."
        description="The first AI review page is deliberately narrow: recent assistant output, fallback rate in sample, latency signal, and provider mix."
      />

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
          description="This is sampled from the latest assistant messages, so it gives operational signal without needing a separate analytics warehouse."
        />
        {data.providerMetrics.length ? (
          <StatGrid items={data.providerMetrics} />
        ) : (
          <div className="content-card">
            <p className="admin-empty">No provider activity recorded yet.</p>
          </div>
        )}
      </section>

      <section className="section split-section">
        <div className="admin-table-card">
          <SectionTitle
            eyebrow="Fallback sample"
            title="Messages that used fallback output."
            description="Fallbacks are not automatically bad, but they are exactly the subset worth checking first."
          />
          {data.fallbackMessages.length ? (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Kind</th>
                  <th>Provider</th>
                  <th>Latency</th>
                  <th>Preview</th>
                </tr>
              </thead>
              <tbody>
                {data.fallbackMessages.slice(0, 10).map((message) => (
                  <tr key={`${message.conversationId}:${message.createdAt}`}>
                    <td>{formatAdminDateTime(message.createdAt)}</td>
                    <td>{message.messageKind}</td>
                    <td>{message.provider ?? "unknown"}</td>
                    <td>{message.latencyMs ?? "—"} ms</td>
                    <td>{truncateAdminText(message.content, 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="admin-empty">No recent fallback messages in the sampled window.</p>
          )}
        </div>

        <div className="content-card">
          <SectionTitle
            eyebrow="Reading the page"
            title="What this slice is for."
            description="It is not a full moderation product yet. It is a first operational lens: do we see output, which provider generated it, how slow was it, and did the backend fall back to mock output?"
          />
        </div>
      </section>

      <section className="section">
        <SectionTitle
          eyebrow="Recent assistant output"
          title="Latest visible assistant messages."
          description="Review the preview text, provider, model, and latency before deeper manual QA."
        />
        <div className="admin-table-card">
          {data.recentAssistantMessages.length ? (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>When</th>
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
                  <tr key={`${message.conversationId}:${message.createdAt}`}>
                    <td>{formatAdminDateTime(message.createdAt)}</td>
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
