// The incident page, a Server Component: resolves one incident in-process
// (SchemaLink, no HTTP) so the evidence and timeline are complete in the first
// HTML. Only the decision form is client code, and after a decision it asks
// for this render again rather than patching the page in the browser.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactElement } from "react";
import { query } from "@/app/apollo/rsc-client";
import { toFixHistory, toFixRevisionData, toIncidentDetail } from "@/dashboard/adapters";
import { IncidentDecision } from "@/dashboard/components/IncidentDecision";
import { IncidentDetail } from "@/dashboard/components/IncidentDetail";
import { IncidentFixReview } from "@/dashboard/components/IncidentFixReview";
import styles from "@/dashboard/components/IncidentPage.module.css";
import { incidentTitle } from "@/dashboard/incidents";
import { INCIDENT } from "@/dashboard/queries";

interface IncidentPageProps {
  /** A Promise in this Next.js: dynamic segments resolve per request. */
  params: Promise<{ id: string }>;
}

const SITE_TITLE = "Vitals";

/**
 * "LCP on /pricing - Vitals" rather than the root layout's plain "Vitals", so
 * tabs, history, and screen readers can tell incidents apart. The query is the
 * page's own; Apollo's per-request cache answers the second ask.
 */
export async function generateMetadata({ params }: IncidentPageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await query({ query: INCIDENT, variables: { id } });
  const found = result.data?.incident ?? null;
  if (found === null) {
    return { title: `Incident not found - ${SITE_TITLE}` };
  }
  return { title: `${incidentTitle(toIncidentDetail(found))} - ${SITE_TITLE}` };
}

export default async function IncidentPage({ params }: IncidentPageProps): Promise<ReactElement> {
  // The incident changes when a person decides; never prerender it.
  await connection();
  const { id } = await params;
  const result = await query({ query: INCIDENT, variables: { id } });
  const found = result.data?.incident ?? null;
  if (found === null) {
    notFound();
  }
  const incident = toIncidentDetail(found);
  const latestRevision = found.latestFixRevision;
  // A proposal can be edited until someone decides; after approval the pinned revision is final.
  const editable = incident.status !== "approved" && incident.status !== "dismissed" && incident.status !== "resolved";

  return (
    <main className={styles.page}>
      <nav aria-label="Breadcrumb">
        <Link href="/" className={styles.back}>
          Back to the overview
        </Link>
      </nav>
      <IncidentDetail incident={incident} />
      {latestRevision !== null && (
        <IncidentFixReview
          revision={toFixRevisionData(latestRevision)}
          history={toFixHistory(found.fixRevisions)}
          editable={editable}
        />
      )}
      <section className={styles.gate} aria-labelledby="decision-heading">
        <h2 id="decision-heading" className={styles.gateTitle}>
          Your decision
        </h2>
        {incident.status === "awaiting-human" && (
          <p className={styles.callout}>
            The agents have finished their steps and stopped here. Nothing leaves the repository until you approve.
          </p>
        )}
        {found.approvedRevision !== null && (
          <p className={styles.callout}>
            Approved revision {found.approvedRevision.number}. That exact revision is what will become the pull request.
          </p>
        )}
        <IncidentDecision incidentId={incident.id} status={incident.status} revisionId={latestRevision?.id ?? null} />
      </section>
    </main>
  );
}
