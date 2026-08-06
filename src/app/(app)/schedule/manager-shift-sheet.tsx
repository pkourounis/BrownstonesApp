'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2, Hand, X, Settings2, Check } from 'lucide-react';
import {
  managerEditShift,
  managerReassignShift,
  managerDeleteShift,
  markAttendance,
  makeAvailable,
  offerToPerson,
} from '../approvals/actions';

const TZ = 'America/New_York';

/** UTC ISO → 'YYYY-MM-DDTHH:mm' wall-clock in Eastern time (for datetime-local inputs). */
function toEtInput(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(new Date(iso))
    .reduce((a, x) => { a[x.type] = x.value; return a; }, {} as Record<string, string>);
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

/** 'YYYY-MM-DDTHH:mm' interpreted as Eastern wall-clock → UTC ISO. */
function etInputToIso(wall: string): string {
  const guess = new Date(wall + ':00Z').getTime();
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    .formatToParts(new Date(guess))
    .reduce((a, x) => { a[x.type] = x.value; return a; }, {} as Record<string, string>);
  const hour = parts.hour === '24' ? '00' : parts.hour;
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +hour, +parts.minute, +parts.second);
  const offset = asUtc - guess; // ms ET is ahead of UTC (negative in the US)
  return new Date(guess - offset).toISOString();
}

export type SheetShift = {
  id: string;
  starts_at: string;
  ends_at: string;
  break_minutes: number;
  role_title: string | null;
  position_id: string | null;
  notes: string | null;
  attendance: 'no_show' | 'sick' | 'called_out' | null;
  employeeName: string;
  assigned: boolean;
};

type Opt = { value: string; label: string; profileId: string | null };

