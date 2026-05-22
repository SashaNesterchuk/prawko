import type { Metadata } from "next";

import { AdminMessage, AdminPageHeader } from "../../../components/admin/AdminPageHeader";
import {
  formatAdminDateTime,
  getAdminOverviewData,
  truncateAdminText,
} from "../../../lib/admin-dashboard";
import { SectionTitle, StatGrid } from "../../../components/marketing/site-shell";

export const metadata: Metadata = {
  title: "Admin Overview",
};

export default async function AdminOverviewPage() {
  const data = await getAdminOverviewData();

  return (
    <div className="admin-stack">
      <AdminPageHeader
        eyebrow="Overview"
        title="Operational pulse for the current product state."
        description="This page keeps the first backoffice slice focused on what matters now: users entering the funnel, school-code activity, and AI output quality."
      />

      {!data.configuration.authConfigured ? (
        <AdminMessage tone="error">
          Admin auth is not fully configured. Missing env:{" "}
          {data.configuration.authMissing.join(", ")}.
        </AdminMessage>
      ) : null}
      {!data.configuration.databaseConfigured ? (
        <AdminMessage tone="error">
          Service-role Supabase env is missing, so live admin data is unavailable.
        </AdminMessage>
      ) : null}
      {data.errors.length ? (
        <AdminMessage tone="error">
          <strong>Some queries failed.</strong>
          <ul className="admin-inline-list">
            {data.errors.map((error) => (
              <li key={`${error.area}:${error.message}`}>
                {error.area}: {error.message}
              </li>
            ))}
          </ul>
        </AdminMessage>
      ) : null}

      <StatGrid items={data.metrics} />

      <section className="section">
        <SectionTitle
          eyebrow="Recent users"
          title="Latest profiles entering the product."
          description="This is the quickest way to see whether onboarding is creating real profiles and which locales are actually being used."
        />
        <div className="admin-table-card">
          {data.recentProfiles.length ? (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Locale</th>
                  <th>Category</th>
                  <th>Onboarding</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.recentProfiles.map((profile) => (
                  <tr key={profile.id}>
                    <td>{profile.fullName ?? "Unnamed"}</td>
                    <td>{profile.interfaceLocale.toUpperCase()}</td>
                    <td>{profile.currentCategory}</td>
                    <td>
                      <span
                        className={
                          profile.onboardingCompleted
                            ? "admin-badge admin-badge-success"
                            : "admin-badge"
                        }
                      >
                        {profile.onboardingCompleted ? "Completed" : "Pending"}
                      </span>
                    </td>
                    <td>{formatAdminDateTime(profile.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="admin-empty">
              No profile rows are visible yet. This usually means the database is
              empty or migrations have not been applied to the target project.
            </p>
          )}
        </div>
      </section>

      <section className="section split-section">
        <div className="admin-table-card">
          <SectionTitle
            eyebrow="School access"
            title="Recent school-granted entitlements."
            description="These rows show whether redeemed school codes are actually generating active feature access."
          />
          {data.recentSchoolEntitlements.length ? (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>School</th>
                  <th>Feature</th>
                  <th>Status</th>
                  <th>Starts</th>
                  <th>Ends</th>
                </tr>
              </thead>
              <tbody>
                {data.recentSchoolEntitlements.map((row) => (
                  <tr key={`${row.userId}:${row.featureKey}:${row.createdAt}`}>
                    <td>{row.schoolName ?? row.schoolId ?? "Unknown school"}</td>
                    <td>{row.featureKey}</td>
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
                    <td>{formatAdminDateTime(row.startsAt)}</td>
                    <td>{formatAdminDateTime(row.endsAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="admin-empty">No school-code entitlements found yet.</p>
          )}
        </div>

        <div className="admin-table-card">
          <SectionTitle
            eyebrow="AI signal"
            title="Latest assistant output sample."
            description="A fast sanity check for provider mix, latency, and fallback usage before digging into the dedicated AI review page."
          />
          {data.recentAssistantMessages.length ? (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Provider</th>
                  <th>Kind</th>
                  <th>Fallback</th>
                  <th>Preview</th>
                </tr>
              </thead>
              <tbody>
                {data.recentAssistantMessages.slice(0, 8).map((message) => (
                  <tr key={`${message.conversationId}:${message.createdAt}`}>
                    <td>{formatAdminDateTime(message.createdAt)}</td>
                    <td>{message.provider ?? "unknown"}</td>
                    <td>{message.messageKind}</td>
                    <td>
                      <span
                        className={
                          message.fallbackUsed
                            ? "admin-badge admin-badge-warning"
                            : "admin-badge admin-badge-success"
                        }
                      >
                        {message.fallbackUsed ? "Fallback" : "Primary"}
                      </span>
                    </td>
                    <td>{truncateAdminText(message.content, 90)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="admin-empty">No assistant messages recorded yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
