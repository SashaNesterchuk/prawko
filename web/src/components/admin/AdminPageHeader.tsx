import type { ReactNode } from "react";

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  aside,
}: {
  aside?: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <section className="admin-page-header">
      <div>
        <p className="section-kicker">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {aside ? <div className="admin-page-header-aside">{aside}</div> : null}
    </section>
  );
}

export function AdminMessage({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "error" | "info" | "success";
}) {
  return (
    <div
      className={
        tone === "error"
          ? "admin-message admin-message-error"
          : tone === "success"
            ? "admin-message admin-message-success"
            : "admin-message"
      }
    >
      {children}
    </div>
  );
}
