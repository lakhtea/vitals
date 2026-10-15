// The latest result of every health check an application has pushed for this
// site, worst first, so what is broken is read before what is fine. A leaf with
// no hooks: the Server Component renders it complete in the first HTML.
import type { ReactElement } from "react";
import { checkSeverity, type CheckStatus } from "@/checks/status";
import { formatDateTime } from "../dates";
import { checkStatusLabel, checkStatusTone, formatCheckValue, isoTimestamp } from "../incidents";
import styles from "./HealthPanel.module.css";

export interface HealthCheckData {
  checkId: string;
  name: string;
  status: CheckStatus;
  value: number | null;
  unit: string | null;
  /** ISO string or epoch milliseconds. */
  observedAt: string | number;
  detail: string | null;
}

export interface HealthPanelProps {
  /** The newest observation per check; the panel sorts them itself. */
  checks: HealthCheckData[];
}

const worstFirst = (a: HealthCheckData, b: HealthCheckData): number =>
  checkSeverity(a.status) - checkSeverity(b.status) || a.name.localeCompare(b.name);

const CheckCell = ({ check }: { check: HealthCheckData }): ReactElement => {
  const value = formatCheckValue(check);

  return (
    <li className={styles.check} data-tone={checkStatusTone(check.status)}>
      <h3 className={styles.name}>{check.name}</h3>
      <p className={styles.pill}>{checkStatusLabel(check.status)}</p>
      {value !== null && <p className={styles.value}>{value}</p>}
      <p className={styles.meta}>
        Observed <time dateTime={isoTimestamp(check.observedAt)}>{formatDateTime(check.observedAt)}</time>
      </p>
      {check.detail !== null && <p className={styles.detail}>{check.detail}</p>}
    </li>
  );
};

export const HealthPanel = ({ checks }: HealthPanelProps): ReactElement => {
  const sorted = [...checks].sort(worstFirst);

  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>Health checks</h2>
      <p className={styles.explanation}>
        The newest result each application pushed for this site. A failing check opens an incident.
      </p>
      {sorted.length === 0 ? (
        <p className={styles.empty}>
          No health checks reported yet. Applications push them to <code>POST /api/checks</code>.
        </p>
      ) : (
        <ul className={styles.checks}>
          {sorted.map((check) => (
            <CheckCell key={check.checkId} check={check} />
          ))}
        </ul>
      )}
    </section>
  );
};
