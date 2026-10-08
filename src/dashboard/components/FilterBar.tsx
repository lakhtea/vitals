"use client";

// The one filter row every card and table on the dashboard answers to. It owns
// no state: the page holds the filters and is told about each change, so the
// same value can drive the GraphQL query and the URL later.
import { useId, type ChangeEvent, type ReactElement } from "react";
import {
  CONNECTION_TYPE_OPTIONS,
  DEFAULT_FILTERS,
  DEVICE_CLASS_OPTIONS,
  TIME_RANGE_OPTIONS,
  isDefaultFilters,
  type DashboardFilters,
} from "../filters";
import { dimensionLabel } from "../labels";
import styles from "./FilterBar.module.css";

export { DEFAULT_FILTERS } from "../filters";
export type { DashboardFilters, TimeRangeKey } from "../filters";

export interface FilterBarProps {
  value: DashboardFilters;
  onChange: (next: DashboardFilters) => void;
}

const ALL_VALUE = "";

export const FilterBar = ({ value, onChange }: FilterBarProps): ReactElement => {
  const id = useId();
  const rangeId = `${id}-range`;
  const deviceId = `${id}-device`;
  const connectionId = `${id}-connection`;
  const isDefault = isDefaultFilters(value);

  const handleRangeChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const option = TIME_RANGE_OPTIONS.find((candidate) => candidate.key === event.target.value);
    onChange({ ...value, range: option?.key ?? DEFAULT_FILTERS.range });
  };

  const handleDeviceChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const deviceClass = DEVICE_CLASS_OPTIONS.find((candidate) => candidate === event.target.value) ?? null;
    onChange({ ...value, deviceClass });
  };

  const handleConnectionChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const connectionType = CONNECTION_TYPE_OPTIONS.find((candidate) => candidate === event.target.value) ?? null;
    onChange({ ...value, connectionType });
  };

  return (
    <fieldset className={styles.bar}>
      <legend className={styles.visuallyHidden}>Filters</legend>

      <div className={styles.field}>
        <label htmlFor={rangeId} className={styles.label}>
          Time range
        </label>
        <select id={rangeId} className={styles.select} value={value.range} onChange={handleRangeChange}>
          {TIME_RANGE_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label htmlFor={deviceId} className={styles.label}>
          Device
        </label>
        <select
          id={deviceId}
          className={styles.select}
          value={value.deviceClass ?? ALL_VALUE}
          onChange={handleDeviceChange}
        >
          <option value={ALL_VALUE}>All devices</option>
          {DEVICE_CLASS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {dimensionLabel(option)}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label htmlFor={connectionId} className={styles.label}>
          Connection
        </label>
        <select
          id={connectionId}
          className={styles.select}
          value={value.connectionType ?? ALL_VALUE}
          onChange={handleConnectionChange}
        >
          <option value={ALL_VALUE}>All connections</option>
          {CONNECTION_TYPE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {dimensionLabel(option)}
            </option>
          ))}
        </select>
      </div>

      {/* Kept in the layout while hidden so the row never changes width. */}
      <button
        type="button"
        className={isDefault ? `${styles.reset} ${styles.resetHidden}` : styles.reset}
        onClick={() => onChange(DEFAULT_FILTERS)}
      >
        Reset
      </button>
    </fieldset>
  );
};
