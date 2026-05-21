import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Prawko | Polish Driving Theory Study Plan",
    template: "%s | Prawko",
  },
  description:
    "Prawko turns Polish driving theory prep into a day-by-day plan with adaptive practice, AI explanations, and school access codes.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
