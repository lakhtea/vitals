// One page's p75 per metric split by a dimension (device class or connection
// type): a row per value, a rating dot beside every figure, and the samples
// behind the row. Hook-free so the Server Component renders it; the region
// scrolls sideways on narrow screens instead of squeezing the columns.
import type { ReactElement } from "react";
import { formatMetricValue, ratingLabel } from "@/vitals/format";
import { METRIC_NAMES, type MetricName } from "@/vitals/metrics";
import { dimensionLabel } from "../labels";
import type { BreakdownRowData } from "../pageDetail";
import styles from "./BreakdownTable.module.css";
import { RatingDot } from "./RatingDot";

export type BreakdownDimension = "device" | "connection";

export interface BreakdownTableProps {
  dimension: BreakdownDimension;
  rows: BreakdownRowData[];
}

const DIMENSION_COPY: Record<BreakdownDimension, { title: string; noun: string }> = {
  device: { title: "By device", noun: "device class" },
  connection: { title: "By connection", noun: "connection type" },
};

const numberFormat = new Intl.NumberFormat("en-US");

const MetricCell = ({ row, name }: { row: BreakdownRowData; name: MetricName }): ReactElement => {
  const metric = row.metrics[name];
  if (metric === undefined) {
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
      <span className={styles.metric}>
        <RatingDot rating={metric.rating} label={ratingLabel(metric.rating)} />
        {formatMetricValue({ name, value: metric.p75 })}
      </span>
    </td>
  );
};

export const BreakdownTable = ({ dimension, rows }: BreakdownTableProps): ReactElement => {
  const { title, noun } = DIMENSION_COPY[dimension];
  const headingId = `breakdown-${dimension}-heading`;

  return (
    <div className={styles.panel}>
      <h3 id={headingId} className={styles.title}>
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className={styles.empty}>No samples by {noun} match these filters.</p>
      ) : (
        // The scroller is the one region here, named by the heading above it, so the two never disagree.
        <div className={styles.scroller} role="region" aria-labelledby={headingId} tabIndex={0}>
          <table className={styles.table}>
            <caption className={styles.visuallyHidden}>
              p75 per metric by {noun}, with the samples behind each row.
            </caption>
            <colgroup>
              <col className={styles.valueColumn} />
              {METRIC_NAMES.map((name) => (
                <col key={name} className={styles.metricColumn} />
              ))}
              <col className={styles.samplesColumn} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">{dimensionLabel(dimension)}</th>
                {METRIC_NAMES.map((name) => (
                  <th key={name} scope="col" className={styles.numeric}>
                    {name}
                  </th>
                ))}
                <th scope="col" className={styles.numeric}>
                  Samples
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.value}>
                  <th scope="row" className={styles.rowLabel}>
                    {dimensionLabel(row.value)}
                  </th>
                  {METRIC_NAMES.map((name) => (
                    <MetricCell key={name} row={row} name={name} />
                  ))}
                  <td className={styles.numeric}>{numberFormat.format(row.sampleCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
