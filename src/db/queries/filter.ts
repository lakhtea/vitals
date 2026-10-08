// The "for whom and when" filter shared by every traffic query: a half-open
// time window plus the two session dimensions. The window applies to when the
// navigation started (pageview start; session start for session lists), so a
// pageview's metrics always land in the same bucket as the pageview itself.
import { eq, sql, type SQL } from "drizzle-orm";
import type { ConnectionType, DeviceClass } from "@/vitals/dimensions";
import { sessions } from "../schema";

export interface TrafficFilter {
  /** Half-open [from, to) in epoch ms; null means unbounded. */
  from: number | null;
  to: number | null;
  deviceClass: DeviceClass | null;
  connectionType: ConnectionType | null;
}

export const UNFILTERED: TrafficFilter = { from: null, to: null, deviceClass: null, connectionType: null };

/** Dimension conditions for query-builder statements; `and()` skips the undefined ones. */
export const sessionDimensionConditions = (filter: TrafficFilter): Array<SQL | undefined> => [
  filter.deviceClass === null ? undefined : eq(sessions.deviceClass, filter.deviceClass),
  filter.connectionType === null ? undefined : eq(sessions.connectionType, filter.connectionType),
];

/** The same conditions for the raw window-function statement, where sessions is aliased `s`. */
export const sessionDimensionSql = (filter: TrafficFilter): SQL =>
  sql.join(
    [
      filter.deviceClass === null ? sql`` : sql`AND s.device_class = ${filter.deviceClass}`,
      filter.connectionType === null ? sql`` : sql`AND s.connection_type = ${filter.connectionType}`,
    ],
    sql` `,
  );

/** Stable string for grouping and memoising by filter. */
export const filterKey = (filter: TrafficFilter): string =>
  [filter.from, filter.to, filter.deviceClass, filter.connectionType].join("\u0000");
