// The incident page, a Server Component: resolves one incident in-process
// (SchemaLink, no HTTP) so the evidence and timeline are complete in the first
// HTML. Only the decision form is client code, and after a decision it asks
// for this render again rather than patching the page in the browser.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactElement } from "react";
import { query } from "@/app/apollo/rsc-client";
import { toFixHistory, toFixRevisionData, toIncidentDetail } from "@/dashboard/adapters";
import { BackToOverview } from "@/dashboard/components/BackToOverview";
import { BrandLink } from "@/dashboard/components/Brand";
import { Callout } from "@/dashboard/components/Callout";
import { IncidentDecision } from "@/dashboard/components/IncidentDecision";
import { IncidentDetail } from "@/dashboard/components/IncidentDetail";
import { IncidentFixReview } from "@/dashboard/components/IncidentFixReview";
import styles from "@/dashboard/components/IncidentPage.module.css";
import { SectionHeader } from "@/dashboard/components/SectionHeader";
import { Toolbar } from "@/dashboard/components/Toolbar";
import { incidentTitle } from "@/dashboard/incidents";
import { SITE_TITLE } from "@/dashboard/labels";
import { INCIDENT } from "@/dashboard/queries";

interface IncidentPageProps {
  /** A Promise in this Next.js: dynamic segments resolve per request. */
  params: Promise<{ id: string }>;
}

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

  const isAwaitingHuman = incident.status === "awaiting-human";
  const hasApprovedRevision = found.approvedRevision !== null;

  return (
    <>
      <Toolbar brand={<BrandLink />} />
      <main className={styles.page}>
        <BackToOverview />
        <IncidentDetail incident={incident} />
        {latestRevision !== null && (
          <IncidentFixReview
            revision={toFixRevisionData(latestRevision)}
            history={toFixHistory(found.fixRevisions)}
            editable={editable}
          />
        )}
        <section className={styles.gate} aria-labelledby="decision-heading">
          <SectionHeader id="decision-heading" title="Your decision" />
          {(isAwaitingHuman || hasApprovedRevision) && (
            <div className={styles.callouts}>
              {isAwaitingHuman && (
                <Callout tone="waiting">
                  The agents have finished their steps and stopped here. Nothing leaves the repository until you
                  approve.
                </Callout>
              )}
              {found.approvedRevision !== null && (
                <Callout tone="approved">
                  Approved revision {found.approvedRevision.number}. That exact revision is what will become the pull
                  request.
                </Callout>
              )}
            </div>
          )}
          <IncidentDecision incidentId={incident.id} status={incident.status} revisionId={latestRevision?.id ?? null} />
        </section>
      </main>
    </>
  );
}
