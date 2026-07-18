import type { StaffingRule } from '@/lib/database.types';

/**
 * Pure helpers + types for the staffing chart. Kept out of the 'use client'
 * grid module so server components (e.g. the new-location page) can call them
 * without importing a client reference.
 */

export const DAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
] as const;

export type DayKey = (typeof DAYS)[number]['key'];
export type StaffingRow = { key: string; role: string } & Record<DayKey, number>;
export type CopySource = { id: string; name: string; rows: StaffingRow[] };

/** Default roles a new store starts with — all counts zero, ready to fill in. */
export const DEFAULT_STAFFING_ROLES = [
  'Server', 'Host', 'Barista', 'Busser', 'Food Runner', 'Drink Runner', 'Expo', 'Cook', 'Prep', 'Dishwasher',
];

let uid = 0;
export const newRow = (role = ''): StaffingRow => ({
  key: `r${uid++}`, role, mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0,
});
/** Re-key rows so React treats them as fresh in a new form. */
export const rekey = (rows: StaffingRow[]): StaffingRow[] => rows.map((r) => ({ ...r, key: `c${uid++}` }));

/** Fresh chart: the default roles, all zero. */
export const defaultRows = (): StaffingRow[] => DEFAULT_STAFFING_ROLES.map((r) => newRow(r));

/** Build editable rows from saved staffing rules. */
export const rowsFromRules = (rules: StaffingRule[]): StaffingRow[] =>
  rules
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => ({ key: r.id, role: r.role, mon: r.mon, tue: r.tue, wed: r.wed, thu: r.thu, fri: r.fri, sat: r.sat, sun: r.sun }));

export const rowsToInput = (rows: StaffingRow[]) =>
  rows.map((r) => ({ role: r.role, mon: r.mon, tue: r.tue, wed: r.wed, thu: r.thu, fri: r.fri, sat: r.sat, sun: r.sun }));
