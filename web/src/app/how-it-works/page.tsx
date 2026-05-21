import type { Metadata } from "next";

import {
  howItWorksSteps,
  readinessFactors,
  taskTypes,
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
  title: "How It Works",
};

export default function HowItWorksPage() {
  return (
    <SiteShell activePath="/how-it-works">
      <PageHero
        eyebrow="Learning flow"
        title="The product should tell the student exactly what to do today."
        description="Prawko is not trying to look smarter than the user. It simply turns exam prep into a concrete daily path, adjusts the plan when things drift, and keeps explanations inside the same loop."
      />

      <section className="section">
        <SectionTitle
          eyebrow="Flow"
          title="The daily path in four steps."
          description="The ideal first session is simple: set the target, get the plan, finish the day's tasks, and keep moving."
        />
        <StepGrid items={howItWorksSteps} />
      </section>

      <section className="section">
        <SectionTitle
          eyebrow="Task design"
          title="Every day should mix intent and pressure."
          description="Users need clear task types that are easy to start and easy to trust. That matters more than flashy gamification."
        />
        <FeatureGrid items={taskTypes} />
      </section>

      <section className="section split-section">
        <div className="content-card">
          <SectionTitle
            eyebrow="Readiness"
            title="Readiness stays explainable in v1."
            description="The score should be easy to defend, not an AI black box. It exists to orient the user, not to mystify them."
          />
        </div>
        <div className="content-card">
          <FeatureGrid items={readinessFactors} />
        </div>
      </section>

      <ActionBand
        title="See how the offers map to this learning flow."
        description="The business side is built around the same product loop: plan, adaptive repetition, simulator, and code-based access for schools."
        actions={[
          {
            href: "/pricing",
            label: "Open pricing",
            variant: "primary",
          },
          {
            href: "/faq",
            label: "Read FAQ",
            variant: "secondary",
          },
        ]}
      />
    </SiteShell>
  );
}
