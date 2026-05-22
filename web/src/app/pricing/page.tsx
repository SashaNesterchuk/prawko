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
        title="Price the value around the exam sprint, not around endless months."
        description="This project is optimized for short, dense preparation windows. The pricing surface reflects that reality: free preview, direct sprint purchase, longer premium, and school-issued access."
        actions={[
          {
            href: links.googlePlayUrl,
            label: "Get the app",
            variant: "primary",
          },
          {
            href: links.schoolInquiryUrl,
            label: "Ask about school pilot",
            variant: "secondary",
          },
        ]}
      />

      <section className="section">
        <SectionTitle
          eyebrow="Plans"
          title="Keep the first menu simple."
          description="A student should immediately understand whether they want to try the product, buy a short sprint, or unlock access from a school code."
        />
        <PricingGrid items={pricingTiers} />
      </section>

      <section className="section split-section">
        <div className="content-card">
          <SectionTitle
            eyebrow="Why this structure"
            title="The lifecycle is short, so the main offer should be short too."
            description="Pure subscription logic is weak here because the user often disappears right after the exam. The sprint package is the sharper default, while school codes keep the B2B door open."
          />
        </div>
        <div className="content-card">
          <SectionTitle
            eyebrow="Included value"
            title="Paid access exists to unlock the real prep loop."
            description="Unlimited question flow, adaptive repeat modes, full simulator access, and in-product AI explanation are the parts that change outcome quality."
          />
        </div>
      </section>

      <section className="section">
        <SectionTitle
          eyebrow="What the product sells"
          title="It is still one product, not four separate promises."
          description="The same core learning engine powers the free preview, the sprint offer, and school distribution. The differences are entitlement and support layers, not parallel products."
        />
        <FeatureGrid items={landingHighlights} />
      </section>

      <ActionBand
        title="Need school pricing instead of self-serve?"
        description="Use the school flow when a driving school wants to hand out time-boxed access codes to a cohort."
        actions={[
          {
            href: "/schools",
            label: "See school page",
            variant: "ghost",
          },
          {
            href: links.schoolInquiryUrl,
            label: "Start pilot conversation",
            variant: "primary",
          },
        ]}
      />
    </SiteShell>
  );
}
