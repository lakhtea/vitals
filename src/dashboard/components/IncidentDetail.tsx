// Everything about one incident except the decision form: the facts in its
// header, the evidence that tripped the detector (two windows side by side, or
// the check observation), and the timeline of recorded steps. Static so the
// route's Server Component renders it into the first HTML.
import type { ReactElement } from "react";
import type { CheckEvidence, IncidentEvidence, VitalsEvidence, WindowSummary } from "@/incidents/evidence";
import type { IncidentSource, IncidentStatus, StepRole, StepStatus } from "@/incidents/vocabulary";
import { formatMetricValue, formatSampleCount, ratingLabel } from "@/vitals/format";
import type { MetricName } from "@/vitals/metrics";
import { formatDateTime } from "../dates";
import {
  checkStatusLabel,
  checkStatusTone,
  describeStepDuration,
  describeStepUsage,
  formatCheckValue,
  formatRelativeIncrease,
  incidentSourceLabel,
  incidentStatusLabel,
  incidentStatusTone,
  incidentTitle,
  isoTimestamp,
  stepRoleLabel,
  stepStatusLabel,
  stepStatusTone,
  type PillTone,
} from "../incidents";
import styles from "./IncidentDetail.module.css";

export interface IncidentStepData {
  id: string;
  role: StepRole;
  status: StepStatus;
  startedAt: string | number;
  finishedAt: string | number | null;
  summary: string;
  detail: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  link: string | null;
}

export interface IncidentDetailData {
  id: string;
  source: IncidentSource;
  subject: string;
  metric: MetricName | null;
  status: IncidentStatus;
  detectedAt: string | number;
  updatedAt: string | number;
  resolvedAt: string | number | null;
  note: string | null;
  evidence: IncidentEvidence;
  steps: IncidentStepData[];
}

export interface IncidentDetailProps {
  incident: IncidentDetailData;
}

const Pill = ({ tone, children }: { tone: PillTone; children: string }): ReactElement => (
  <span className={styles.pill} data-tone={tone ?? "none"}>
    {children}
  </span>
);

const Timestamp = ({ value }: { value: string | number }): ReactElement => (
  <time dateTime={isoTimestamp(value)}>{formatDateTime(value)}</time>
);

const Fact = ({ label, children }: { label: string; children: ReactElement | string }): ReactElement => (
  <div className={styles.fact}>
    <dt className={styles.factLabel}>{label}</dt>
    <dd className={styles.factValue}>{children}</dd>
  </div>
);

const WindowRange = ({ window }: { window: WindowSummary }): ReactElement => (
  <>
    <Timestamp value={window.from} /> to <Timestamp value={window.to} />
  </>
);

