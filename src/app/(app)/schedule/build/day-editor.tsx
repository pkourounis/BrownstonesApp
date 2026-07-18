'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { createShift, deleteShift } from './actions';

type Shift = {
  id: string;
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
}: {
  date: string;
  weekday: string;
  dayLabel: string;
  store: string;
  roster: RosterOpt[];
  shifts: Shift[];
  recoHours: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
    <section className="card">
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
            <li key={s.id} className="flex items-center gap-2 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-brand-900">
                  <span className="font-medium">{s.employee ?? 'Unassigned'}</span>
                  {s.status === 'draft' && <span className="ml-1.5 text-[10px] uppercase text-brand-400">draft</span>}
                </p>
                <p className="truncate text-xs text-brand-500">
                  {fmt(s.starts_at)}–{fmt(s.ends_at)} · {shiftHours(s).toFixed(1)}h{s.role ? ` · ${s.role}` : ''}
                </p>
              </div>
              <button onClick={() => onDelete(s.id)} disabled={pending} className="shrink-0 text-brand-300 hover:text-brick-600" aria-label="Remove shift">
                <X size={16} />
              </button>
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
