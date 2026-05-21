import type { Metadata } from "next";

import { getMarketingLinks } from "../../lib/marketing-links";
import {
  schoolBenefits,
  schoolRolloutSteps,
} from "../../components/marketing/site-content";
import {
  ActionBand,
  FeatureGrid,
  PageHero,
  SectionTitle,
  SiteShell,
  StepGrid,
} from "../../components/marketing/site-shell";

export const metadata: Metadata = {
  title: "Schools",
};

export default function SchoolsPage() {
  const links = getMarketingLinks();

  return (
    <SiteShell activePath="/schools">
      <PageHero
        eyebrow="School channel"
        title="A better prep offer for schools serving foreign students in Poland."
        description="The school page is not a corporate brochure. It should help close the first 3-5 pilot schools by showing a sharper student fit, a cleaner access model, and less support chaos."
        actions={[
          {
            href: links.schoolInquiryUrl,
            label: "Start school pilot",
            variant: "primary",
            external: true,
          },
          {
            href: "/pricing",
            label: "See offer structure",
            variant: "secondary",
          },
        ]}
      />

      <section className="section">
        <SectionTitle
          eyebrow="Why schools care"
          title="The value proposition is operational, not just visual."
          description="Schools already pay for access somewhere. The product wins by solving more student pain with less friction, especially for Ukrainian and Belarusian cohorts."
        />
        <FeatureGrid items={schoolBenefits} />
      </section>

      <section className="section">
        <SectionTitle
          eyebrow="Rollout"
          title="A pilot should be easy to run."
          description="Keep the first version lightweight: agree the pilot, issue codes, collect friction points, and only then scale."
        />
        <StepGrid items={schoolRolloutSteps} />
      </section>

      <section className="section split-section">
        <div className="content-card">
          <SectionTitle
            eyebrow="Student experience"
            title="What the learner actually gets."
            description="A guided daily plan, repeated weak questions, AI explanation without leaving the app, and a clean code-redemption path."
          />
        </div>
        <div className="content-card">
          <SectionTitle
            eyebrow="Business fit"
            title="Why this is easier to sell than another question bank."
            description="The pitch is not “we also have questions.” The pitch is “your students stop studying randomly, understand confusing answers faster, and need less manual help.”"
          />
        </div>
      </section>

      <ActionBand
        title="Want to test a school cohort?"
        description="Start with a small pilot, a defined access window, and one clear contact person inside the school."
        actions={[
          {
            href: links.schoolInquiryUrl,
            label: "Contact for pilot",
            variant: "primary",
            external: true,
          },
          {
            href: "/support",
            label: "Support details",
            variant: "ghost",
          },
        ]}
      />
    </SiteShell>
  );
}
