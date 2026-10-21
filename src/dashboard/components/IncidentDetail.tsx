// Everything about one incident except the decision form: the header band
// with its status and facts, the evidence that tripped the detector (the
// before/after comparison, or the check observation), and the timeline of
// recorded steps. Static so the route's Server Component renders it into the
// first HTML.
import type { ReactElement } from "react";
import type { CheckEvidence, IncidentEvidence } from "@/incidents/evidence";
import type { IncidentSource, IncidentStatus, StepRole, StepStatus } from "@/incidents/vocabulary";
import type { MetricName } from "@/vitals/metrics";
import {
  checkStatusLabel,
  checkStatusTone,
  describeStepDuration,
  describeStepUsage,
  formatCheckValue,
  incidentSourceLabel,
  incidentStatusLabel,
  incidentStatusTone,
  incidentTitle,
  stepRoleLabel,
  stepStatusLabel,
  stepStatusTone,
} from "../incidents";
import { Fact, FactList } from "./FactList";
import styles from "./IncidentDetail.module.css";
import { SectionHeader } from "./SectionHeader";
import { StatusPill } from "./StatusPill";
import { StepIcon } from "./StepIcon";
import { Timestamp } from "./Timestamp";
import { VitalsComparison } from "./VitalsComparison";

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

const CheckEvidenceFacts = ({ evidence }: { evidence: CheckEvidence }): ReactElement => {
  const value = formatCheckValue(evidence);
  const observations = evidence.consecutive === 1 ? "observation" : "observations";

  return (
    <FactList>
      <Fact label="Status">
        <StatusPill tone={checkStatusTone(evidence.status)} size="lg">
          {checkStatusLabel(evidence.status)}
        </StatusPill>
      </Fact>
      <Fact label="In a row">{`${evidence.consecutive} ${observations}`}</Fact>
      <Fact label="Previous status">
        {evidence.previousStatus === null ? "Not recorded" : checkStatusLabel(evidence.previousStatus)}
      </Fact>
      {value !== null && <Fact label="Value">{value}</Fact>}
      <Fact label="Observed (UTC)">
        <Timestamp value={evidence.observedAt} />
      </Fact>
      <Fact label="Check id">
        <code className={styles.code}>{evidence.checkId}</code>
      </Fact>
      {evidence.detail !== null && (
        <div className={styles.detailFact}>
          <dt className={styles.factLabel}>Detail</dt>
          <dd className={styles.well}>{evidence.detail}</dd>
        </div>
      )}
    </FactList>
  );
};

const Step = ({ step }: { step: IncidentStepData }): ReactElement => {
  const duration = describeStepDuration(step);
  const usage = describeStepUsage(step);
  const tone = stepStatusTone(step.status);

  return (
    <li className={styles.step}>
      <span className={styles.marker} data-tone={tone ?? "none"}>
        <StepIcon name={step.role} />
      </span>
      <div className={styles.stepBody}>
        <div className={styles.stepHeading}>
          <h3 className={styles.stepRole}>{stepRoleLabel(step.role)}</h3>
          <StatusPill tone={tone}>{stepStatusLabel(step.status)}</StatusPill>
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
      </div>
    </li>
  );
};

const EmptyTimeline = (): ReactElement => (
  <div className={styles.emptyTimeline}>
    <span className={styles.marker} data-tone="none">
      <StepIcon name="empty" />
    </span>
    <p>No steps yet. Decisions taken here are recorded in this timeline.</p>
  </div>
);

export const IncidentDetail = ({ incident }: IncidentDetailProps): ReactElement => (
  <article className={styles.article}>
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{incidentTitle(incident)}</h1>
        <StatusPill tone={incidentStatusTone(incident.status)} size="lg">
          {incidentStatusLabel(incident.status)}
        </StatusPill>
      </div>
      <FactList>
        <Fact label="Source">{incidentSourceLabel(incident.source)}</Fact>
        <Fact label="Detected (UTC)">
          <Timestamp value={incident.detectedAt} />
        </Fact>
        {incident.resolvedAt !== null && (
          <Fact label="Resolved (UTC)">
            <Timestamp value={incident.resolvedAt} />
          </Fact>
        )}
      </FactList>
      {incident.note !== null && (
        <blockquote className={styles.note}>
          <span className={styles.noteLabel}>Note</span>
          <p className={styles.noteText}>{incident.note}</p>
        </blockquote>
      )}
    </header>

    <section className={styles.section} aria-labelledby="evidence-heading">
      <SectionHeader id="evidence-heading" title="Evidence" />
      {incident.evidence.kind === "web-vitals" ? (
        <VitalsComparison evidence={incident.evidence} />
      ) : (
        <CheckEvidenceFacts evidence={incident.evidence} />
      )}
    </section>

    <section className={styles.section} aria-labelledby="timeline-heading">
      <SectionHeader id="timeline-heading" title="Timeline" />
      {incident.steps.length === 0 ? (
        <EmptyTimeline />
      ) : (
        <ol className={styles.timeline} aria-label="Timeline" role="list">
          {incident.steps.map((step) => (
            <Step key={step.id} step={step} />
          ))}
        </ol>
      )}
    </section>
  </article>
);
