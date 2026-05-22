import type { Metadata } from "next";

import { AdminMessage, AdminPageHeader } from "../../../../components/admin/AdminPageHeader";
import { SectionTitle, StatGrid } from "../../../../components/marketing/site-shell";
import {
  formatAdminDateTime,
  getAdminImportHealthData,
} from "../../../../lib/admin-dashboard";

export const metadata: Metadata = {
  title: "Import Health",
};

export default async function AdminImportHealthPage() {
  const data = await getAdminImportHealthData();

  return (
    <div className="admin-stack">
      <AdminPageHeader
        eyebrow="Import health"
        title="Track the question and media pipeline without dropping into the terminal."
        description="This page reads the generated pipeline artifacts and compares them with the live database so import drift shows up before users feel it."
      />

      {data.errors.length ? (
        <AdminMessage tone="error">
          <strong>Some reports could not be read.</strong>
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
          eyebrow="Checkpoints"
          title="Current pipeline artifacts."
          description="Each checkpoint reads directly from the generated files already present in the repository workspace."
        />
        <div className="feature-grid">
          {data.checkpoints.map((checkpoint) => (
            <article key={checkpoint.title} className="feature-card">
              <p className="section-kicker">{checkpoint.title}</p>
              <h3>{checkpoint.status.toUpperCase()}</h3>
              <p>{checkpoint.path}</p>
              <ul className="card-list">
                {checkpoint.metrics.map((metric) => (
                  <li key={metric.label}>
                    {metric.label}: {metric.value}
                  </li>
                ))}
                <li>Updated: {formatAdminDateTime(checkpoint.updatedAt)}</li>
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="section split-section">
        <div className="content-card">
          <SectionTitle
            eyebrow="Remote database"
            title="What the live database currently exposes."
            description="These counts come from Supabase through the service role and should stay close to the latest successful sync."
          />
          <ul className="card-list">
            <li>Remote active questions: {data.databaseComparison.remoteActiveQuestions ?? "Unavailable"}</li>
            <li>Remote Category B questions: {data.databaseComparison.categoryBQuestions ?? "Unavailable"}</li>
            <li>Remote questions with media: {data.databaseComparison.questionsWithMedia ?? "Unavailable"}</li>
          </ul>
        </div>

        <div className="content-card">
          <SectionTitle
            eyebrow="Interpretation"
            title="What to treat as warning vs failure."
            description="Warnings are acceptable for known dataset quirks. Failed sync rows, failed build jobs, or failed uploads should block a release until resolved."
          />
        </div>
      </section>

      <section className="section">
        <SectionTitle
          eyebrow="Validation"
          title="Recent validation warnings."
          description="The first admin version surfaces the warning sample so content issues stop being hidden in local JSON only."
        />
        <div className="admin-table-card">
          {data.validationWarnings.length ? (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Code</th>
                  <th>Question</th>
                  <th>Row</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {data.validationWarnings.map((warning) => (
                  <tr key={`${warning.code}:${warning.questionSourceId}:${warning.sourceRowNumber}`}>
                    <td>{warning.severity}</td>
                    <td>{warning.code}</td>
                    <td>{warning.questionSourceId ?? "—"}</td>
                    <td>{warning.sourceRowNumber ?? "—"}</td>
                    <td>{warning.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="admin-empty">No validation warnings found in the sampled report.</p>
          )}
        </div>
      </section>
    </div>
  );
}
