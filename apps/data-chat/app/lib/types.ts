export type ColumnType = 'number' | 'date' | 'category' | 'text';

/** A parsed cell. Dates are stored as epoch milliseconds so they aggregate like numbers. */
export type Cell = string | number | null;
export type Row = Record<string, Cell>;

export interface ColumnProfile {
  name: string;
  type: ColumnType;
  nulls: number;
  distinct: number;
  /** number + date */
  min?: number;
  max?: number;
  mean?: number;
  /** Bin counts for a tiny distribution sketch (number: value bins, date: time bins). */
  histogram?: number[];
  /** category + text: most common values. */
  top?: { value: string; count: number }[];
  /** True when a date column also carries a time of day. */
  hasTime?: boolean;
}

export interface DatasetMeta {
  id: string;
  name: string;
  source: 'sample' | 'upload';
  description?: string;
  rowCount: number;
  truncated?: boolean;
  createdAt: number;
  columns: ColumnProfile[];
}

export interface Dataset extends DatasetMeta {
  rows: Row[];
}
