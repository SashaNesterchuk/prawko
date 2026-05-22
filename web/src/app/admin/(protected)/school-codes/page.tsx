import { APP_FEATURES, SUPPORTED_LOCALES } from "@prawko/config";
import type { Metadata } from "next";

import { AdminMessage, AdminPageHeader } from "../../../../components/admin/AdminPageHeader";
import { SectionTitle, StatGrid } from "../../../../components/marketing/site-shell";
import {
  formatAdminDate,
  formatAdminDateTime,
  formatAdminList,
  getAdminSchoolCodeData,
} from "../../../../lib/admin-dashboard";
import {
  createSchoolAction,
  createSchoolCodeAction,
  setSchoolCodeStatusAction,
} from "./actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "School Codes",
};

export default async function AdminSchoolCodesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const notice = firstSearchParam(params.notice);
  const error = firstSearchParam(params.error);
  const data = await getAdminSchoolCodeData();

  return (
    <div className="admin-stack">
      <AdminPageHeader
        eyebrow="School access"
        title="Manage schools, codes, and the first B2B rollout surface."
        description="This page keeps the school model operational: create school records, issue redeemable codes, and see whether memberships are actually being activated."
      />

      {notice ? <AdminMessage tone="success">{getNoticeMessage(notice)}</AdminMessage> : null}
      {error ? <AdminMessage tone="error">{getErrorMessage(error)}</AdminMessage> : null}
      {data.errors.length ? (
        <AdminMessage tone="error">
          <strong>Some school queries failed.</strong>
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

      <section className="section split-section">
        <div className="content-card">
          <SectionTitle
            eyebrow="Create school"
            title="Add a school anchor before issuing codes."
            description="Start with slug, display name, and supported languages. This becomes the B2B container for all future codes and memberships."
          />

          <form action={createSchoolAction} className="admin-form-grid">
            <label className="field">
              <span>Slug</span>
              <input name="slug" placeholder="warsaw-ua-school" />
            </label>
            <label className="field">
              <span>Display name</span>
              <input name="displayName" placeholder="Warsaw UA Driving School" />
            </label>
            <label className="field">
              <span>City</span>
              <input name="city" placeholder="Warsaw" />
            </label>

            <fieldset className="admin-check-group">
              <legend>Supported locales</legend>
              <div className="admin-option-grid">
                {SUPPORTED_LOCALES.map((locale) => (
                  <label key={locale} className="admin-check-option">
                    <input
                      defaultChecked={locale === "ua"}
                      name="supportedLocales"
                      type="checkbox"
                      value={locale}
                    />
                    <span>{locale.toUpperCase()}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <button className="primary-button" type="submit">
              Create school
            </button>
          </form>
        </div>

        <div className="content-card">
          <SectionTitle
            eyebrow="Create code"
            title="Issue a redeemable access code."
            description="Codes are the operational heart of the school flow. Define duration, seat limit, and which premium features unlock."
          />

          {data.schools.length ? (
            <form action={createSchoolCodeAction} className="admin-form-grid">
              <label className="field">
                <span>School</span>
                <select className="admin-select" name="schoolId">
                  {data.schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Code</span>
                <input name="code" placeholder="PRAWKO-14D-UA" />
              </label>
              <label className="field">
                <span>Seats</span>
                <input name="maxRedemptions" placeholder="30" type="number" />
              </label>
              <label className="field">
                <span>Days granted</span>
                <input defaultValue="90" name="grantsDays" type="number" />
              </label>
              <label className="field">
                <span>Valid from</span>
                <input name="validFrom" type="date" />
              </label>
              <label className="field">
                <span>Valid until</span>
                <input name="validUntil" type="date" />
              </label>

              <fieldset className="admin-check-group">
                <legend>Granted features</legend>
                <div className="admin-option-grid">
                  {APP_FEATURES.map((feature) => (
                    <label key={feature} className="admin-check-option">
                      <input
                        defaultChecked
                        name="grantedFeatures"
                        type="checkbox"
                        value={feature}
                      />
                      <span>{feature}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <button className="primary-button" type="submit">
                Create code
              </button>
            </form>
          ) : (
            <p className="admin-empty">
              No schools exist yet. Create the school row first, then come back
              to issue codes.
            </p>
          )}
        </div>
      </section>

      <section className="section">
        <SectionTitle
          eyebrow="School summary"
          title="How the current B2B surface looks."
          description="This is the quickest view of which schools exist, how many codes they hold, and whether active memberships are starting to accumulate."
        />

        <div className="feature-grid">
          {data.schoolSummaries.map((school) => (
            <article key={school.id} className="feature-card">
              <p className="section-kicker">{school.slug}</p>
              <h3>{school.displayName}</h3>
              <p>
                {school.city ?? "City not set"} · {formatAdminList(school.supportedLocales)}
              </p>
              <ul className="card-list">
                <li>{school.totalCodes} total codes</li>
                <li>{school.activeCodes} active codes</li>
                <li>{school.redeemedSeats} redeemed seats</li>
                <li>{school.activeMembers} active memberships</li>
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <SectionTitle
          eyebrow="Codes"
          title="Latest school codes."
          description="Disable or reactivate codes without touching SQL."
        />

        <div className="admin-table-card">
          {data.codeRows.length ? (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>School</th>
                  <th>Status</th>
                  <th>Seats</th>
                  <th>Days</th>
                  <th>Validity</th>
                  <th>Features</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.codeRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.code}</td>
                    <td>{row.schoolName ?? row.schoolId}</td>
                    <td>
                      <span
                        className={
                          row.status === "active"
                            ? "admin-badge admin-badge-success"
                            : "admin-badge"
                        }
                      >
                        {row.status}
                      </span>
                    </td>
                    <td>
                      {row.redeemedCount}
                      {row.maxRedemptions ? ` / ${row.maxRedemptions}` : ""}
                    </td>
                    <td>{row.grantsDays}</td>
                    <td>
                      {formatAdminDate(row.validFrom)} - {formatAdminDate(row.validUntil)}
                    </td>
                    <td>{formatAdminList(row.grantedFeatures)}</td>
                    <td>
                      <form action={setSchoolCodeStatusAction}>
                        <input name="codeId" type="hidden" value={row.id} />
                        <input
                          name="nextStatus"
                          type="hidden"
                          value={row.status === "active" ? "disabled" : "active"}
                        />
                        <button className="secondary-button" type="submit">
                          {row.status === "active" ? "Disable" : "Activate"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="admin-empty">No school codes created yet.</p>
          )}
        </div>
      </section>

      <section className="section">
        <SectionTitle
          eyebrow="Memberships"
          title="Recent school memberships."
          description="This confirms whether code redemption is turning into actual student access."
        />

        <div className="admin-table-card">
          {data.memberships.length ? (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>School</th>
                  <th>User</th>
                  <th>Status</th>
                  <th>Role</th>
                  <th>Started</th>
                  <th>Ends</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.memberships.map((row) => (
                  <tr key={`${row.schoolId}:${row.userId}:${row.createdAt}`}>
                    <td>{row.schoolName ?? row.schoolId}</td>
                    <td>{row.userId}</td>
                    <td>{row.status}</td>
                    <td>{row.role}</td>
                    <td>{formatAdminDateTime(row.startedAt)}</td>
                    <td>{formatAdminDateTime(row.endsAt)}</td>
                    <td>{formatAdminDateTime(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="admin-empty">No memberships recorded yet.</p>
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
    case "school_created":
      return "School created successfully.";
    case "code_created":
      return "School code created successfully.";
    case "code_status_updated":
      return "School code status updated.";
    default:
      return code;
  }
}

function getErrorMessage(code: string) {
  switch (code) {
    case "database_not_configured":
      return "Service-role database access is not configured yet.";
    case "invalid_school_form":
      return "School form is invalid. Check slug, display name, and locales.";
    case "school_create_failed":
      return "School creation failed. The slug may already exist or Supabase may be unavailable.";
    case "invalid_code_form":
      return "Code form is invalid. Check code format, dates, and selected features.";
    case "code_create_failed":
      return "School code creation failed. The code may already exist or Supabase may be unavailable.";
    case "invalid_status_form":
      return "Status form is invalid.";
    case "code_status_failed":
      return "Updating the code status failed.";
    default:
      return code;
  }
}
