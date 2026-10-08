// GraphQL enums for the domain vocabulary. Values come from src/vitals so the
// schema cannot drift from the database; MetricRating needs explicit names
// because GraphQL enum values cannot contain hyphens.
import { METRIC_NAMES } from "@/vitals/metrics";
import { builder } from "./builder";

export const MetricNameEnum = builder.enumType("MetricName", { values: METRIC_NAMES });

export const MetricRatingEnum = builder.enumType("MetricRating", {
  values: {
    GOOD: { value: "good" },
    NEEDS_IMPROVEMENT: { value: "needs-improvement" },
    POOR: { value: "poor" },
  } as const,
});

export const DeviceClassEnum = builder.enumType("DeviceClass", {
  values: {
    DESKTOP: { value: "desktop" },
    MOBILE: { value: "mobile" },
    TABLET: { value: "tablet" },
    UNKNOWN: { value: "unknown" },
  } as const,
});

export const ConnectionTypeEnum = builder.enumType("ConnectionType", {
  values: {
    SLOW_2G: { value: "slow-2g" },
    TWO_G: { value: "2g" },
    THREE_G: { value: "3g" },
    FOUR_G: { value: "4g" },
    UNKNOWN: { value: "unknown" },
  } as const,
});
