'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Check, Plus, X } from 'lucide-react';
import type { StaffingRule } from '@/lib/database.types';
import { JOB_ROLES } from '@/lib/job-roles';
import { saveStaffingRules } from './actions';

const DAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
] as const;

type DayKey = (typeof DAYS)[number]['key'];
type Row = { key: string; role: string } & Record<DayKey, number>;

let uid = 0;
const newRow = (role = ''): Row => ({
  key: `r${uid++}`,
  role,
  mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0,
});

export function StaffingRulesEditor({ locationId, rules }: { locationId: string; rules: StaffingRule[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>(() =>
    rules.length
      ? rules
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((r) => ({ key: r.id, role: r.role, mon: r.mon, tue: r.tue, wed: r.wed, thu: r.thu, fri: r.fri, sat: r.sat, sun: r.sun }))
      : [newRow()],
  );

  const setCell = (key: string, field: DayKey, value: number) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  const setRole = (key: string, role: string) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, role } : r)));
  const remove = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key));
  const add = () => setRows((rs) => [...rs, newRow()]);

  const usedRoles = new Set(rows.map((r) => r.role).filter(Boolean));
  const rowTotal = (r: Row) => DAYS.reduce((n, d) => n + (r[d.key] || 0), 0);

  const save = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await saveStaffingRules(
        locationId,
        rows.map((r) => ({ role: r.role, mon: r.mon, tue: r.tue, wed: r.wed, thu: r.thu, fri: r.fri, sat: r.sat, sun: r.sun })),
      );
      setMsg(res.ok ? 'Staffing rules saved.' : res.error ?? 'Error');
      if (res.ok) router.refresh();
    });
  };

  return (
    <div className="card space-y-3">
      <div>
        <h2 className="font-semibold text-brand-900">Staffing rules</h2>
        <p className="text-xs text-brand-500">How many of each role this store needs on each day. The schedule builder compares these to what you&apos;ve scheduled and flags any shortfalls.</p>
      </div>

      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[520px] border-separate border-spacing-x-1 border-spacing-y-1 text-sm">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-wide text-brand-400">
              <th className="px-1 text-left">Role</th>
              {DAYS.map((d) => (
                <th key={d.key} className="w-10 text-center">{d.label}</th>
              ))}
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

      <button type="button" onClick={add} className="flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-900">
        <Plus size={15} /> Add role
      </button>

      <p className="text-xs text-brand-400">
        Weekly headcount-days:{' '}
        <span className="font-medium text-brand-600">{rows.reduce((n, r) => n + rowTotal(r), 0)}</span>
      </p>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={pending} className="btn-primary">
          {pending ? <Loader2 size={18} className="animate-spin" /> : 'Save staffing rules'}
        </button>
        {msg && <span className="flex items-center gap-1.5 text-sm text-brand-700"><Check size={15} /> {msg}</span>}
      </div>
    </div>
  );
}
