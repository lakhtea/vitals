// Display names for the GraphQL dimension enums ("SLOW_2G" reads as "Slow 2G").
// Keyed by the generated enum types so a new schema value is a typecheck
// failure here rather than a raw constant leaking into the UI.
import type { ConnectionType, DeviceClass } from "@/graphql/generated/graphql";

export const DEVICE_CLASS_LABELS: Record<DeviceClass, string> = {
  DESKTOP: "Desktop",
  MOBILE: "Mobile",
  TABLET: "Tablet",
  UNKNOWN: "Unknown",
};

export const CONNECTION_TYPE_LABELS: Record<ConnectionType, string> = {
  SLOW_2G: "Slow 2G",
  TWO_G: "2G",
  THREE_G: "3G",
  FOUR_G: "4G",
  UNKNOWN: "Unknown",
};

const KNOWN_LABELS: Record<string, string> = {
  ...DEVICE_CLASS_LABELS,
  ...CONNECTION_TYPE_LABELS,
};

/** "SOME_VALUE" -> "Some value", for enum values this module has no name for yet. */
const humanize = (value: string): string => {
  const words = value.replace(/[_-]+/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export const dimensionLabel = (value: string): string => KNOWN_LABELS[value] ?? humanize(value);
