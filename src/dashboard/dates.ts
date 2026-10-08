// Date formatting for the dashboard, pinned to one locale AND one time zone so
// the server and the browser produce the same string: the first paint is
// rendered on the server, and a hydration mismatch would redraw the page.
const LOCALE = "en-US";
const TIME_ZONE = "UTC";

const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: TIME_ZONE,
});

const dayFormat = new Intl.DateTimeFormat(LOCALE, { month: "short", day: "numeric", timeZone: TIME_ZONE });

/** ISO string or epoch milliseconds -> "Oct 7, 21:14", in UTC. */
export const formatDateTime = (value: string | number): string => dateTimeFormat.format(new Date(value));

/** ISO string or epoch milliseconds -> "Oct 7", in UTC. */
export const formatDay = (value: string | number): string => dayFormat.format(new Date(value));
