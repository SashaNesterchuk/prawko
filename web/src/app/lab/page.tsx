import type { Metadata } from "next";

import { LabPageClient } from "../../components/lab/LabPageClient";

export const metadata: Metadata = {
  title: "Lab",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LabPage() {
  return <LabPageClient />;
}
