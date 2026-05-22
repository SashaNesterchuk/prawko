import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AdminShell } from "../../../components/admin/AdminShell";
import { requireAdminSession } from "../../../lib/admin-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireAdminSession();

  return <AdminShell sessionEmail={session.email}>{children}</AdminShell>;
}
