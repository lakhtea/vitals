// The latest result of every health check an application has pushed for this
// site, worst first, so what is broken is read before what is fine. A leaf with
// no hooks: the Server Component renders it complete in the first HTML. The
// section carries id="health" so the attention strip can point at it.
import type { ReactElement } from "react";
import { checkSeverity, type CheckStatus } from "@/checks/status";
import { checkStatusLabel, checkStatusTone, formatCheckValue } from "../incidents";
import { EmptyState } from "./EmptyState";
import styles from "./HealthPanel.module.css";
import { RatingDot } from "./RatingDot";
import { SectionHeader } from "./SectionHeader";
import { Timestamp } from "./Timestamp";

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
  const tone = checkStatusTone(check.status);

  return (
    <li className={styles.check} data-tone={tone}>
      <div className={styles.checkHeading}>
        <h3 className={styles.name}>{check.name}</h3>
        <p className={styles.status}>
          <RatingDot rating={tone} />
          {checkStatusLabel(check.status)}
        </p>
      </div>
      {value !== null && <p className={styles.value}>{value}</p>}
      <p className={styles.meta}>
        Observed <Timestamp value={check.observedAt} />
      </p>
      {check.detail !== null && <p className={styles.detail}>{check.detail}</p>}
    </li>
  );
};

export const HealthPanel = ({ checks }: HealthPanelProps): ReactElement => {
  const sorted = [...checks].sort(worstFirst);

  return (
    <section id="health" className={styles.panel}>
      <SectionHeader
        title="Health checks"
        count={checks.length}
        description="The newest result each application pushed for this site. A failing check opens an incident."
      />
      {sorted.length === 0 ? (
        <EmptyState icon="checks" title="No health checks reported yet">
          Applications push them to <code>POST /api/checks</code>.
        </EmptyState>
      ) : (
        <ul className={styles.checks} role="list">
          {sorted.map((check) => (
            <CheckCell key={check.checkId} check={check} />
          ))}
        </ul>
      )}
    </section>
  );
};
