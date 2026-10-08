// Date formatting for the dashboard, pinned to one locale so the server and the
// browser produce the same string; only the time zone follows the viewer.
const LOCALE = "en-US";

const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const dayFormat = new Intl.DateTimeFormat(LOCALE, { month: "short", day: "numeric" });

/** ISO string or epoch milliseconds -> "Oct 7, 21:14". */
export const formatDateTime = (value: string | number): string => dateTimeFormat.format(new Date(value));

/** ISO string or epoch milliseconds -> "Oct 7". */
export const formatDay = (value: string | number): string => dayFormat.format(new Date(value));
