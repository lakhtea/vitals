"use client";

// One chart, five metrics: a tab per metric switches which series the
// TimeSeriesChart draws, so the overview shows a trend without five charts.
// A client component only for the chosen tab; the series arrive as props and
// the first paint draws the first metric in the server HTML.
import { useId, useState, type KeyboardEvent, type ReactElement } from "react";
import { formatSampleCount, metricLabel } from "@/vitals/format";
import { METRIC_NAMES, type MetricName } from "@/vitals/metrics";
import type { MetricSeriesData } from "../adapters";
import styles from "./MetricTrend.module.css";
import { TimeSeriesChart } from "./TimeSeriesChart";

export interface MetricTrendProps {
  series: MetricSeriesData[];
  /** Which tab is open first; LCP, the headline metric, when not given. */
  initialMetric?: MetricName;
  /** Chart width in CSS pixels at the viewBox's scale; it scales down to fit. */
  width?: number;
  height?: number;
}

const DEFAULT_METRIC: MetricName = "LCP";
const CHART_WIDTH = 960;
const CHART_HEIGHT = 260;
const ARROW_STEPS: Record<string, 1 | -1 | undefined> = { ArrowRight: 1, ArrowLeft: -1 };

const findSeries = (series: readonly MetricSeriesData[], name: MetricName): MetricSeriesData =>
  series.find((entry) => entry.name === name) ?? { name, points: [], sampleCount: 0 };

export const MetricTrend = ({
  series,
  initialMetric = DEFAULT_METRIC,
  width = CHART_WIDTH,
  height = CHART_HEIGHT,
}: MetricTrendProps): ReactElement => {
  const id = useId();
  const [selected, setSelected] = useState<MetricName>(initialMetric);
  const current = findSeries(series, selected);

  // Roving tabs: arrows move between metrics, as the tabs pattern prescribes.
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const step = ARROW_STEPS[event.key];
    if (step === undefined) {
      return;
    }
    const index = METRIC_NAMES.indexOf(selected);
    event.preventDefault();
    const next = METRIC_NAMES[(index + step + METRIC_NAMES.length) % METRIC_NAMES.length];
    setSelected(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  };

  return (
    <section className={styles.trend} aria-labelledby={`${id}-heading`}>
      <div className={styles.heading}>
        <div className={styles.titles}>
          <h2 id={`${id}-heading`} className={styles.title}>
            Trend
          </h2>
          <p className={styles.meta}>
            {metricLabel(current.name)} · p75 per bucket · {formatSampleCount(current.sampleCount)}
          </p>
        </div>
        <div role="tablist" aria-label="Metric" className={styles.tabs}>
          {METRIC_NAMES.map((name) => {
            const isSelected = name === selected;
            return (
              <button
                key={name}
                type="button"
                role="tab"
                id={`${id}-tab-${name}`}
                aria-selected={isSelected}
                aria-controls={`${id}-panel`}
                tabIndex={isSelected ? 0 : -1}
                className={styles.tab}
                onClick={() => setSelected(name)}
                onKeyDown={handleKeyDown}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${selected}`} className={styles.panel}>
        <TimeSeriesChart name={current.name} points={current.points} width={width} height={height} />
      </div>
    </section>
  );
};
