import type { Metadata } from "next";

import { getMarketingLinks } from "../lib/marketing-links";
import {
  howItWorksSteps,
  landingHighlights,
  landingStats,
} from "../components/marketing/site-content";
import {
  ActionBand,
  FeatureGrid,
  PageHero,
  SectionTitle,
  SiteShell,
  StatGrid,
  StepGrid,
} from "../components/marketing/site-shell";

export const metadata: Metadata = {
  title: "Home",
};

export default function HomePage() {
  const links = getMarketingLinks();

  return (
    <SiteShell>
      <PageHero
        eyebrow="Study plan for the Polish theory exam"
        title="Stop grinding random questions. Train against the day of your exam."
        description="Pick the exam date and daily minutes. Prawko builds the plan, repeats hard questions more often, and explains confusing answers inside the same flow."
        actions={[
          {
            href: links.googlePlayUrl,
            label: "Get on Google Play",
            variant: "primary",
          },
          {
            href: "/pricing",
            label: "See offers",
            variant: "secondary",
          },
          {
            href: "/schools",
            label: "School access",
            variant: "ghost",
          },
        ]}
        aside={<PlanPreviewCard />}
      />

      <StatGrid items={landingStats} />

      <section className="section">
        <SectionTitle
          eyebrow="Why this product exists"
          title="The real pain is not missing content. The real pain is missing structure."
          description="Students already have access to question banks. What they usually do not have is a concrete plan, a way to revisit rare hard questions, and a built-in explanation loop when the answer feels arbitrary."
        />
        <FeatureGrid items={landingHighlights} />
      </section>

      <section className="section split-section">
        <div className="content-card">
          <SectionTitle
            eyebrow="How it feels"
            title="The home screen should always show one clear thing to do next."
            description="Today's goal, progress, and minimum mode matter more than abstract streaks. The app is there to reduce prep chaos, not to add another dashboard."
          />
        </div>
        <div className="content-card">
          <SectionTitle
            eyebrow="Monetization"
            title="One product, two access channels."
            description="Direct users can buy a sprint. Schools can distribute access codes. The entitlement logic stays explicit so the user never wonders why the app is locked or unlocked."
          />
        </div>
      </section>

      <section className="section">
        <SectionTitle
          eyebrow="Flow"
          title="What the student journey looks like."
          description="The first version is intentionally narrow: day-by-day plan, adaptive repetition, AI explanation, and exam simulator pressure."
        />
        <StepGrid items={howItWorksSteps} />
      </section>

      <ActionBand
        title="Need a product page for schools instead of another generic landing?"
        description="The school surface focuses on code-based access, immigrant student fit, and a pilot-ready rollout story."
        actions={[
          {
            href: "/schools",
            label: "Open school page",
            variant: "ghost",
          },
          {
            href: links.schoolInquiryUrl,
            label: "Start school pilot",
            variant: "primary",
          },
        ]}
      />
    </SiteShell>
  );
}

function PlanPreviewCard() {
  return (
    <article className="plan-preview">
      <p className="plan-preview-label">Sample day</p>
      <h2>Day 6 of 14</h2>
      <p className="plan-preview-copy">
        42 minutes planned. Intersections first, then weak spots, then a short
        simulator.
      </p>

      <ul className="plan-task-list">
        <li>
          <strong>Learn topic</strong>
          <span>12 intersection questions with answer breakdowns</span>
        </li>
        <li>
          <strong>Review weak spots</strong>
          <span>8 questions missed twice this week</span>
        </li>
        <li>
          <strong>Mini test</strong>
          <span>10-minute check before the day is marked complete</span>
        </li>
      </ul>

      <p className="plan-preview-note">
        Skip today and the next days adjust instead of collapsing.
      </p>
    </article>
  );
}
