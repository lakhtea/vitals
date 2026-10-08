// The dashboard's filter state and its translation into the GraphQL
// TrafficFilter input. The UI thinks in "last 7 days"; the API thinks in
// absolute ISO timestamps; this module is the only place that converts.
import type { ConnectionType, DeviceClass } from "@/graphql/generated/graphql";

export type TimeRangeKey = "24h" | "7d" | "30d" | "all";

export interface DashboardFilters {
  range: TimeRangeKey;
  deviceClass: DeviceClass | null;
  connectionType: ConnectionType | null;
}

export const DEFAULT_FILTERS: DashboardFilters = {
  range: "7d",
  deviceClass: null,
  connectionType: null,
};

export const TIME_RANGE_OPTIONS: ReadonlyArray<{ key: TimeRangeKey; label: string }> = [
  { key: "24h", label: "Last 24 hours" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "all", label: "All time" },
];

// Display order for the selects; the generated unions are alphabetical.
export const DEVICE_CLASS_OPTIONS = ["DESKTOP", "MOBILE", "TABLET", "UNKNOWN"] as const satisfies readonly DeviceClass[];

export const CONNECTION_TYPE_OPTIONS = [
  "SLOW_2G",
  "TWO_G",
  "THREE_G",
  "FOUR_G",
  "UNKNOWN",
] as const satisfies readonly ConnectionType[];

export const isDefaultFilters = (filters: DashboardFilters): boolean =>
  filters.range === DEFAULT_FILTERS.range &&
  filters.deviceClass === DEFAULT_FILTERS.deviceClass &&
  filters.connectionType === DEFAULT_FILTERS.connectionType;

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

const RANGE_DURATION_MS: Record<Exclude<TimeRangeKey, "all">, number> = {
  "24h": MS_PER_DAY,
  "7d": 7 * MS_PER_DAY,
  "30d": 30 * MS_PER_DAY,
};

/** The shape of the GraphQL TrafficFilter variable, with every field present. */
export interface TrafficFilterVariables {
  from: string | null;
  to: null;
  deviceClass: DeviceClass | null;
  connectionType: ConnectionType | null;
}

export const toTrafficFilter = ({
  filters,
  now,
}: {
  filters: DashboardFilters;
  /** Epoch milliseconds, passed in so the window is reproducible. */
  now: number;
}): TrafficFilterVariables => {
  const from = filters.range === "all" ? null : new Date(now - RANGE_DURATION_MS[filters.range]).toISOString();
  return {
    from,
    to: null,
    deviceClass: filters.deviceClass,
    connectionType: filters.connectionType,
  };
};
