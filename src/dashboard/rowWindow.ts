// The arithmetic behind the windowed SessionsTable body: given the first row
// the scroll position has reached, which contiguous slice of rows should exist
// in the DOM. Pure, so the clamping at both ends is tested without a browser.

export interface RowWindow {
  /** First rendered row, inclusive. */
  start: number;
  /** Last rendered row, exclusive. */
  end: number;
}

export interface RowWindowInput {
  /** Index of the row at the top edge of the viewport (scrollTop / row height). */
  firstVisibleRow: number;
  rowCount: number;
  /** How many rows fit in the viewport at once. */
  viewportRows: number;
  /** Extra rows rendered beyond each edge so a fast scroll shows content, not blank. */
  overscanRows: number;
}

const clamp = ({ value, min, max }: { value: number; min: number; max: number }): number =>
  Math.min(Math.max(value, min), max);

export const visibleRowWindow = ({ firstVisibleRow, rowCount, viewportRows, overscanRows }: RowWindowInput): RowWindow => {
  const start = clamp({ value: firstVisibleRow - overscanRows, min: 0, max: rowCount });
  const end = clamp({ value: firstVisibleRow + viewportRows + overscanRows, min: start, max: rowCount });
  return { start, end };
};
