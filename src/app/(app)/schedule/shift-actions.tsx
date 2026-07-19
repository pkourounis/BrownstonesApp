'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Hand, X, Loader2, Check, Repeat2 } from 'lucide-react';
import { offerShift, cancelOffer, claimShift, proposeSwap, respondSwap } from '../approvals/actions';

/** Shown on the current user's own upcoming shift: offer it up for grabs, or the pending state. */
export function OfferShift({ shiftId, offerId }: { shiftId: string; offerId: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (offerId) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Up for grabs</span>
        <button
          onClick={() => startTransition(async () => { await cancelOffer(offerId); router.refresh(); })}
          disabled={pending}
          className="text-[11px] font-medium text-brand-400 hover:text-brick-600"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (asking) {
    return (
      <div className="mt-2 w-full space-y-2 rounded-lg border border-brand-100 bg-brand-50 p-2">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (required)" className="input h-8 w-full text-xs" required />
        <div className="flex gap-2">
          <button
            onClick={() => startTransition(async () => {
              const res = await offerShift(shiftId, note);
              if (res.ok) { setAsking(false); router.refresh(); } else setError(res.error ?? 'Failed');
            })}
            disabled={pending || !note.trim()}
            className="btn-primary h-8 flex-1 justify-center text-xs"
          >
            {pending ? <Loader2 size={13} className="animate-spin" /> : <><Hand size={13} /> Put up for grabs</>}
          </button>
          <button onClick={() => setAsking(false)} className="btn-secondary h-8 px-3 text-xs">Cancel</button>
        </div>
        {error && <p className="text-xs text-brick-600">{error}</p>}
      </div>
    );
  }

  return (
    <button onClick={() => setAsking(true)} className="shrink-0 text-[11px] font-medium text-brand-500 hover:text-brand-800">
      <Hand size={13} className="mr-0.5 inline" /> Give up
    </button>
  );
}

/** Shown on an open drop from a teammate: claim it (pending manager approval). */
export function ClaimShift({ swapId, conflict = false }: { swapId: string; conflict?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (claimed) return <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-green-700"><Check size={14} /> Requested</span>;

  if (conflict) {
    return <span className="shrink-0 rounded-lg bg-brand-100 px-3 py-1.5 text-xs font-medium text-brand-400" title="You already have a shift that overlaps this time">Unavailable</span>;
  }

  return (
    <div className="flex shrink-0 flex-col items-end">
      <button
        onClick={() => startTransition(async () => {
          const res = await claimShift(swapId);
          if (res.ok) { setClaimed(true); router.refresh(); } else setError(res.error ?? 'Failed');
        })}
        disabled={pending}
        className="btn-primary h-8 px-3 text-xs"
      >
        {pending ? <Loader2 size={13} className="animate-spin" /> : "I'll take it"}
      </button>
      {error && <p className="mt-0.5 text-[10px] text-brick-600">{error}</p>}
    </div>
  );
}

/** On my own upcoming shift: propose a 1:1 trade for a coworker's shift. */
export function ProposeSwap({ myShiftId, candidates }: { myShiftId: string; candidates: { id: string; label: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState(false);
  const [target, setTarget] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) return <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-green-700"><Check size={14} /> Swap sent</span>;

  if (asking) {
    return (
      <div className="mt-2 w-full space-y-2 rounded-lg border border-brand-100 bg-brand-50 p-2">
        <p className="text-xs font-semibold text-brand-700">Trade this shift for a coworker&apos;s</p>
        <select value={target} onChange={(e) => setTarget(e.target.value)} className="input h-9 w-full text-sm">
          <option value="">Pick a coworker&apos;s shift…</option>
          {candidates.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="input h-9 w-full text-sm" />
        <div className="flex gap-2">
          <button
            onClick={() => startTransition(async () => {
              const res = await proposeSwap(myShiftId, target, note);
              if (res.ok) { setDone(true); router.refresh(); } else setError(res.error ?? 'Failed');
            })}
            disabled={pending || !target}
            className="btn-primary h-9 flex-1 justify-center text-xs"
          >
            {pending ? <Loader2 size={13} className="animate-spin" /> : <><Repeat2 size={13} /> Propose swap</>}
          </button>
          <button onClick={() => { setAsking(false); setError(null); }} className="btn-secondary h-9 px-3 text-xs">Cancel</button>
        </div>
        {error && <p className="text-xs text-brick-600">{error}</p>}
      </div>
    );
  }

  return (
    <button onClick={() => setAsking(true)} className="shrink-0 text-[11px] font-medium text-brand-500 hover:text-brand-800">
      <Repeat2 size={13} className="mr-0.5 inline" /> Swap
    </button>
  );
}

/** Coworker's accept/decline for an incoming 1:1 swap proposal. */
export function SwapResponse({ swapId }: { swapId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const go = (accept: boolean) =>
    startTransition(async () => {
      const res = await respondSwap(swapId, accept);
      if (res.ok) router.refresh();
      else setError(res.error ?? 'Failed');
    });

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <button onClick={() => go(false)} disabled={pending} className="flex h-8 items-center gap-1 rounded-lg bg-brick-500/10 px-2.5 text-xs font-semibold text-brick-600 hover:bg-brick-500/20">
          <X size={14} /> Decline
        </button>
        <button onClick={() => go(true)} disabled={pending} className="flex h-8 items-center gap-1 rounded-lg bg-green-600 px-3 text-xs font-semibold text-white hover:bg-green-700">
          {pending ? <Loader2 size={13} className="animate-spin" /> : <><Check size={14} /> Accept</>}
        </button>
      </div>
      {error && <p className="text-[10px] text-brick-600">{error}</p>}
    </div>
  );
}
