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
type RosterOpt = { id: string; label: string; role: string | null };

const fmt = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

// 24-hour HH:MM in ET for prefilling <input type="time">.
const hhmmET = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));

const shiftHours = (s: Shift) =>
  Math.max(0, (new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 3_600_000 - (s.break_minutes || 0) / 60);

export function DayEditor({
  date,
  weekday,
  dayLabel,
  store,
  roster,
  shifts,
  recoHours,
  weekDates,
}: {
  date: string;
  weekday: string;
  dayLabel: string;
  store: string;
  roster: RosterOpt[];
  shifts: Shift[];
  recoHours: number;
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

      {shifts.length > 0 && (
        <ul className="mb-2 divide-y divide-brand-50">
          {shifts.map((s) => (
            <li key={s.id} className="py-1.5">
              {editId === s.id ? (
                <form action={onEdit} className="space-y-2 rounded-lg border border-brand-100 bg-brand-50 p-2">
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="date" value={date} />
                  <select name="employee_id" defaultValue={s.roster_employee_id ?? ''} className="input h-9 w-full text-sm">
                    <option value="">Unassigned (open shift)</option>
                    {roster.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                        {r.role ? ` · ${r.role}` : ''}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <input name="start" type="time" defaultValue={hhmmET(s.starts_at)} required className="input h-9 flex-1 text-sm" aria-label="Start" />
                    <span className="text-brand-400">–</span>
                    <input name="end" type="time" defaultValue={hhmmET(s.ends_at)} required className="input h-9 flex-1 text-sm" aria-label="End" />
                    <input name="break" type="number" min="0" step="15" defaultValue={s.break_minutes} className="input h-9 w-16 text-sm" aria-label="Break minutes" title="Break (min)" />
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
                <button onClick={() => { setEditId(s.id); setCopyId(null); }} disabled={pending} className="shrink-0 text-brand-300 hover:text-brand-700" aria-label="Edit shift">
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
                    <div className="flex flex-wrap gap-1">
                      {weekDates.filter((d) => d.date !== date).map((d) => (
                        <button
                          key={d.date}
                          type="button"
                          onClick={() => toggle(copyDays, d.date, setCopyDays)}
                          className={`rounded-full px-2 py-1 text-[11px] font-medium ${copyDays.has(d.date) ? 'bg-brand-700 text-white' : 'bg-white text-brand-600 ring-1 ring-brand-200'}`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-400">Copy to people (optional)</p>
                    <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
                      {roster.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => toggle(copyEmps, r.id, setCopyEmps)}
                          className={`rounded-full px-2 py-1 text-[11px] font-medium ${copyEmps.has(r.id) ? 'bg-brand-700 text-white' : 'bg-white text-brand-600 ring-1 ring-brand-200'}`}
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
          <select name="employee_id" required className="input h-9 w-full text-sm">
            <option value="">Employee…</option>
            {roster.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
                {r.role ? ` · ${r.role}` : ''}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <input name="start" type="time" defaultValue="08:00" required className="input h-9 flex-1 text-sm" aria-label="Start" />
            <span className="text-brand-400">–</span>
            <input name="end" type="time" defaultValue="16:00" required className="input h-9 flex-1 text-sm" aria-label="End" />
            <input name="break" type="number" min="0" step="15" defaultValue="0" className="input h-9 w-16 text-sm" aria-label="Break minutes" title="Break (min)" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn-primary h-9 flex-1 text-sm">
              {pending ? 'Adding…' : 'Add shift'}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="btn-secondary h-9 px-3 text-sm">
              Cancel
            </button>
          </div>
          {err && <p className="text-xs text-brick-600">{err}</p>}
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-brand-200 py-2 text-xs font-medium text-brand-500 hover:border-brand-400 hover:text-brand-700">
          <Plus size={14} /> Add shift
        </button>
      )}
    </section>
  );
}
