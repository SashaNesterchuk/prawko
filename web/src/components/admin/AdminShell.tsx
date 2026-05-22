import Link from "next/link";
import type { ReactNode } from "react";

import { AdminNav } from "./AdminNav";

export function AdminShell({
  children,
  sessionEmail,
}: {
  children: ReactNode;
  sessionEmail: string;
}) {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-card">
          <Link href="/" className="admin-brand">
            <span className="brand-mark-chip">PL</span>
            <span>
              <strong>Prawko Admin</strong>
              <span className="brand-mark-copy">
                Backoffice for schools, imports, and AI quality
              </span>
            </span>
          </Link>

          <AdminNav />
        </div>

        <div className="admin-sidebar-card">
          <p className="section-kicker">Session</p>
          <p className="admin-session-email">{sessionEmail}</p>
          <div className="admin-sidebar-actions">
            <form action="/admin/auth/logout" method="post">
              <button className="secondary-button" type="submit">
                Sign out
              </button>
            </form>
            <Link href="/" className="action-link action-link-ghost">
              Public site
            </Link>
          </div>
        </div>
      </aside>

      <div className="admin-main">
        <div className="admin-main-inner">{children}</div>
      </div>
    </div>
  );
}
