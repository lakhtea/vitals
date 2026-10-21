// A <time> element with the dashboard's one date format (UTC, en-US) and the
// ISO value machines read. Shared by the incident header, the evidence, the
// timeline, and the proposed-change panel so every clock on the page agrees.
import type { ReactElement } from "react";
import { formatDateTime } from "../dates";
import { isoTimestamp } from "../incidents";

export interface TimestampProps {
  value: string | number;
}

export const Timestamp = ({ value }: TimestampProps): ReactElement => (
  <time dateTime={isoTimestamp(value)}>{formatDateTime(value)}</time>
);
