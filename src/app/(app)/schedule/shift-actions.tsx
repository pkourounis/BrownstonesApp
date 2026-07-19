'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Hand, X, Loader2, Check } from 'lucide-react';
import { offerShift, cancelOffer, claimShift } from '../approvals/actions';

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
