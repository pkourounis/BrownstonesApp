'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Loader2 } from 'lucide-react';
import { decideTimeOff, decideAvailability, decideSwap } from './actions';

type Kind = 'timeoff' | 'availability' | 'swap';

const FN: Record<Kind, (id: string, approve: boolean, note?: string) => Promise<{ ok: boolean; error?: string }>> = {
  timeoff: decideTimeOff,
  availability: decideAvailability,
  swap: decideSwap,
};

export function Decide({ id, kind }: { id: string; kind: Kind }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<null | 'approve' | 'deny'>(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const confirm = () => {
    if (!mode) return;
    setErr(null);
    startTransition(async () => {
      const res = await FN[kind](id, mode === 'approve', note);
      if (res.ok) router.refresh();
      else setErr(res.error ?? 'Could not save the decision.');
    });
  };

  if (!mode) {
    return (
      <div className="flex shrink-0 items-center gap-1.5">
        <button onClick={() => { setMode('deny'); setErr(null); }} className="flex h-8 items-center gap-1 rounded-lg bg-brick-500/10 px-2.5 text-xs font-semibold text-brick-600 hover:bg-brick-500/20">
          <X size={15} /> Deny
        </button>
        <button onClick={() => { setMode('approve'); setErr(null); }} className="flex h-8 items-center gap-1 rounded-lg bg-green-600 px-3 text-xs font-semibold text-white hover:bg-green-700">
          <Check size={15} /> Approve
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 w-full space-y-2 rounded-lg border border-brand-100 bg-brand-50 p-2">
      <p className="text-xs font-semibold text-brand-700">
        {mode === 'approve' ? 'Approve this request' : 'Deny this request'}
      </p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder={mode === 'approve' ? 'Optional note to the employee…' : 'Reason for denying (shared with the employee)…'}
        className="input text-sm"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={confirm}
          disabled={pending}
          className={`flex h-8 flex-1 items-center justify-center gap-1 rounded-lg px-3 text-xs font-semibold text-white ${mode === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-brick-600 hover:bg-brick-700'}`}
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : mode === 'approve' ? <><Check size={14} /> Confirm approve</> : <><X size={14} /> Confirm deny</>}
        </button>
        <button onClick={() => { setMode(null); setNote(''); setErr(null); }} disabled={pending} className="btn-secondary h-8 px-3 text-xs">Cancel</button>
      </div>
      {err && <p className="text-xs text-brick-600">{err}</p>}
    </div>
  );
}
