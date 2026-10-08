"use client";

// Recent sessions: who visited (coarsely) and the path they took through the
// site. The body is windowed: only the rows inside the scroll viewport plus an
// overscan margin exist in the DOM, and two spacer rows hold the place of the
// rest so the scrollbar is honest. A client component only because the window
// follows the scroll position; the rows arrive as plain props.
import { useState, type CSSProperties, type ReactElement, type UIEvent } from "react";
import { formatDateTime } from "../dates";
import { dimensionLabel } from "../labels";
import { visibleRowWindow } from "../rowWindow";
import styles from "./SessionsTable.module.css";

export interface SessionRowData {
  id: string;
  /** ISO 8601. */
  startedAt: string;
  deviceClass: string;
  connectionType: string;
  userAgentFamily: string;
  pageviews: Array<{ path: string }>;
}

export interface SessionsTableProps {
  sessions: SessionRowData[];
}

const MAX_TRAIL_PATHS = 3;
const PATH_SEPARATOR = " → ";
const COLUMN_COUNT = 5;
const HEADER_ROW_COUNT = 1;

// Every body row is exactly this tall: the CSS pins cell height to the same
// value through --row-height, which is what lets the window be arithmetic
// instead of measurement.
const ROW_HEIGHT_PX = 36;
// The scroll container's max height, so also the most body that can be visible.
const VIEWPORT_HEIGHT_PX = 480;
const VIEWPORT_ROWS = Math.ceil(VIEWPORT_HEIGHT_PX / ROW_HEIGHT_PX);
// Rendered beyond each edge of the viewport so a fast scroll shows rows, not
// blank, before React commits the next window. Also absorbs the sticky header's
// height, which the arithmetic below ignores.
const OVERSCAN_ROWS = 10;

const scrollerStyle = { "--row-height": `${ROW_HEIGHT_PX}px`, maxHeight: VIEWPORT_HEIGHT_PX } as CSSProperties;

const numberFormat = new Intl.NumberFormat("en-US");

const describeTrail = (pageviews: SessionRowData["pageviews"]): string => {
  const shown = pageviews
    .slice(0, MAX_TRAIL_PATHS)
    .map((pageview) => pageview.path)
    .join(PATH_SEPARATOR);
  const hiddenCount = pageviews.length - MAX_TRAIL_PATHS;
  return hiddenCount > 0 ? `${shown} +${hiddenCount} more` : shown;
};

const fullTrail = (pageviews: SessionRowData["pageviews"]): string =>
  pageviews.map((pageview) => pageview.path).join(PATH_SEPARATOR);

/** Holds the height of `rows` unrendered rows; hidden from assistive tech, which reads aria-rowcount instead. */
const SpacerRow = ({ rows }: { rows: number }): ReactElement => (
  <tr aria-hidden="true" className={styles.spacer}>
    <td colSpan={COLUMN_COUNT} style={{ height: rows * ROW_HEIGHT_PX }} />
  </tr>
);

const SessionRow = ({ session, rowIndex }: { session: SessionRowData; rowIndex: number }): ReactElement => (
  <tr aria-rowindex={rowIndex}>
    <td className={styles.started}>
      <time dateTime={session.startedAt}>{formatDateTime(session.startedAt)}</time>
    </td>
    <td>{dimensionLabel(session.deviceClass)}</td>
    <td>{dimensionLabel(session.connectionType)}</td>
    <td className={styles.truncate} title={session.userAgentFamily}>
      {session.userAgentFamily}
    </td>
    <td>
      <span className={styles.pages}>
        <span className={styles.pageCount}>{session.pageviews.length}</span>
        <span className={styles.trail} title={fullTrail(session.pageviews)}>
          {describeTrail(session.pageviews)}
        </span>
      </span>
    </td>
  </tr>
);

export const SessionsTable = ({ sessions }: SessionsTableProps): ReactElement => {
  const [firstVisibleRow, setFirstVisibleRow] = useState(0);
  const { start, end } = visibleRowWindow({
    firstVisibleRow,
    rowCount: sessions.length,
    viewportRows: VIEWPORT_ROWS,
    overscanRows: OVERSCAN_ROWS,
  });
  const rowsAbove = start;
  const rowsBelow = sessions.length - end;

  const handleScroll = (event: UIEvent<HTMLDivElement>): void => {
    // Store the row index rather than scrollTop: React then skips the re-render
    // unless the window actually moved, once per row height, not once per event.
    setFirstVisibleRow(Math.floor(event.currentTarget.scrollTop / ROW_HEIGHT_PX));
  };

  return (
    <div
      className={styles.scroller}
      style={scrollerStyle}
      onScroll={handleScroll}
      role="region"
      aria-label="Recent sessions"
      tabIndex={0}
    >
      <table className={styles.table} aria-rowcount={sessions.length + HEADER_ROW_COUNT}>
        <caption className={styles.visuallyHidden}>
          {numberFormat.format(sessions.length)} sessions; rows render as you scroll.
        </caption>
        <colgroup>
          <col className={styles.startedColumn} />
          <col className={styles.dimensionColumn} />
          <col className={styles.dimensionColumn} />
          <col className={styles.browserColumn} />
          <col />
        </colgroup>
        <thead>
          <tr aria-rowindex={1}>
            <th scope="col">Started (UTC)</th>
            <th scope="col">Device</th>
            <th scope="col">Connection</th>
            <th scope="col">Browser</th>
            <th scope="col">Pages</th>
          </tr>
        </thead>
        <tbody>
          {sessions.length === 0 && (
            <tr>
              <td colSpan={COLUMN_COUNT} className={styles.empty}>
                No sessions match these filters.
              </td>
            </tr>
          )}
          {rowsAbove > 0 && <SpacerRow rows={rowsAbove} />}
          {sessions.slice(start, end).map((session, offset) => (
            <SessionRow key={session.id} session={session} rowIndex={start + offset + HEADER_ROW_COUNT + 1} />
          ))}
          {rowsBelow > 0 && <SpacerRow rows={rowsBelow} />}
        </tbody>
      </table>
    </div>
  );
};
