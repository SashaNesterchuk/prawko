import type { Metadata } from "next";

import {
  PageHero,
  SectionTitle,
  SiteShell,
} from "../../../components/marketing/site-shell";

export const metadata: Metadata = {
  title: "Privacy",
};

export default function PrivacyPage() {
  return (
    <SiteShell>
      <PageHero
        eyebrow="Legal"
        title="Privacy policy foundation for the first public release."
        description="This is the practical baseline for a beta product: what data is collected, why it is collected, and how support, analytics, and school access fit into that flow."
      />

      <section className="section legal-stack">
        <article className="content-card">
          <SectionTitle
            eyebrow="Controller"
            title="Who operates the product"
            description="Prawko operates the mobile application and supporting web surfaces for Category B theory preparation in Poland."
          />
        </article>
        <article className="content-card">
          <SectionTitle
            eyebrow="Data"
            title="What data may be processed"
            description="Account identifiers, profile settings, study-plan setup, question progress, simulator results, school-code redemption, support messages, and analytics needed to improve the product."
          />
        </article>
        <article className="content-card">
          <SectionTitle
            eyebrow="Purpose"
            title="Why the data exists"
            description="To authenticate the user, generate and sync study plans, restore entitlements, deliver question content, investigate product issues, and understand whether the core learning funnel works."
          />
        </article>
        <article className="content-card">
          <SectionTitle
            eyebrow="Retention"
            title="How data retention should work"
            description="Keep only what is needed to operate the service, troubleshoot issues, and meet legal obligations. Beta policies should be reviewed before production launch."
          />
        </article>
      </section>
    </SiteShell>
  );
}