export function ManagerShiftSheet({
  shift,
  positions,
  people,
}: {
  shift: SheetShift;
  positions: { id: string; name: string }[];
  people: Opt[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Edit fields
  const [start, setStart] = useState(() => toEtInput(shift.starts_at));
  const [end, setEnd] = useState(() => toEtInput(shift.ends_at));
  const [brk, setBrk] = useState(String(shift.break_minutes ?? 0));
  const [positionId, setPositionId] = useState(shift.position_id ?? '');
  const [notes, setNotes] = useState(shift.notes ?? '');

  const [reassignTo, setReassignTo] = useState('');
  const [offerTo, setOfferTo] = useState('');
  const [offerNote, setOfferNote] = useState('');

  const run = async (key: string, fn: () => Promise<{ ok: boolean; error?: string }>, done?: string) => {
    setBusy(key);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fn();
      if (res.ok) {
        router.refresh();
        if (done) { setOkMsg(done); setBusy(null); } else setOpen(false);
      } else {
        setError(res.error ?? 'Something went wrong.');
        setBusy(null);
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setBusy(null);
    }
  };

  if (!open) {
    return (
      <button onClick={() => { setOpen(true); setError(null); setOkMsg(null); }} className="shrink-0 rounded-lg p-1.5 text-brand-400 hover:bg-brand-100 hover:text-brand-800" aria-label="Manage shift">
        <Settings2 size={16} />
      </button>
    );
  }

  const posName = positions.find((p) => p.id === positionId)?.name ?? null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={() => !busy && setOpen(false)}>
      <div className="max-h-[90vh] w-full space-y-4 overflow-y-auto rounded-t-3xl bg-white p-4 shadow-xl sm:max-w-lg sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-brand-900">Manage shift</h2>
            <p className="text-xs text-brand-500">{shift.assigned ? shift.employeeName : 'Open shift'}</p>
          </div>
          <button onClick={() => setOpen(false)} className="text-brand-300 hover:text-brand-600" aria-label="Close"><X size={18} /></button>
        </div>

        {okMsg && <p className="rounded-lg bg-green-100 px-3 py-2 text-sm text-green-700">{okMsg}</p>}
        {error && <p className="rounded-lg bg-brick-500/10 px-3 py-2 text-sm text-brick-600">{error}</p>}

        {/* Edit time / role / notes */}
        <section className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-500">Details</p>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Start</label><input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="input h-9 text-sm" /></div>
            <div><label className="label">End</label><input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="input h-9 text-sm" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Break (min)</label><input type="number" min={0} value={brk} onChange={(e) => setBrk(e.target.value)} className="input h-9 text-sm" /></div>
            <div>
              <label className="label">Role</label>
              <select value={positionId} onChange={(e) => setPositionId(e.target.value)} className="input h-9 text-sm">
                <option value="">—</option>
                {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">Notes</label><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className="input h-9 text-sm" /></div>
          <button
            onClick={() => run('edit', () => managerEditShift(shift.id, {
              starts_at: etInputToIso(start),
              ends_at: etInputToIso(end),
              break_minutes: Number(brk) || 0,
              role_title: posName,
              position_id: positionId || null,
              notes: notes.trim() || null,
            }), 'Saved.')}
            disabled={busy !== null}
            className="btn-primary h-9 w-full justify-center text-sm"
          >
            {busy === 'edit' ? <Loader2 size={15} className="animate-spin" /> : 'Save changes'}
          </button>
        </section>

        {/* Reassign */}
        <section className="space-y-2 border-t border-brand-100 pt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-500">Reassign</p>
          <select value={reassignTo} onChange={(e) => setReassignTo(e.target.value)} className="input h-10 w-full pr-8 text-sm">
            <option value="">Choose a person…</option>
            {people.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            <option value="__open">Unassign (open shift)</option>
          </select>
          <button
            onClick={() => run('reassign', () => managerReassignShift(shift.id, reassignTo === '__open' ? '' : reassignTo), 'Reassigned.')}
            disabled={busy !== null || !reassignTo}
            className="btn-secondary h-9 w-full justify-center text-sm"
          >
            {busy === 'reassign' ? <Loader2 size={15} className="animate-spin" /> : 'Apply reassignment'}
          </button>
        </section>

        {/* Offer / make available */}
        <section className="space-y-2 border-t border-brand-100 pt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-500">Cover this shift</p>
          <button
            onClick={() => run('avail', () => makeAvailable(shift.id), 'Put up for grabs.')}
            disabled={busy !== null || !shift.assigned}
            className="btn-secondary h-9 w-full justify-center text-sm"
          >
            {busy === 'avail' ? <Loader2 size={15} className="animate-spin" /> : <><Hand size={14} /> Put up for grabs</>}
          </button>
          <select value={offerTo} onChange={(e) => setOfferTo(e.target.value)} className="input h-10 w-full pr-8 text-sm">
            <option value="">Offer to a specific person…</option>
            {people.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <input value={offerNote} onChange={(e) => setOfferNote(e.target.value)} placeholder="Note with the offer (optional)" className="input h-10 w-full text-sm" />
          <button
            onClick={() => {
              const person = people.find((p) => p.value === offerTo);
              if (!person) return;
              if (person.profileId) run('offer', () => offerToPerson(shift.id, person.profileId as string, offerNote), 'Offer sent.');
              else run('offer', () => managerReassignShift(shift.id, person.value), 'Assigned (no app login to accept).');
            }}
            disabled={busy !== null || !offerTo}
            className="btn-secondary h-9 w-full justify-center text-sm"
          >
            {busy === 'offer' ? <Loader2 size={15} className="animate-spin" /> : 'Send offer'}
          </button>
          <p className="text-[11px] text-brand-400">People with the app get an offer to accept; others are assigned directly.</p>
        </section>

        {/* Attendance */}
        <section className="space-y-2 border-t border-brand-100 pt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-500">Attendance</p>
          <div className="flex flex-wrap gap-2">
            {(['no_show', 'sick', 'called_out'] as const).map((st) => {
              const label = st === 'no_show' ? 'No-show' : st === 'sick' ? 'Sick' : 'Call-out';
              const active = shift.attendance === st;
              return (
                <button
                  key={st}
                  onClick={() => run(`att-${st}`, () => markAttendance(shift.id, active ? null : st), active ? 'Cleared.' : 'Marked.')}
                  disabled={busy !== null || !shift.assigned}
                  className={`flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-medium ${active ? 'bg-brick-600 text-white' : 'bg-brand-100 text-brand-700 hover:bg-brand-200'}`}
                >
                  {busy === `att-${st}` ? <Loader2 size={14} className="animate-spin" /> : active ? <><Check size={14} /> {label}</> : label}
                </button>
              );
            })}
          </div>
          {!shift.assigned && <p className="text-[11px] text-brand-400">Assign someone to mark attendance.</p>}
        </section>

        {/* Delete */}
        <section className="border-t border-brand-100 pt-3">
          <button
            onClick={() => { if (confirm('Delete this shift? This cannot be undone.')) run('delete', () => managerDeleteShift(shift.id)); }}
            disabled={busy !== null}
            className="flex h-9 w-full items-center justify-center gap-1 rounded-lg bg-brick-500/10 text-sm font-semibold text-brick-600 hover:bg-brick-500/20"
          >
            {busy === 'delete' ? <Loader2 size={15} className="animate-spin" /> : <><Trash2 size={14} /> Delete shift</>}
          </button>
        </section>
      </div>
    </div>
  );
}
