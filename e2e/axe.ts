// The axe gate shared by the e2e specs: WCAG 2.1 A/AA, failing on serious and
// critical violations, printing the rest as advisories (TESTING_RULES.md and
// chapter 09 explain the split).
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

type AxeResults = Awaited<ReturnType<AxeBuilder["analyze"]>>;
type AxeViolation = AxeResults["violations"][number];

const WCAG_21_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const GATED_IMPACTS: ReadonlySet<string> = new Set(["serious", "critical"]);

const describeViolation = (violation: AxeViolation): string => {
  const targets = violation.nodes.map((node) => node.target.join(" ")).join(", ");
  return `${violation.impact ?? "unknown"} ${violation.id}: ${violation.help} at ${targets} (${violation.helpUrl})`;
};

const isGated = (violation: AxeViolation): boolean => GATED_IMPACTS.has(violation.impact ?? "");

export const expectNoGatedViolations = async ({ page, state }: { page: Page; state: string }): Promise<void> => {
  const results = await new AxeBuilder({ page })
    .withTags(WCAG_21_AA_TAGS)
    // Next's dev-only tools indicator renders inside <nextjs-portal>; it is not part of the dashboard.
    .exclude("nextjs-portal")
    .analyze();

  const gated = results.violations.filter(isGated);
  const advisory = results.violations.filter((violation) => !isGated(violation));

  for (const violation of advisory) {
    const line = `axe advisory [${state}] ${describeViolation(violation)}`;
    console.info(line);
    test.info().annotations.push({ type: "axe-advisory", description: line });
  }

  expect(gated.map(describeViolation), `serious/critical axe violations [${state}]`).toEqual([]);
};
