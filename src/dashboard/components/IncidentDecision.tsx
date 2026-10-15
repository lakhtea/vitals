"use client";

// The human gate's wiring: runs the approve or dismiss mutation, then asks
// Next.js to re-render the page's Server Components so the header, note, and
// timeline show the decision. The only client code on the incident page; the
// evidence and timeline stay server-rendered.
import { useMutation } from "@apollo/client/react";
import { useRouter } from "next/navigation";
import { useTransition, type ReactElement } from "react";
import type { HumanDecision, IncidentStatus } from "@/incidents/vocabulary";
import { APPROVE_INCIDENT, DISMISS_INCIDENT } from "../queries";
import { IncidentActions } from "./IncidentActions";

export interface IncidentDecisionProps {
  incidentId: string;
  status: IncidentStatus;
}

export const IncidentDecision = ({ incidentId, status }: IncidentDecisionProps): ReactElement => {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [approve, approveState] = useMutation(APPROVE_INCIDENT);
  const [dismiss, dismissState] = useMutation(DISMISS_INCIDENT);
  // Busy until the refreshed server render lands, so the old buttons never flash back between the two.
  const busy = approveState.loading || dismissState.loading || isRefreshing;
  const error = approveState.error?.message ?? dismissState.error?.message ?? null;

  const decide = async (decision: HumanDecision, note: string): Promise<void> => {
    const variables = { id: incidentId, note: note === "" ? null : note };
    const mutate = decision === "approved" ? approve : dismiss;
    try {
      await mutate({ variables });
    } catch {
      // Apollo rejects on a GraphQL error and also records it on the hook; `error` above renders it.
      return;
    }
    startRefresh(() => router.refresh());
  };

  return <IncidentActions status={status} onDecide={(decision, note) => void decide(decision, note)} busy={busy} error={error} />;
};
