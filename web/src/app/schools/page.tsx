import type { Metadata } from "next";

import { getMarketingLinks } from "../../lib/marketing-links";
import { SchoolInquiryForm } from "../../components/marketing/SchoolInquiryForm";
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
            href: "#pilot-form",
            label: "Start school pilot",
            variant: "primary",
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

      <section className="section" id="pilot-form">
        <SectionTitle
          eyebrow="Pilot form"
          title="Collect a real school lead instead of pushing everyone into email."
          description="The first school funnel should end in a concrete request: who the school is, how big the cohort is, which languages matter, and what current prep flow they want to replace."
        />

        <div className="split-section">
          <div className="content-card">
            <SectionTitle
              eyebrow="Request pilot"
              title="Send the school details."
              description="This should be enough to answer with a concrete pilot offer instead of another vague discovery call."
            />
            <SchoolInquiryForm supportEmail={links.supportEmail} />
          </div>

          <div className="content-card">
            <SectionTitle
              eyebrow="What happens next"
              title="Keep the first school conversation operational."
              description="The fastest useful reply is not a brochure. It is a concrete proposal around cohort size, access length, and who inside the school owns rollout."
            />

            <ul className="card-list">
              <li>Reply with a pilot scope, not a generic sales deck.</li>
              <li>Choose a code window like 14, 30, or 90 days.</li>
              <li>Confirm whether the school needs Ukrainian, Polish, or mixed onboarding.</li>
              <li>Replace random prep with plan-driven daily work and faster explanation loops.</li>
            </ul>
          </div>
        </div>
      </section>

      <ActionBand
        title="Want to test a school cohort?"
        description="Start with a small pilot, a defined access window, and one clear contact person inside the school."
        actions={[
          {
            href: "#pilot-form",
            label: "Open pilot form",
            variant: "primary",
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
