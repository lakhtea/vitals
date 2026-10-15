// The incident page, a Server Component: resolves one incident in-process
// (SchemaLink, no HTTP) so the evidence and timeline are complete in the first
// HTML. Only the decision form is client code, and after a decision it asks
// for this render again rather than patching the page in the browser.
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactElement } from "react";
import { query } from "@/app/apollo/rsc-client";
import { toIncidentDetail } from "@/dashboard/adapters";
import { IncidentDecision } from "@/dashboard/components/IncidentDecision";
import { IncidentDetail } from "@/dashboard/components/IncidentDetail";
import styles from "@/dashboard/components/IncidentPage.module.css";
import { INCIDENT } from "@/dashboard/queries";

interface IncidentPageProps {
  /** A Promise in this Next.js: dynamic segments resolve per request. */
  params: Promise<{ id: string }>;
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

  return (
    <main className={styles.page}>
      <nav aria-label="Breadcrumb">
        <Link href="/" className={styles.back}>
          Back to the overview
        </Link>
      </nav>
      <IncidentDetail incident={incident} />
      <section className={styles.gate} aria-labelledby="decision-heading">
        <h2 id="decision-heading" className={styles.gateTitle}>
          Your decision
        </h2>
        <IncidentDecision incidentId={incident.id} status={incident.status} />
      </section>
    </main>
  );
}
