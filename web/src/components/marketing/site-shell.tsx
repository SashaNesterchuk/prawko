import Link from "next/link";
import type { ReactNode } from "react";

import { getMarketingLinks } from "../../lib/marketing-links";
import { footerGroups, siteNavigation } from "./site-content";

type HeroAction = {
  href: string;
  label: string;
  variant?: "primary" | "secondary" | "ghost";
  external?: boolean;
};

type SectionTitleProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

type StatItem = {
  label: string;
  value: string;
  detail?: string;
};

type FeatureItem = {
  eyebrow?: string;
  title: string;
  description: string;
};

type PricingTier = {
  badge: string;
  title: string;
  price: string;
  subtitle: string;
  features: readonly string[];
};

type FAQItem = {
  question: string;
  answer: string;
};

export function SiteShell({
  activePath,
  children,
}: {
  activePath?: string;
  children: ReactNode;
}) {
  const links = getMarketingLinks();

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/" className="brand-mark">
            <span className="brand-mark-chip">PL</span>
            <span>
              <strong>Prawko</strong>
              <span className="brand-mark-copy">
                Study plan for the Polish theory exam
              </span>
            </span>
          </Link>

          <nav className="site-nav" aria-label="Primary">
            {siteNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  activePath === item.href
                    ? "site-nav-link site-nav-link-active"
                    : "site-nav-link"
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="site-header-actions">
            <ActionLink
              href={links.schoolInquiryUrl}
              label="For schools"
              variant="ghost"
              external={isExternalHref(links.schoolInquiryUrl)}
            />
            <ActionLink
              href={links.googlePlayUrl}
              label="Get the app"
              variant="primary"
              external={isExternalHref(links.googlePlayUrl)}
            />
          </div>
        </div>
      </header>

      <main className="site-frame">{children}</main>

      <footer className="site-footer">
        <div className="site-footer-grid">
          <div className="site-footer-intro">
            <p className="section-kicker">Prawko</p>
            <h2>Built around the real pain of exam prep in Poland.</h2>
            <p>
              The first version focuses on a sharper daily plan, better repeat
              loops, clear AI explanations, and a school-access model that can
              actually close.
            </p>
            <div className="site-footer-actions">
              <ActionLink
                href={links.appStoreUrl}
                label="App Store"
                variant="secondary"
                external={isExternalHref(links.appStoreUrl)}
              />
              <ActionLink
                href={links.googlePlayUrl}
                label="Google Play"
                variant="secondary"
                external={isExternalHref(links.googlePlayUrl)}
              />
            </div>
          </div>

          <div className="site-footer-links">
            {footerGroups.map((group) => (
              <section key={group.title}>
                <p className="site-footer-title">{group.title}</p>
                <ul className="site-footer-list">
                  {group.links.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href} className="site-footer-link">
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  description,
  actions = [],
  aside,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: HeroAction[];
  aside?: ReactNode;
}) {
  return (
    <section className="hero-section">
      <div className="hero-grid">
        <div className="hero-copy-block">
          {eyebrow ? <p className="section-kicker">{eyebrow}</p> : null}
          <h1 className="hero-title">{title}</h1>
          <p className="hero-description">{description}</p>
          {actions.length ? (
            <div className="hero-actions">
              {actions.map((action) => (
                <ActionLink
                  key={`${action.href}:${action.label}`}
                  {...action}
                />
              ))}
            </div>
          ) : null}
        </div>

        {aside ? <div className="hero-aside">{aside}</div> : null}
      </div>
    </section>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  description,
}: SectionTitleProps) {
  return (
    <div className="section-title">
      {eyebrow ? <p className="section-kicker">{eyebrow}</p> : null}
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export function StatGrid({ items }: { items: readonly StatItem[] }) {
  return (
    <section className="section">
      <div className="stat-grid">
        {items.map((item) => (
          <article key={item.label} className="stat-card">
            <p className="stat-label">{item.label}</p>
            <p className="stat-value">{item.value}</p>
            {item.detail ? <p className="stat-detail">{item.detail}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export function FeatureGrid({
  items,
}: {
  items: readonly FeatureItem[];
}) {
  return (
    <div className="feature-grid">
      {items.map((item) => (
        <article key={item.title} className="feature-card">
          {item.eyebrow ? <p className="section-kicker">{item.eyebrow}</p> : null}
          <h3>{item.title}</h3>
          <p>{item.description}</p>
        </article>
      ))}
    </div>
  );
}

export function StepGrid({ items }: { items: readonly FeatureItem[] }) {
  return (
    <div className="step-grid">
      {items.map((item, index) => (
        <article key={item.title} className="step-card">
          <p className="step-index">0{index + 1}</p>
          <h3>{item.title}</h3>
          <p>{item.description}</p>
        </article>
      ))}
    </div>
  );
}

export function PricingGrid({ items }: { items: readonly PricingTier[] }) {
  return (
    <div className="pricing-grid">
      {items.map((item) => (
        <article key={item.title} className="pricing-card">
          <p className="pricing-badge">{item.badge}</p>
          <h3>{item.title}</h3>
          <p className="pricing-price">{item.price}</p>
          <p className="pricing-subtitle">{item.subtitle}</p>
          <ul className="card-list">
            {item.features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

export function FAQList({ items }: { items: readonly FAQItem[] }) {
  return (
    <div className="faq-list">
      {items.map((item) => (
        <details key={item.question} className="faq-card">
          <summary>{item.question}</summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

export function ActionBand({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions: HeroAction[];
}) {
  return (
    <section className="section">
      <div className="action-band">
        <div>
          <p className="section-kicker">Next step</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="hero-actions">
          {actions.map((action) => (
            <ActionLink key={`${action.href}:${action.label}`} {...action} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ActionLink({
  href,
  label,
  variant = "secondary",
  external = false,
}: HeroAction) {
  const className =
    variant === "primary"
      ? "action-link action-link-primary"
      : variant === "ghost"
        ? "action-link action-link-ghost"
        : "action-link action-link-secondary";

  if (external || isExternalHref(href)) {
    return (
      <a
        className={className}
        href={href}
        rel="noreferrer"
        target={href.startsWith("mailto:") ? undefined : "_blank"}
      >
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

function isExternalHref(href: string) {
  return (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:")
  );
}
