import type { Metadata } from "next";

import {
  PageHero,
  SectionTitle,
  SiteShell,
} from "../../../components/marketing/site-shell";

export const metadata: Metadata = {
  title: "Terms",
};

export default function TermsPage() {
  return (
    <SiteShell>
      <PageHero
        eyebrow="Legal"
        title="Terms foundation for beta access and pilot school use."
        description="These terms define the basic usage model for students, pilot schools, and anyone accessing the beta product before a full commercial launch."
      />

      <section className="section legal-stack">
        <article className="content-card">
          <SectionTitle
            eyebrow="Access"
            title="User accounts and entitlement"
            description="Users may access the product through direct purchase, a school-issued code, or a free preview tier with feature limits."
          />
        </article>
        <article className="content-card">
          <SectionTitle
            eyebrow="Scope"
            title="Educational support, not official certification"
            description="Prawko helps users prepare for the Polish driving theory exam, but it is not the official exam provider and does not guarantee a passing result."
          />
        </article>
        <article className="content-card">
          <SectionTitle
            eyebrow="Content"
            title="Question and explanation quality"
            description="The team aims to maintain reliable question content and explanations, but users should report suspected errors so they can be reviewed and corrected."
          />
        </article>
        <article className="content-card">
          <SectionTitle
            eyebrow="Commercial"
            title="Pilot terms may change"
            description="During beta and early school pilots, pricing, feature limits, and support conditions may evolve as the product is validated."
          />
        </article>
      </section>
    </SiteShell>
  );
}
