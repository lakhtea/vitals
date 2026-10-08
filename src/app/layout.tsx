// The root HTML shell. Every page renders inside Providers so Apollo is available.
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Vitals",
  description: "Core Web Vitals from real sessions, self-hosted. A GraphQL analytics dashboard.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
