'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Copy, Check, Pencil } from 'lucide-react';
import { createShift, deleteShift, duplicateShift, updateShift } from './actions';

type Shift = {
  id: string;
  roster_employee_id: string | null;
  employee: string | null;
  role: string | null;
  starts_at: string;
  ends_at: string;
  break_minutes: number;
  status: string;
};
type RosterOpt = { id: string; label: string; role: string | null; roles: string[] };

const fmt = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

// 24-hour HH:MM in ET for prefilling <input type="time">.
const hhmmET = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));

const shiftHours = (s: Shift) =>
  Math.max(0, (new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 3_600_000 - (s.break_minutes || 0) / 60);

const usd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

type Requirement = { role: string; need: number };
type Demand = { peakRev: number; dayRev: number; revTarget: number; serversByVolume: number; base: number; extra: number } | null;

export function DayEditor({
  date,
  weekday,
  dayLabel,
  store,
  roster,
  shifts,
  recoHours,
  requirements = [],
  demand = null,
  weekDates,
}: {
  date: string;
  weekday: string;
  dayLabel: string;
  store: string;
  roster: RosterOpt[];
  shifts: Shift[];
  recoHours: number;
  requirements?: Requirement[];
  demand?: Demand;
  weekDates: { date: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copyId, setCopyId] = useState<string | null>(null);
  const [copyDays, setCopyDays] = useState<Set<string>>(new Set());
  const [copyEmps, setCopyEmps] = useState<Set<string>>(new Set());
  const [editId, setEditId] = useState<string | null>(null);
  const [addEmp, setAddEmp] = useState('');
  const [editEmp, setEditEmp] = useState('');
  const rolesFor = (empId: string) => roster.find((r) => r.id === empId)?.roles ?? [];

  const onEdit = (formData: FormData) => {
    setErr(null);
    startTransition(async () => {
      const res = await updateShift(formData);
      if (res.ok) {
        setEditId(null);
        router.refresh();
      } else setErr(res.error ?? 'Could not save shift.');
    });
  };

  const openCopy = (id: string) => {
    setCopyId(id);
    setCopyDays(new Set());
    setCopyEmps(new Set());
  };
  const toggle = (set: Set<string>, val: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    setter(next);
  };
  const runCopy = () => {
    if (!copyId) return;
    startTransition(async () => {
      const res = await duplicateShift(copyId, { days: [...copyDays], employeeIds: [...copyEmps] });
      if (res.ok) {
        setCopyId(null);
        router.refresh();
      } else setErr(res.error ?? 'Could not copy.');
    });
  };

  const scheduled = shifts.reduce((s, x) => s + shiftHours(x), 0);
  const gap = recoHours - scheduled;

  // Coverage by role: how many are scheduled vs required for this day.
  const scheduledByRole = new Map<string, number>();
  for (const s of shifts) {
    if (!s.role) continue;
    const k = s.role.trim().toLowerCase();
    scheduledByRole.set(k, (scheduledByRole.get(k) ?? 0) + 1);
  }
  const coverage = requirements.map((req) => ({
    role: req.role,
    need: req.need,
    have: scheduledByRole.get(req.role.trim().toLowerCase()) ?? 0,
  }));
  const shortfalls = coverage.filter((c) => c.have < c.need).length;
  const badge =
    recoHours <= 0
      ? 'bg-brand-100 text-brand-500'
      : gap > 4
        ? 'bg-brick-500/15 text-brick-600'
        : gap < -4
          ? 'bg-amber-100 text-amber-700'
          : 'bg-green-100 text-green-700';

  const onAdd = (formData: FormData) => {
    setErr(null);
    startTransition(async () => {
      const res = await createShift(formData);
      if (res.ok) {
        setAdding(false);
        setAddEmp('');
        router.refresh();
      } else {
        setErr(res.error ?? 'Could not add shift.');
      }
    });
  };

  const onDelete = (id: string) => {
    startTransition(async () => {
      await deleteShift(id);
      router.refresh();
    });
  };

  return (
    <section id={`day-${date}`} className="card scroll-mt-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="font-semibold text-brand-900">
          {weekday} <span className="text-sm font-normal text-brand-400">{dayLabel}</span>
        </h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${badge}`}>
          {scheduled.toFixed(1)}h{recoHours > 0 ? ` / ${recoHours.toFixed(0)}h` : ''}
        </span>
      </div>

      {demand && (
        <div className={`mb-2 rounded-lg px-2.5 py-2 text-xs ${demand.extra > 0 ? 'bg-amber-50 text-amber-900' : 'bg-brand-50 text-brand-600'}`}>
          <div className="flex items-center justify-between gap-2">
            <span>Projected <span className="font-semibold tabular-nums">{usd(demand.dayRev)}</span> · peak <span className="font-semibold tabular-nums">{usd(demand.peakRev)}</span>/hr</span>
            {demand.extra > 0 ? (
              <span className="shrink-0 rounded-full bg-amber-200/70 px-2 py-0.5 font-semibold text-amber-800">+{demand.extra} server{demand.extra > 1 ? 's' : ''}</span>
            ) : (
              <span className="shrink-0 text-brand-400">base covers it</span>
            )}
          </div>
          {demand.extra > 0 && (
            <p className="mt-1 text-[11px] leading-snug">
              Peak sales suggest ~{demand.serversByVolume} servers on the floor ({usd(demand.revTarget)}/hr each) vs {demand.base} in the base rules — schedule extra staff for the rush.
            </p>
          )}
        </div>
      )}

      {coverage.length > 0 && (
        <div className="mb-2 rounded-lg bg-brand-50 p-2">
          <p className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-brand-400">
            <span>Needed today</span>
            {shortfalls > 0 && <span className="text-brick-600">{shortfalls} role{shortfalls > 1 ? 's' : ''} short</span>}
          </p>
          <div className="flex flex-wrap gap-1">
            {coverage.map((c) => {
              const met = c.have >= c.need;
              return (
                <span
                  key={c.role}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${met ? 'bg-green-100 text-green-700' : 'bg-brick-500/15 text-brick-600'}`}
                  title={`${c.have} of ${c.need} ${c.role} scheduled`}
                >
                  {c.role} {c.have}/{c.need}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {shifts.length > 0 && (
        <ul className="mb-2 divide-y divide-brand-50">
          {shifts.map((s) => (
            <li key={s.id} className="py-1.5">
              {editId === s.id ? (
                <form action={onEdit} className="space-y-2 rounded-lg border border-brand-100 bg-brand-50 p-2">
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="date" value={date} />
                  <select name="employee_id" value={editEmp} onChange={(e) => setEditEmp(e.target.value)} className="input h-9 w-full text-sm">
                    <option value="">Unassigned (open shift)</option>
                    {roster.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                        {r.role ? ` · ${r.role}` : ''}
                      </option>
                    ))}
                  </select>
                  {rolesFor(editEmp).length > 0 && (
                    <select name="role" defaultValue={s.role ?? ''} className="input h-9 w-full text-sm" aria-label="Role for this shift">
                      <option value="">Role for this shift…</option>
                      {rolesFor(editEmp).map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-brand-400">Start</label>
                      <input name="start" type="time" defaultValue={hhmmET(s.starts_at)} required className="input h-9 w-full text-sm" aria-label="Start" />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-brand-400">End</label>
                      <input name="end" type="time" defaultValue={hhmmET(s.ends_at)} required className="input h-9 w-full text-sm" aria-label="End" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-brand-400">Break (minutes)</label>
                    <input name="break" type="number" min="0" step="15" defaultValue={s.break_minutes} className="input h-9 w-24 text-sm" aria-label="Break minutes" title="Unpaid break in minutes" />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={pending} className="btn-primary h-9 flex-1 text-sm">{pending ? 'Saving…' : 'Save shift'}</button>
                    <button type="button" onClick={() => setEditId(null)} className="btn-secondary h-9 px-3 text-sm">Cancel</button>
                  </div>
                  {err && <p className="text-xs text-brick-600">{err}</p>}
                </form>
              ) : (
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-brand-900">
                    <span className="font-medium">{s.employee ?? 'Unassigned'}</span>
                    {s.status === 'draft' && <span className="ml-1.5 text-[10px] uppercase text-brand-400">draft</span>}
                  </p>
                  <p className="truncate text-xs text-brand-500">
                    {fmt(s.starts_at)}–{fmt(s.ends_at)} · {shiftHours(s).toFixed(1)}h{s.role ? ` · ${s.role}` : ''}
                  </p>
                </div>
                <button onClick={() => { setEditId(s.id); setEditEmp(s.roster_employee_id ?? ''); setCopyId(null); }} disabled={pending} className="shrink-0 text-brand-300 hover:text-brand-700" aria-label="Edit shift">
                  <Pencil size={15} />
                </button>
                <button onClick={() => (copyId === s.id ? setCopyId(null) : openCopy(s.id))} disabled={pending} className="shrink-0 text-brand-300 hover:text-brand-700" aria-label="Copy shift">
                  <Copy size={15} />
                </button>
                <button onClick={() => onDelete(s.id)} disabled={pending} className="shrink-0 text-brand-300 hover:text-brick-600" aria-label="Remove shift">
                  <X size={16} />
                </button>
              </div>
              )}

              {copyId === s.id && (
                <div className="mt-2 space-y-2 rounded-lg border border-brand-100 bg-brand-50 p-2">
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-400">Copy to days</p>
                    <div className="flex flex-wrap gap-1.5">
                      {weekDates.filter((d) => d.date !== date).map((d) => (
                        <button
                          key={d.date}
                          type="button"
                          onClick={() => toggle(copyDays, d.date, setCopyDays)}
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none ${copyDays.has(d.date) ? 'bg-brand-700 text-white' : 'bg-white text-brand-600 ring-1 ring-brand-200'}`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-400">Copy to people (optional)</p>
                    <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                      {roster.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => toggle(copyEmps, r.id, setCopyEmps)}
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none ${copyEmps.has(r.id) ? 'bg-brand-700 text-white' : 'bg-white text-brand-600 ring-1 ring-brand-200'}`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-[10px] text-brand-400">No one picked = keep the same person. Pick days and/or people.</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={runCopy} disabled={pending || (copyDays.size === 0 && copyEmps.size === 0)} className="btn-primary h-8 flex-1 justify-center text-xs">
                      <Check size={13} /> {pending ? 'Copying…' : 'Copy shift'}
                    </button>
                    <button onClick={() => setCopyId(null)} className="btn-secondary h-8 px-3 text-xs">Cancel</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form action={onAdd} className="space-y-2 rounded-lg border border-brand-100 bg-brand-50 p-2">
          <input type="hidden" name="location_id" value={store} />
          <input type="hidden" name="date" value={date} />
          <select name="employee_id" required value={addEmp} onChange={(e) => setAddEmp(e.target.value)} className="input h-9 w-full text-sm">
            <option value="">Employee…</option>
            {roster.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
                {r.role ? ` · ${r.role}` : ''}
              </option>
            ))}
          </select>
          {rolesFor(addEmp).length > 0 && (
            <select name="role" defaultValue={roster.find((r) => r.id === addEmp)?.role ?? ''} key={addEmp} className="input h-9 w-full text-sm" aria-label="Role for this shift">
              <option value="">Role for this shift…</option>
              {rolesFor(addEmp).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-brand-400">Start</label>
              <input name="start" type="time" defaultValue="08:00" required className="input h-9 w-full text-sm" aria-label="Start" />
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-brand-400">End</label>
              <input name="end" type="time" defaultValue="16:00" required className="input h-9 w-full text-sm" aria-label="End" />
            </div>
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-brand-400">Break (minutes)</label>
            <input name="break" type="number" min="0" step="15" defaultValue="0" className="input h-9 w-24 text-sm" aria-label="Break minutes" title="Unpaid break in minutes" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn-primary h-9 flex-1 text-sm">
              {pending ? 'Adding…' : 'Add shift'}
            </button>
            <button type="button" onClick={() => { setAdding(false); setAddEmp(''); }} className="btn-secondary h-9 px-3 text-sm">
              Cancel
            </button>
          </div>
          {err && <p className="text-xs text-brick-600">{err}</p>}
        </form>
      ) : (
        <button onClick={() => { setAdding(true); setAddEmp(''); }} className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-brand-200 py-2 text-xs font-medium text-brand-500 hover:border-brand-400 hover:text-brand-700">
          <Plus size={14} /> Add shift
        </button>
      )}
    </section>
  );
}
