// GraphQL enums for the domain vocabulary. Values come from src/vitals,
// src/checks, and src/incidents so the schema cannot drift from the database;
// names need spelling out because GraphQL enum values cannot contain hyphens.
import { CHECK_STATUSES } from "@/checks/status";
import { FILE_ACTIONS, FIX_AUTHORS } from "@/incidents/fix";
import { INCIDENT_SOURCES, INCIDENT_STATUSES, STEP_ROLES, STEP_STATUSES } from "@/incidents/vocabulary";
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

/** Exported so code that prints a dimension value (the incident breakdown) uses the wire spelling. */
export const DEVICE_CLASS_ENUM_VALUES = {
  DESKTOP: { value: "desktop" },
  MOBILE: { value: "mobile" },
  TABLET: { value: "tablet" },
  UNKNOWN: { value: "unknown" },
} as const;

export const CONNECTION_TYPE_ENUM_VALUES = {
  SLOW_2G: { value: "slow-2g" },
  TWO_G: { value: "2g" },
  THREE_G: { value: "3g" },
  FOUR_G: { value: "4g" },
  UNKNOWN: { value: "unknown" },
} as const;

export const DeviceClassEnum = builder.enumType("DeviceClass", { values: DEVICE_CLASS_ENUM_VALUES });

export const ConnectionTypeEnum = builder.enumType("ConnectionType", { values: CONNECTION_TYPE_ENUM_VALUES });

/** The wire name for a database value, e.g. "4g" -> "FOUR_G". */
export const enumNameOf = (
  values: Readonly<Record<string, { readonly value: string }>>,
  value: string,
): string => Object.entries(values).find(([, entry]) => entry.value === value)?.[0] ?? value;

/**
 * "fix-proposed" on the database side becomes FIX_PROPOSED on the wire, the
 * same convention the hand-written enums above follow. Derived rather than
 * typed out so adding a status to the vocabulary is one edit, not two.
 * (ConnectionType stays hand-written: "2g" would not be a legal enum name.)
 */
const toEnumValues = <Value extends string>(values: readonly Value[]): Record<string, { value: Value }> =>
  Object.fromEntries(values.map((value) => [value.toUpperCase().replaceAll("-", "_"), { value }]));

export const CheckStatusEnum = builder.enumType("CheckStatus", {
  description: "What an application reported about one of its checks.",
  values: toEnumValues(CHECK_STATUSES),
});

export const IncidentSourceEnum = builder.enumType("IncidentSource", {
  description: "Which detector opened the incident.",
  values: toEnumValues(INCIDENT_SOURCES),
});

export const IncidentStatusEnum = builder.enumType("IncidentStatus", {
  description:
    "Where an incident is in its life. Agents walk OPEN through AWAITING_HUMAN; a human APPROVES or DISMISSES; the detector RESOLVES.",
  values: toEnumValues(INCIDENT_STATUSES),
});

export const StepRoleEnum = builder.enumType("StepRole", {
  description: "Who took a step on an incident: one of the agent roles, or the human.",
  values: toEnumValues(STEP_ROLES),
});

export const StepStatusEnum = builder.enumType("StepStatus", {
  values: toEnumValues(STEP_STATUSES),
});

export const FixAuthorEnum = builder.enumType("FixAuthor", {
  description: "Who wrote a fix revision: an agent proposing it, or a person editing it.",
  values: toEnumValues(FIX_AUTHORS),
});

export const FileActionEnum = builder.enumType("FileAction", {
  description: "What a fix revision does to one file.",
  values: toEnumValues(FILE_ACTIONS),
});
