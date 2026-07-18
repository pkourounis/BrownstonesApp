'use client';

import { Plus, X } from 'lucide-react';
import type { StaffingRule } from '@/lib/database.types';
import { JOB_ROLES } from '@/lib/job-roles';

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

/** Default roles a new store starts with — all counts zero, ready to fill in. */
export const DEFAULT_STAFFING_ROLES = [
  'Server', 'Host', 'Barista', 'Busser', 'Food Runner', 'Drink Runner', 'Expo', 'Cook', 'Prep', 'Dishwasher',
];

let uid = 0;
export const newRow = (role = ''): StaffingRow => ({
  key: `r${uid++}`, role, mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0,
});

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

export type CopySource = { id: string; name: string; rows: StaffingRow[] };

/** The role × day-of-week headcount grid. Fully controlled by the parent. */
export function StaffingGrid({
  rows,
  setRows,
  sources,
}: {
  rows: StaffingRow[];
  setRows: (rows: StaffingRow[]) => void;
  sources?: CopySource[];
}) {
  const setCell = (key: string, field: DayKey, value: number) =>
    setRows(rows.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  const setRole = (key: string, role: string) =>
    setRows(rows.map((r) => (r.key === key ? { ...r, role } : r)));
  const remove = (key: string) => setRows(rows.filter((r) => r.key !== key));
  const add = () => setRows([...rows, newRow()]);

  const usedRoles = new Set(rows.map((r) => r.role).filter(Boolean));
  const total = rows.reduce((n, r) => n + DAYS.reduce((s, d) => s + (r[d.key] || 0), 0), 0);

  const copyFrom = (id: string) => {
    const src = sources?.find((s) => s.id === id);
    if (!src) return;
    // Re-key so React treats them as new rows in this form.
    setRows(src.rows.map((r) => ({ ...r, key: `c${uid++}` })));
  };

  return (
    <div className="space-y-3">
      {sources && sources.length > 0 && (
        <div>
          <label className="label">Copy staffing rules from</label>
          <select onChange={(e) => { if (e.target.value) copyFrom(e.target.value); e.target.value = ''; }} className="input h-9 w-full text-sm" defaultValue="">
            <option value="">Another store…</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-brand-500">Pulls that store&apos;s chart in as a starting point — you can adjust before saving.</p>
        </div>
      )}

      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[520px] border-separate border-spacing-x-1 border-spacing-y-1 text-sm">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-wide text-brand-400">
              <th className="px-1 text-left">Role</th>
              {DAYS.map((d) => (<th key={d.key} className="w-10 text-center">{d.label}</th>))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="pr-1">
                  <select
                    value={JOB_ROLES.includes(r.role) ? r.role : r.role ? '__custom' : ''}
                    onChange={(e) => setRole(r.key, e.target.value === '__custom' ? r.role || ' ' : e.target.value)}
                    className="input h-9 w-full text-sm"
                  >
                    <option value="">Role…</option>
                    {JOB_ROLES.map((role) => (
                      <option key={role} value={role} disabled={usedRoles.has(role) && role !== r.role}>{role}</option>
                    ))}
                    {r.role && !JOB_ROLES.includes(r.role) && <option value="__custom">{r.role.trim() || 'Custom'}</option>}
                  </select>
                </td>
                {DAYS.map((d) => (
                  <td key={d.key}>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={r[d.key]}
                      onChange={(e) => setCell(r.key, d.key, Math.max(0, parseInt(e.target.value || '0', 10) || 0))}
                      className={`input h-9 w-10 px-0 text-center text-sm ${r[d.key] > 0 ? 'font-semibold text-brand-900' : 'text-brand-300'}`}
                      aria-label={`${r.role || 'role'} ${d.label}`}
                    />
                  </td>
                ))}
                <td className="text-center">
                  <button type="button" onClick={() => remove(r.key)} className="text-brand-300 hover:text-brick-600" aria-label="Remove role">
                    <X size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={add} className="flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-900">
          <Plus size={15} /> Add role
        </button>
        <span className="text-xs text-brand-400">Weekly headcount-days: <span className="font-medium text-brand-600">{total}</span></span>
      </div>
    </div>
  );
}
