// Recent sessions: who visited (coarsely) and the path they took through the
// site. Pure presentation with no state, so it renders anywhere, server included.
import type { ReactElement } from "react";
import { formatDateTime } from "../dates";
import { dimensionLabel } from "../labels";
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

export const SessionsTable = ({ sessions }: SessionsTableProps): ReactElement => (
  <div className={styles.scroller}>
    <table className={styles.table}>
      <colgroup>
        <col className={styles.startedColumn} />
        <col className={styles.dimensionColumn} />
        <col className={styles.dimensionColumn} />
        <col className={styles.browserColumn} />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Started</th>
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
        {sessions.map((session) => (
          <tr key={session.id}>
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
        ))}
      </tbody>
    </table>
  </div>
);
