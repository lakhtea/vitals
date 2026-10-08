"use client";

// The per-path table: p75 per metric, sortable by any column. A client
// component only because the sort order is local UI state; the rows arrive as
// plain props and the comparator lives in sortPages.ts.
import { useState, type ReactElement } from "react";
import { formatMetricValue, ratingLabel } from "@/vitals/format";
import {
  PAGE_METRIC_COLUMNS,
  findPageMetric,
  sortPages,
  toggleSort,
  type PageMetricColumn,
  type PageRowData,
  type PageSort,
  type PagesSortColumn,
} from "../sortPages";
import styles from "./PagesTable.module.css";

export type { PageRowData } from "../sortPages";

export interface PagesTableProps {
  pages: PageRowData[];
}

const DEFAULT_SORT: PageSort = { column: "pageviews", direction: "desc" };

const COLUMNS: readonly PagesSortColumn[] = ["path", "pageviews", ...PAGE_METRIC_COLUMNS];

const COLUMN_LABELS: Record<PagesSortColumn, string> = {
  path: "Path",
  pageviews: "Pageviews",
  LCP: "LCP",
  CLS: "CLS",
  INP: "INP",
};

const numberFormat = new Intl.NumberFormat("en-US");

const SortableHeader = ({
  column,
  sort,
  onSort,
}: {
  column: PagesSortColumn;
  sort: PageSort;
  onSort: (column: PagesSortColumn) => void;
}): ReactElement => {
  const isActive = sort.column === column;
  const isNumeric = column !== "path";
  const directionWord = sort.direction === "asc" ? "ascending" : "descending";
  const directionArrow = sort.direction === "asc" ? "▲" : "▼";
  const ariaSort = isActive ? directionWord : undefined;
  const indicator = isActive ? directionArrow : "";

  return (
    <th scope="col" aria-sort={ariaSort} className={isNumeric ? styles.numeric : undefined}>
      <button type="button" className={styles.sortButton} onClick={() => onSort(column)}>
        {COLUMN_LABELS[column]}
        <span aria-hidden="true" className={styles.sortIcon}>
          {indicator}
        </span>
      </button>
    </th>
  );
};

const MetricCell = ({ page, name }: { page: PageRowData; name: PageMetricColumn }): ReactElement => {
  const metric = findPageMetric({ page, name });
  if (metric === null) {
    return (
      <td className={styles.numeric}>
        <span aria-hidden="true" className={styles.missing}>
          –
        </span>
        <span className={styles.visuallyHidden}>no data</span>
      </td>
    );
  }
  return (
    <td className={styles.numeric}>
      <span className={styles.metric} data-rating={metric.p75Rating}>
        {formatMetricValue({ name, value: metric.p75 })}
      </span>
      <span className={styles.visuallyHidden}> ({ratingLabel(metric.p75Rating)})</span>
    </td>
  );
};

export const PagesTable = ({ pages }: PagesTableProps): ReactElement => {
  const [sort, setSort] = useState<PageSort>(DEFAULT_SORT);
  const sorted = sortPages({ pages, ...sort });
  const directionLabel = sort.direction === "asc" ? "ascending" : "descending";

  return (
    <div className={styles.scroller}>
      <table className={styles.table}>
        <caption className={styles.visuallyHidden}>
          Pages with p75 per metric, sorted by {COLUMN_LABELS[sort.column]} {directionLabel}
        </caption>
        <colgroup>
          <col />
          <col className={styles.pageviewsColumn} />
          {PAGE_METRIC_COLUMNS.map((name) => (
            <col key={name} className={styles.metricColumn} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <SortableHeader
                key={column}
                column={column}
                sort={sort}
                onSort={(next) => setSort(toggleSort({ current: sort, column: next }))}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length} className={styles.empty}>
                No pages match these filters.
              </td>
            </tr>
          )}
          {sorted.map((page) => (
            <tr key={page.path}>
              <th scope="row" className={styles.path} title={page.path}>
                {page.path}
              </th>
              <td className={styles.numeric}>{numberFormat.format(page.pageviewCount)}</td>
              {PAGE_METRIC_COLUMNS.map((name) => (
                <MetricCell key={name} page={page} name={name} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