const VitalsEvidenceTable = ({ evidence }: { evidence: VitalsEvidence }): ReactElement => {
  const { metric, baseline, current } = evidence;
  const p75 = (window: WindowSummary): string => formatMetricValue({ name: metric, value: window.p75 });

  return (
    <>
      {/* A named, focusable region: on a narrow screen the table scrolls sideways and has nothing focusable inside it. */}
      <div className={styles.scroller} role="region" aria-label="Baseline and current windows" tabIndex={0}>
        <table className={styles.comparison}>
          <caption className={styles.visuallyHidden}>
            {metric} on {evidence.path}: the baseline window compared with the current window
          </caption>
          <thead>
            <tr>
              <td />
              <th scope="col">Baseline</th>
              <th scope="col">Current</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Window (UTC)</th>
              <td>
                <WindowRange window={baseline} />
              </td>
              <td>
                <WindowRange window={current} />
              </td>
            </tr>
            <tr>
              <th scope="row">p75</th>
              <td className={styles.figure}>{p75(baseline)}</td>
              <td className={styles.figure}>{p75(current)}</td>
            </tr>
            <tr>
              <th scope="row">Rating</th>
              <td>
                <Pill tone={baseline.rating}>{ratingLabel(baseline.rating)}</Pill>
              </td>
              <td>
                <Pill tone={current.rating}>{ratingLabel(current.rating)}</Pill>
              </td>
            </tr>
            <tr>
              <th scope="row">Samples</th>
              <td>{formatSampleCount(baseline.sampleCount)}</td>
              <td>{formatSampleCount(current.sampleCount)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className={styles.change}>
        Change in p75: <strong>{formatRelativeIncrease(evidence.relativeIncrease)}</strong> against the baseline.
      </p>
    </>
  );
};

const CheckEvidenceFacts = ({ evidence }: { evidence: CheckEvidence }): ReactElement => {
  const value = formatCheckValue(evidence);
  const observations = evidence.consecutive === 1 ? "observation" : "observations";

  return (
    <dl className={styles.facts}>
      <Fact label="Check id">{evidence.checkId}</Fact>
      <Fact label="Status">
        <Pill tone={checkStatusTone(evidence.status)}>{checkStatusLabel(evidence.status)}</Pill>
      </Fact>
      <Fact label="Previous status">
        {evidence.previousStatus === null ? "Not recorded" : checkStatusLabel(evidence.previousStatus)}
      </Fact>
      <Fact label="In a row">{`${evidence.consecutive} ${observations}`}</Fact>
      {value !== null && <Fact label="Value">{value}</Fact>}
      <Fact label="Observed (UTC)">
        <Timestamp value={evidence.observedAt} />
      </Fact>
      {evidence.detail !== null && <Fact label="Detail">{evidence.detail}</Fact>}
    </dl>
  );
};

const Step = ({ step }: { step: IncidentStepData }): ReactElement => {
  const duration = describeStepDuration(step);
  const usage = describeStepUsage(step);

  return (
    <li className={styles.step} data-tone={stepStatusTone(step.status) ?? "none"}>
      <div className={styles.stepHeading}>
        <h3 className={styles.stepRole}>{stepRoleLabel(step.role)}</h3>
        <Pill tone={stepStatusTone(step.status)}>{stepStatusLabel(step.status)}</Pill>
        <p className={styles.stepTime}>
          <Timestamp value={step.startedAt} />
          {duration !== null && ` · ${duration}`}
        </p>
      </div>
      <p className={styles.stepSummary}>{step.summary}</p>
      {step.detail !== null && <p className={styles.stepDetail}>{step.detail}</p>}
      {usage !== null && <p className={styles.stepUsage}>{usage}</p>}
      {step.link !== null && (
        <a href={step.link} className={styles.stepLink}>
          {step.link}
        </a>
      )}
    </li>
  );
};

export const IncidentDetail = ({ incident }: IncidentDetailProps): ReactElement => (
  <article className={styles.article}>
    <header className={styles.header}>
      <h1 className={styles.title}>{incidentTitle(incident)}</h1>
      <dl className={styles.facts}>
        <Fact label="Status">
          <Pill tone={incidentStatusTone(incident.status)}>{incidentStatusLabel(incident.status)}</Pill>
        </Fact>
        <Fact label="Source">{incidentSourceLabel(incident.source)}</Fact>
        <Fact label="Detected (UTC)">
          <Timestamp value={incident.detectedAt} />
        </Fact>
        {incident.resolvedAt !== null && (
          <Fact label="Resolved (UTC)">
            <Timestamp value={incident.resolvedAt} />
          </Fact>
        )}
      </dl>
      {incident.note !== null && (
        <p className={styles.note}>
          <strong>Note:</strong> {incident.note}
        </p>
      )}
    </header>

    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Evidence</h2>
      {incident.evidence.kind === "web-vitals" ? (
        <VitalsEvidenceTable evidence={incident.evidence} />
      ) : (
        <CheckEvidenceFacts evidence={incident.evidence} />
      )}
    </section>

    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Timeline</h2>
      {incident.steps.length === 0 ? (
        <p className={styles.emptyTimeline}>No steps yet. Decisions taken here are recorded in this timeline.</p>
      ) : (
        <ol className={styles.timeline} aria-label="Timeline">
          {incident.steps.map((step) => (
            <Step key={step.id} step={step} />
          ))}
        </ol>
      )}
    </section>
  </article>
);
