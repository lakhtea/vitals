// What the overview should say before anything else: how many incidents still
// need someone and how many checks are not OK. Pure, so the strip's wording
// and the "all clear" rule are tested without rendering.
import type { CheckStatus } from "@/checks/status";
import { isTerminalIncidentStatus, type IncidentStatus } from "@/incidents/vocabulary";

export interface AttentionSummary {
  /** Incidents in any non-terminal state: open through approved. */
  openIncidents: number;
  failingChecks: number;
  degradedChecks: number;
}

export const summarizeAttention = ({
  incidents,
  checks,
}: {
  incidents: ReadonlyArray<{ status: IncidentStatus }>;
  checks: ReadonlyArray<{ status: CheckStatus }>;
}): AttentionSummary => ({
  openIncidents: incidents.filter((incident) => !isTerminalIncidentStatus(incident.status)).length,
  failingChecks: checks.filter((check) => check.status === "failing").length,
  degradedChecks: checks.filter((check) => check.status === "degraded").length,
});

export const isAllClear = (summary: AttentionSummary): boolean =>
  summary.openIncidents === 0 && summary.failingChecks === 0 && summary.degradedChecks === 0;

export interface AttentionItem {
  /** "2 open incidents", "1 failing check". */
  label: string;
  /** The section the item points at. */
  href: "#incidents" | "#health";
}

const plural = ({ count, noun }: { count: number; noun: string }): string =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

/** The non-zero problems, worst first, each as the words the strip shows and the anchor it links to. */
export const attentionItems = (summary: AttentionSummary): AttentionItem[] => {
  const items: AttentionItem[] = [];
  if (summary.openIncidents > 0) {
    items.push({ label: plural({ count: summary.openIncidents, noun: "open incident" }), href: "#incidents" });
  }
  if (summary.failingChecks > 0) {
    items.push({ label: plural({ count: summary.failingChecks, noun: "failing check" }), href: "#health" });
  }
  if (summary.degradedChecks > 0) {
    items.push({ label: plural({ count: summary.degradedChecks, noun: "degraded check" }), href: "#health" });
  }
  return items;
};
