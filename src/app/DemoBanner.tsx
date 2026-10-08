// One-line notice for the public demo (VITALS_DEMO_MODE=1): tells visitors the
// data is synthetic and ephemeral. A server component, so the env check never
// reaches the browser bundle; it renders nothing outside demo mode.
import type { ReactElement } from "react";
import { isDemoMode } from "@/config/demo-mode";

const bannerStyle = {
  padding: "0.5rem 1rem",
  textAlign: "center",
  fontSize: "0.875rem",
  color: "var(--foreground)",
  background: "var(--background)",
  borderBottom: "1px solid color-mix(in srgb, var(--foreground) 20%, transparent)",
} as const;

export const DemoBanner = (): ReactElement | null => {
  if (!isDemoMode()) {
    return null;
  }
  return (
    <p role="status" style={bannerStyle}>
      Demo mode: synthetic data, resets on each cold start.
    </p>
  );
};
