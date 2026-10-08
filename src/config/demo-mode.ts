// The one switch for the public demo deployment. Set VITALS_DEMO_MODE=1 (the
// only recognised value) to run against an ephemeral seeded SQLite in the OS
// temp dir, disable GraphiQL, rate-cap /api/collect, and show the demo banner.
export const DEMO_MODE_ENV_VAR = "VITALS_DEMO_MODE";

export const isDemoMode = (): boolean => process.env[DEMO_MODE_ENV_VAR] === "1";
