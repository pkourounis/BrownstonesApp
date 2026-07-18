'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarX2, Plus, Trash2, X, Loader2 } from 'lucide-react';
import type { Location } from '@/lib/database.types';
import { addBlackout, removeBlackout } from './actions';

export type Blackout = { id: string; location_id: string; start_date: string; end_date: string; reason: string | null };

const fmt = (d: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d + 'T12:00:00'));

export function BlackoutManager({ blackouts, locations }: { blackouts: Blackout[]; locations: Pick<Location, 'id' | 'name'>[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ location_id: locations[0]?.id ?? '', start_date: '', end_date: '', reason: '' });
  const [error, setError] = useState<string | null>(null);
  const nameById = new Map(locations.map((l) => [l.id, l.name]));

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await addBlackout(f);
      if (res.ok) { setOpen(false); setF({ location_id: locations[0]?.id ?? '', start_date: '', end_date: '', reason: '' }); router.refresh(); }
      else setError(res.error ?? 'Could not add.');
    });
  };

  const remove = (id: string) => startTransition(async () => { await removeBlackout(id); router.refresh(); });

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-brand-900"><CalendarX2 size={18} /> Blocked days</h2>
        <button onClick={() => setOpen(true)} className="btn-secondary h-8 px-3 text-xs"><Plus size={14} /> Block days</button>
      </div>

      {blackouts.length === 0 ? (
        <div className="card text-sm text-brand-500">No blocked days. Block dates to stop time-off requests (e.g. holidays).</div>
      ) : (
        <ul className="space-y-2">
          {blackouts.map((b) => (
            <li key={b.id} className="card flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-brand-900">
                  {fmt(b.start_date)}{b.end_date !== b.start_date ? ` – ${fmt(b.end_date)}` : ''}
                </p>
                <p className="text-xs text-brand-500">{nameById.get(b.location_id) ?? 'Store'}{b.reason ? ` · ${b.reason}` : ''}</p>
              </div>
              <button onClick={() => remove(b.id)} disabled={pending} className="shrink-0 text-brand-300 hover:text-brick-600" aria-label="Remove blocked days"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={() => !pending && setOpen(false)}>
          <div className="w-full space-y-3 rounded-t-3xl bg-white p-4 shadow-xl sm:max-w-md sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-brand-900">Block days from time off</h3>
              <button onClick={() => setOpen(false)} className="text-brand-300 hover:text-brand-600" aria-label="Close"><X size={18} /></button>
            </div>
            {locations.length > 1 && (
              <div>
                <label className="label">Store</label>
                <select value={f.location_id} onChange={(e) => setF({ ...f, location_id: e.target.value })} className="input h-9 text-sm">
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">From</label><input type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} className="input h-9 text-sm" /></div>
              <div><label className="label">To</label><input type="date" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} className="input h-9 text-sm" /></div>
            </div>
            <div><label className="label">Reason (optional)</label><input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Holiday rush, inventory…" className="input h-9 text-sm" /></div>
            <button onClick={submit} disabled={pending || !f.location_id || !f.start_date} className="btn-primary h-10 w-full justify-center text-sm">
              {pending ? <Loader2 size={16} className="animate-spin" /> : 'Block these days'}
            </button>
            {error && <p className="text-xs text-brick-600">{error}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
