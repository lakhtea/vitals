"use client";

// A labelled native <select>, the one control shape the toolbar is made of
// (site, time range, device, connection). The label is associated by id, not
// by nesting: a select nested inside its label would be named "Site" plus its
// own current value.
import type { ChangeEvent, ReactElement, ReactNode } from "react";
import styles from "./SelectField.module.css";

export interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  /** The <option> elements. */
  children: ReactNode;
}

export const SelectField = ({ id, label, value, onChange, children }: SelectFieldProps): ReactElement => (
  <div className={styles.field}>
    <label htmlFor={id} className={styles.label}>
      {label}
    </label>
    <select id={id} className={styles.select} value={value} onChange={onChange}>
      {children}
    </select>
  </div>
);
