import type { Metadata } from "next";

import { getMarketingLinks } from "../../lib/marketing-links";
import {
  landingHighlights,
  pricingTiers,
} from "../../components/marketing/site-content";
import {
  ActionBand,
  FeatureGrid,
  PageHero,
  PricingGrid,
  SectionTitle,
  SiteShell,
} from "../../components/marketing/site-shell";

export const metadata: Metadata = {
  title: "Pricing",
};

export default function PricingPage() {
  const links = getMarketingLinks();

  return (
    <SiteShell activePath="/pricing">
      <PageHero
        eyebrow="Offers"
        title="Free to learn. Plus when you want comfort and AI."
        description="Core prep stays free with short video ads. Prawko Plus is a one-time purchase that removes ads and unlocks the AI question assistant."
        actions={[
          {
            href: links.googlePlayUrl,
            label: "Get the app",
            variant: "primary",
          },
          {
            href: "/faq",
            label: "Read the FAQ",
            variant: "secondary",
          },
        ]}
      />

      <section className="section">
        <SectionTitle
          eyebrow="Plans"
          title="Two simple options."
          description="Students should immediately understand what is free, what Plus adds, and that there is no subscription."
        />
        <PricingGrid items={pricingTiers} />
      </section>

      <section className="section split-section">
        <div className="content-card">
          <SectionTitle
            eyebrow="Free tier"
            title="The full prep loop stays open."
            description="Study plan, unlimited practice, exam simulator, and pre-generated explanations remain available to every learner."
          />
        </div>
        <div className="content-card">
          <SectionTitle
            eyebrow="Plus"
            title="Pay once for no ads and AI chat."
            description="Plus is positioned as comfort and curiosity support — not as unlocking the exam itself."
          />
        </div>
      </section>

      <section className="section">
        <SectionTitle
          eyebrow="What the product sells"
          title="It is still one product, not two separate apps."
          description="The same learning engine powers free and Plus users. The difference is ads and AI assistant access."
        />
        <FeatureGrid items={landingHighlights} />
      </section>

      <ActionBand
        title="Ready to start preparing?"
        description="Download the app, build your study plan, and upgrade to Plus when you want an ad-free experience with AI help."
        actions={[
          {
            href: links.googlePlayUrl,
            label: "Get the app",
            variant: "primary",
          },
          {
            href: "/support",
            label: "Contact support",
            variant: "ghost",
          },
        ]}
      />
    </SiteShell>
  );
}
