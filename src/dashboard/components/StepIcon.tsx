// One glyph per step role, drawn in currentColor on the shared 16 px icon
// shell, so the timeline can mark each step with its kind and the empty state
// can reuse the same style in a muted tone. Decorative: the role label beside
// it carries the meaning.
import type { ReactElement } from "react";
import type { StepRole } from "@/incidents/vocabulary";
import { Icon } from "./Icon";

/** The roles plus the glyph the empty timeline shows before any step exists. */
export type StepIconName = StepRole | "empty";

const PATHS: Record<StepIconName, ReactElement> = {
  // Three lines of text: the summary of what happened.
  summarize: <path d="M3 4.5h10M3 8h10M3 11.5h6" />,
  // Code brackets: a change to the code.
  "propose-fix": <path d="M6 4 2.5 8 6 12m4-8 3.5 4L10 12" />,
  // A magnifier: the review reads the change.
  review: (
    <>
      <circle cx="7" cy="7" r="4" />
      <path d="m10 10 3.5 3.5" />
    </>
  ),
  // Two branches joined: a pull request.
  "open-pr": (
    <>
      <circle cx="4" cy="4" r="1.75" />
      <circle cx="4" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <path d="M4 5.75v4.5M12 10.25V7.5a2.5 2.5 0 0 0-2.5-2.5H8" />
    </>
  ),
  // A person: a decision taken at the gate.
  human: (
    <>
      <circle cx="8" cy="5" r="2.5" />
      <path d="M3 14c0-3 2.2-5 5-5s5 2 5 5" />
    </>
  ),
  // A clock: nothing has happened yet.
  empty: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3l2 1.5" />
    </>
  ),
};

export interface StepIconProps {
  name: StepIconName;
}

export const StepIcon = ({ name }: StepIconProps): ReactElement => <Icon>{PATHS[name]}</Icon>;
