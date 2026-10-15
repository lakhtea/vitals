// The vocabulary of a health check result: the three states any application
// can report, worst first so a list can sort by severity without a lookup.
export const CHECK_STATUSES = ["failing", "degraded", "ok"] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];

/** Lower is worse; used to sort a health panel so what is broken comes first. */
export const checkSeverity = (status: CheckStatus): number => CHECK_STATUSES.indexOf(status);
