import type { Metadata } from "next";

import { AdminMessage, AdminPageHeader } from "../../../../components/admin/AdminPageHeader";
import { SectionTitle, StatGrid } from "../../../../components/marketing/site-shell";
import {
  formatAdminDateTime,
  formatAdminList,
  getAdminSchoolInquiryData,
  truncateAdminText,
} from "../../../../lib/admin-dashboard";
import { setSchoolInquiryStatusAction } from "./actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "School Leads",
};

export default async function AdminSchoolInquiryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const notice = firstSearchParam(params.notice);
  const error = firstSearchParam(params.error);
  const data = await getAdminSchoolInquiryData();

  return (
    <div className="admin-stack">
      <AdminPageHeader
        eyebrow="School leads"
        title="Treat school inquiries as an operating queue, not a mail inbox."
        description="This page closes the loop for the public school funnel: see inbound pilot requests, prioritize the best leads, and save pipeline status with notes."
      />

      {notice ? <AdminMessage tone="success">{getNoticeMessage(notice)}</AdminMessage> : null}
      {error ? <AdminMessage tone="error">{getErrorMessage(error)}</AdminMessage> : null}
      {data.errors.length ? (
        <AdminMessage tone="error">
          <strong>Some school inquiry queries failed.</strong>
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
          eyebrow="Priority queue"
          title="Leads that still need action."
          description="New, contacted, and qualified school requests belong in an explicit queue so the pilot channel does not disappear into support email."
        />

        {data.openInquiries.length ? (
          <div className="feature-grid">
            {data.openInquiries.slice(0, 12).map((inquiry) => (
              <article key={inquiry.id} className="content-card">
                <p className="section-kicker">
                  {inquiry.organizationName} · {formatAdminDateTime(inquiry.createdAt)}
                </p>
                <h3>{inquiry.contactName}</h3>
                <p>{truncateAdminText(inquiry.message, 260)}</p>
                <ul className="admin-inline-list">
                  <li>Status: {inquiry.status}</li>
                  <li>Email: {inquiry.email}</li>
                  <li>City: {inquiry.city ?? "—"}</li>
                  <li>Locales: {formatAdminList(inquiry.studentLocales)}</li>
                  <li>
                    Estimated students:{" "}
                    {inquiry.estimatedStudents === null ? "—" : inquiry.estimatedStudents}
                  </li>
                  <li>Current tool: {inquiry.currentSolution ?? "—"}</li>
                </ul>

                <form action={setSchoolInquiryStatusAction} className="admin-form-grid">
                  <input name="inquiryId" type="hidden" value={inquiry.id} />
                  <label className="field">
                    <span>Status</span>
                    <select
                      className="admin-select"
                      defaultValue={inquiry.status}
                      name="nextStatus"
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="qualified">Qualified</option>
                      <option value="won">Won</option>
                      <option value="lost">Lost</option>
                      <option value="spam">Spam</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Admin note</span>
                    <input
                      defaultValue={inquiry.adminNotes ?? ""}
                      name="adminNotes"
                      placeholder="Cohort size, pilot timing, blocker, or next step."
                    />
                  </label>
                  <button className="primary-button" type="submit">
                    Save lead
                  </button>
                </form>
              </article>
            ))}
          </div>
        ) : (
          <div className="content-card">
            <p className="admin-empty">No open school inquiries right now.</p>
          </div>
        )}
      </section>

      <section className="section split-section">
        <div className="admin-table-card">
          <SectionTitle
            eyebrow="Recently handled"
            title="Latest pipeline decisions."
            description="This shows which school leads were touched recently, what status they reached, and who last updated them."
          />

          {data.recentHandledInquiries.length ? (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Handled</th>
                  <th>Status</th>
                  <th>School</th>
                  <th>Contact</th>
                  <th>Owner</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {data.recentHandledInquiries.slice(0, 12).map((inquiry) => (
                  <tr key={inquiry.id}>
                    <td>{formatAdminDateTime(inquiry.handledAt ?? inquiry.createdAt)}</td>
                    <td>
                      <span className={getInquiryBadgeClass(inquiry.status)}>
                        {inquiry.status}
                      </span>
                    </td>
                    <td>{inquiry.organizationName}</td>
                    <td>{inquiry.contactName}</td>
                    <td>{inquiry.handledByEmail ?? "—"}</td>
                    <td>{inquiry.adminNotes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="admin-empty">No handled school inquiries yet.</p>
          )}
        </div>

        <div className="admin-table-card">
          <SectionTitle
            eyebrow="Recent source"
            title="What the inbound lead actually contains."
            description="This is the fastest way to check whether the public form is collecting enough operational detail to answer with a real pilot offer."
          />

          {data.inquiries.length ? (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Created</th>
                  <th>School</th>
                  <th>Contact</th>
                  <th>Locales</th>
                  <th>Students</th>
                  <th>Source</th>
                  <th>Preview</th>
                </tr>
              </thead>
              <tbody>
                {data.inquiries.slice(0, 12).map((inquiry) => (
                  <tr key={inquiry.id}>
                    <td>{formatAdminDateTime(inquiry.createdAt)}</td>
                    <td>{inquiry.organizationName}</td>
                    <td>
                      {inquiry.contactName}
                      <br />
                      {inquiry.email}
                    </td>
                    <td>{formatAdminList(inquiry.studentLocales)}</td>
                    <td>
                      {inquiry.estimatedStudents === null ? "—" : inquiry.estimatedStudents}
                    </td>
                    <td>{inquiry.sourcePage}</td>
                    <td>{truncateAdminText(inquiry.message, 120)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="admin-empty">No school inquiries recorded yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function getNoticeMessage(code: string) {
  switch (code) {
    case "inquiry_saved":
      return "School lead updated.";
    default:
      return code;
  }
}

function getErrorMessage(code: string) {
  switch (code) {
    case "database_not_configured":
      return "Service-role database access is not configured yet.";
    case "invalid_inquiry_form":
      return "Lead form is invalid. Check the selected status and admin note.";
    case "inquiry_save_failed":
      return "Saving the school lead failed. Check app_error_logs for details.";
    default:
      return code;
  }
}

function getInquiryBadgeClass(status: string) {
  if (status === "qualified" || status === "won") {
    return "admin-badge admin-badge-success";
  }

  if (status === "new" || status === "contacted") {
    return "admin-badge admin-badge-warning";
  }

  return "admin-badge";
}
