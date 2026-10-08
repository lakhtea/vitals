// The root HTML shell. ApolloWrapper gives every client component the same
// per-request Apollo client; DemoBanner renders only when VITALS_DEMO_MODE=1.
import type { Metadata } from "next";
import "./globals.css";
import { ApolloWrapper } from "./apollo/ApolloWrapper";
import { DemoBanner } from "./DemoBanner";

export const metadata: Metadata = {
  title: "Vitals",
  description: "Core Web Vitals from real sessions, self-hosted. A GraphQL analytics dashboard.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DemoBanner />
        <ApolloWrapper>{children}</ApolloWrapper>
      </body>
    </html>
  );
}
