import type { Metadata } from "next";

import { adminModules } from "../../components/marketing/site-content";
import {
  FeatureGrid,
  PageHero,
  SectionTitle,
  SiteShell,
  StatGrid,
} from "../../components/marketing/site-shell";
import { getWebServerEnv } from "../../lib/server-env";

export const metadata: Metadata = {
  title: "Admin Foundation",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminFoundationPage() {
  const env = getWebServerEnv();

  const diagnostics = [
    {
      label: "Public Supabase URL",
      value: env.NEXT_PUBLIC_SUPABASE_URL ? "configured" : "missing",
      detail: "Needed for client auth and public app links",
    },
    {
      label: "Service role key",
      value: env.SUPABASE_SERVICE_ROLE_KEY ? "configured" : "missing",
      detail: "Required before real admin data surfaces can exist",
    },
    {
      label: "Auth secret",
      value: env.AUTH_SECRET ? "configured" : "missing",
      detail: "Reserved for the upcoming protected admin flow",
    },
  ] as const;

  return (
    <SiteShell>
      <PageHero
        eyebrow="Admin foundation"
        title="This route is intentionally a safe shell, not a fake dashboard."
        description="The admin area should not expose production data before auth and role checks are wired. This page exists to establish the route, no-index behavior, and the concrete module queue."
      />

      <section className="section">
        <SectionTitle
          eyebrow="Readiness"
          title="What is already prepared for the real admin slice."
          description="These checks are safe to show publicly because they only expose whether configuration exists, not any sensitive values."
        />
        <StatGrid items={diagnostics} />
      </section>

      <section className="section">
        <SectionTitle
          eyebrow="Module queue"
          title="The next dashboard modules are already defined."
          description="The goal is operational clarity: users summary, school codes, question import health, and AI review."
        />
        <FeatureGrid items={adminModules} />
      </section>
    </SiteShell>
  );
}
