// Health-check reads for one site. "Latest per check" is a window function so
// a site with thousands of observations per check still answers in one
// statement, ordered worst status first, the way a health panel reads.
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { CHECK_STATUSES } from "@/checks/status";
import type { Db } from "../index";
import { checks, type CheckRow } from "../schema";

/** failing, then degraded, then ok: the order CHECK_STATUSES declares (see checkSeverity). */
const severityOf = (column: SQL): SQL =>
  sql`CASE ${column} ${sql.join(
    CHECK_STATUSES.map((status, severity) => sql`WHEN ${status} THEN ${severity}`),
    sql` `,
  )} END`;

export const listLatestChecksForSite = ({ db, siteId }: { db: Db; siteId: string }): CheckRow[] =>
  db.all<CheckRow>(sql`
    WITH ranked AS (
      SELECT
        id, site_id, check_id, name, status, value, unit, observed_at, detail,
        ROW_NUMBER() OVER (PARTITION BY check_id ORDER BY observed_at DESC, id DESC) AS recency
      FROM checks
      WHERE site_id = ${siteId}
    )
    SELECT
      id,
      site_id AS siteId,
      check_id AS checkId,
      name,
      status,
      value,
      unit,
      observed_at AS observedAt,
      detail
    FROM ranked
    WHERE recency = 1
    ORDER BY ${severityOf(sql`status`)}, name, check_id
  `);

/** One check's past observations, newest first. */
export const listCheckHistory = ({
  db,
  siteId,
  checkId,
  limit,
}: {
  db: Db;
  siteId: string;
  checkId: string;
  limit: number;
}): CheckRow[] =>
  db
    .select()
    .from(checks)
    .where(and(eq(checks.siteId, siteId), eq(checks.checkId, checkId)))
    .orderBy(desc(checks.observedAt), desc(checks.id))
    .limit(limit)
    .all();
