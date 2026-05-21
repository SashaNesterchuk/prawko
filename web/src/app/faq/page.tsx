import type { Metadata } from "next";

import { faqItems } from "../../components/marketing/site-content";
import {
  ActionBand,
  FAQList,
  PageHero,
  SectionTitle,
  SiteShell,
} from "../../components/marketing/site-shell";
import { getMarketingLinks } from "../../lib/marketing-links";

export const metadata: Metadata = {
  title: "FAQ",
};

export default function FaqPage() {
  const links = getMarketingLinks();

  return (
    <SiteShell activePath="/faq">
      <PageHero
        eyebrow="FAQ"
        title="Answer the adoption questions before they become support load."
        description="The first web layer should remove obvious hesitation: who the product is for, which languages it supports, what the AI does, and how school access actually works."
      />

      <section className="section">
        <SectionTitle
          eyebrow="Answers"
          title="The common objections and clarifications."
          description="This page exists to lower friction for both students and school operators."
        />
        <FAQList items={faqItems} />
      </section>

      <ActionBand
        title="Did not find your answer?"
        description="Use support for product questions, content issues, or pilot-school conversations."
        actions={[
          {
            href: "/support",
            label: "Open support",
            variant: "ghost",
          },
          {
            href: links.schoolInquiryUrl,
            label: "Ask about school access",
            variant: "primary",
            external: true,
          },
        ]}
      />
    </SiteShell>
  );
}
