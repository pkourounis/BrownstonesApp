'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Star, Loader2, Check, Trash2 } from 'lucide-react';
import { requestReview, completeReview, cancelReview } from './actions';

type Person = { id: string; name: string };

export function RequestReview({ people }: { people: Person[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [profileId, setProfileId] = useState('');
  const [due, setDue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await requestReview(profileId, due);
      if (res.ok) { setOpen(false); setProfileId(''); setDue(''); router.refresh(); }
      else setError(res.error ?? 'Could not schedule.');
    });
  };

  if (!open) return <button onClick={() => setOpen(true)} className="btn-primary h-9 px-3 text-xs"><Plus size={15} /> Request review</button>;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={() => !pending && setOpen(false)}>
      <div className="w-full space-y-3 rounded-t-3xl bg-white p-4 shadow-xl sm:max-w-md sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-brand-900">Request a review</h2>
          <button onClick={() => setOpen(false)} className="text-brand-300 hover:text-brand-600" aria-label="Close"><X size={18} /></button>
        </div>
        <div>
          <label className="label">Team member</label>
          <select value={profileId} onChange={(e) => setProfileId(e.target.value)} className="input h-9 text-sm">
            <option value="">Pick someone…</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Due date (defaults to 6 months out)</label>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="input h-9 text-sm" />
        </div>
        <button onClick={submit} disabled={pending || !profileId} className="btn-primary h-10 w-full justify-center text-sm">
          {pending ? <Loader2 size={16} className="animate-spin" /> : 'Schedule review'}
        </button>
        {error && <p className="text-xs text-brick-600">{error}</p>}
      </div>
    </div>
  );
}

export function ReviewActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const complete = () => {
    setError(null);
    startTransition(async () => {
      const res = await completeReview(id, rating, notes);
      if (res.ok) { setOpen(false); router.refresh(); } else setError(res.error ?? 'Could not save.');
    });
  };

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button onClick={() => setOpen(true)} className="btn-primary h-8 px-3 text-xs"><Check size={14} /> Complete</button>
      <button onClick={() => startTransition(async () => { await cancelReview(id); router.refresh(); })} disabled={pending} className="text-brand-300 hover:text-brick-600" aria-label="Remove review"><Trash2 size={15} /></button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={() => !pending && setOpen(false)}>
          <div className="w-full space-y-3 rounded-t-3xl bg-white p-4 shadow-xl sm:max-w-md sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-brand-900">Complete review</h2>
              <button onClick={() => setOpen(false)} className="text-brand-300 hover:text-brand-600" aria-label="Close"><X size={18} /></button>
            </div>
            <div>
              <label className="label">Rating</label>
              <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onMouseEnter={() => setHover(n)} onClick={() => setRating(rating === n ? 0 : n)} className="p-0.5">
                    <Star size={28} className={(hover || rating) >= n ? 'fill-gold-400 text-gold-500' : 'text-brand-200'} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Strengths, goals, feedback…" className="input min-h-[100px] text-sm" />
            </div>
            <button onClick={complete} disabled={pending} className="btn-primary h-10 w-full justify-center text-sm">
              {pending ? <Loader2 size={16} className="animate-spin" /> : 'Save & mark complete'}
            </button>
            {error && <p className="text-xs text-brick-600">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
