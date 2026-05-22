"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ADMIN_LINKS = [
  {
    href: "/admin",
    label: "Overview",
  },
  {
    href: "/admin/school-codes",
    label: "School Codes",
  },
  {
    href: "/admin/import-health",
    label: "Import Health",
  },
  {
    href: "/admin/ai-review",
    label: "AI Review",
  },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav" aria-label="Admin">
      {ADMIN_LINKS.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={isActive ? "admin-nav-link admin-nav-link-active" : "admin-nav-link"}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
