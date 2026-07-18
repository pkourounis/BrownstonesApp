'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarOff, X, Loader2 } from 'lucide-react';
import { requestTimeOff } from '../approvals/actions';

export function TimeOffButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await requestTimeOff({ start_date: start, end_date: end || start, reason });
      if (res.ok) { setDone(true); router.refresh(); }
      else setError(res.error ?? 'Could not submit.');
    });
  };

  if (!open) {
    return (
      <button onClick={() => { setOpen(true); setDone(false); }} className="btn-secondary h-9 px-3 text-xs">
        <CalendarOff size={14} /> Request time off
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={() => !pending && setOpen(false)}>
      <div className="w-full space-y-3 rounded-t-3xl bg-white p-4 shadow-xl sm:max-w-md sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-brand-900">Request time off</h2>
          <button onClick={() => setOpen(false)} className="text-brand-300 hover:text-brand-600" aria-label="Close"><X size={18} /></button>
        </div>
        {done ? (
          <div className="space-y-3">
            <p className="rounded-lg bg-green-100 px-3 py-2 text-sm text-green-700">Request sent — a manager will review it.</p>
            <button onClick={() => setOpen(false)} className="btn-primary h-9 w-full justify-center text-sm">Done</button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">From</label><input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="input h-9 text-sm" /></div>
              <div><label className="label">To</label><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="input h-9 text-sm" /></div>
            </div>
            <div><label className="label">Reason (optional)</label><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Vacation, appointment…" className="input h-9 text-sm" /></div>
            <button onClick={submit} disabled={pending || !start} className="btn-primary h-10 w-full justify-center text-sm">
              {pending ? <Loader2 size={16} className="animate-spin" /> : 'Submit request'}
            </button>
            {error && <p className="text-xs text-brick-600">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
