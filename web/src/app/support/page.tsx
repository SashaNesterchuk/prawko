import type { Metadata } from "next";

import { getMarketingLinks } from "../../lib/marketing-links";
import { supportCards } from "../../components/marketing/site-content";
import {
  ActionBand,
  FeatureGrid,
  PageHero,
  SectionTitle,
  SiteShell,
} from "../../components/marketing/site-shell";

export const metadata: Metadata = {
  title: "Support",
};

export default function SupportPage() {
  const links = getMarketingLinks();

  return (
    <SiteShell activePath="/support">
      <PageHero
        eyebrow="Support"
        title="Keep support focused on clear reports, not vague panic."
        description="The support surface should help students unblock access, help schools resolve rollout issues, and help the team isolate content or AI failures fast."
        actions={[
          {
            href: links.supportEmailHref,
            label: links.supportEmail,
            variant: "primary",
            external: true,
          },
          {
            href: links.schoolInquiryUrl,
            label: "School inquiries",
            variant: "secondary",
            external: true,
          },
        ]}
      />

      <section className="section">
        <SectionTitle
          eyebrow="Channels"
          title="What belongs in support."
          description="Direct the user to one obvious place depending on whether the issue is access, content, or school rollout."
        />
        <FeatureGrid items={supportCards} />
      </section>

      <section className="section split-section">
        <div className="content-card">
          <SectionTitle
            eyebrow="For question issues"
            title="What to include in a useful content report."
            description="Send the question id, selected answer, expected answer, and a short note explaining what feels wrong or misleading."
          />
        </div>
        <div className="content-card">
          <SectionTitle
            eyebrow="For technical issues"
            title="What to include in a useful bug report."
            description="Share platform, device, login status, and a short reproducible path. “It broke” is not actionable. A three-step repro usually is."
          />
        </div>
      </section>

      <ActionBand
        title="Need legal or FAQ context before contacting support?"
        description="A lean support page works best when it sits next to the practical FAQ and the basic legal pages."
        actions={[
          {
            href: "/faq",
            label: "Open FAQ",
            variant: "ghost",
          },
          {
            href: "/legal/privacy",
            label: "Privacy",
            variant: "secondary",
          },
        ]}
      />
    </SiteShell>
  );
}
