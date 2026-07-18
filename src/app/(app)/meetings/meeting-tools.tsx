'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Star, Loader2, Check, Trash2 } from 'lucide-react';
import type { MeetingType } from '@/lib/database.types';
import { requestMeeting, completeMeeting, cancelMeeting } from './actions';
import { MEETING_TYPES } from './constants';

type Person = { id: string; name: string };

export function RequestMeeting({ people, presetEmployee }: { people: Person[]; presetEmployee?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ employee_id: presetEmployee ?? '', type: 'review' as MeetingType, date: '', time: '09:00', location: '', description: '' });
  const [error, setError] = useState<string | null>(null);

  // Auto-open when arriving with a preset employee (?new=<id>).
  useEffect(() => {
    if (presetEmployee) setOpen(true);
  }, [presetEmployee]);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await requestMeeting(f);
      if (res.ok) { setOpen(false); setF({ employee_id: '', type: 'review', date: '', time: '09:00', location: '', description: '' }); router.refresh(); }
      else setError(res.error ?? 'Could not schedule.');
    });
  };

  if (!open) return <button onClick={() => setOpen(true)} className="btn-primary h-9 px-3 text-xs"><Plus size={15} /> Request meeting</button>;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={() => !pending && setOpen(false)}>
      <div className="max-h-[92vh] w-full space-y-3 overflow-y-auto rounded-t-3xl bg-white p-4 shadow-xl sm:max-w-md sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-brand-900">Request a meeting</h2>
          <button onClick={() => setOpen(false)} className="text-brand-300 hover:text-brand-600" aria-label="Close"><X size={18} /></button>
        </div>
        <div>
          <label className="label">With</label>
          <select value={f.employee_id} onChange={(e) => setF({ ...f, employee_id: e.target.value })} className="input h-9 text-sm">
            <option value="">Pick someone…</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Meeting type</label>
          <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as MeetingType })} className="input h-9 text-sm">
            {MEETING_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="label">Date</label><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className="input h-9 text-sm" /></div>
          <div><label className="label">Time</label><input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} className="input h-9 text-sm" /></div>
        </div>
        <div>
          <label className="label">Location</label>
          <input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="e.g. Manager's office, Amityville" className="input h-9 text-sm" />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="What's this meeting about?" className="input min-h-[80px] text-sm" />
        </div>
        <button onClick={submit} disabled={pending || !f.employee_id || !f.date} className="btn-primary h-10 w-full justify-center text-sm">
          {pending ? <Loader2 size={16} className="animate-spin" /> : 'Schedule meeting'}
        </button>
        {error && <p className="text-xs text-brick-600">{error}</p>}
      </div>
    </div>
  );
}

export function MeetingActions({ id, isReview }: { id: string; isReview: boolean }) {
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
      const res = await completeMeeting(id, rating, notes);
      if (res.ok) { setOpen(false); router.refresh(); } else setError(res.error ?? 'Could not save.');
    });
  };

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button onClick={() => setOpen(true)} className="btn-primary h-8 px-3 text-xs"><Check size={14} /> Complete</button>
      <button onClick={() => startTransition(async () => { await cancelMeeting(id); router.refresh(); })} disabled={pending} className="text-brand-300 hover:text-brick-600" aria-label="Remove meeting"><Trash2 size={15} /></button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={() => !pending && setOpen(false)}>
          <div className="w-full space-y-3 rounded-t-3xl bg-white p-4 shadow-xl sm:max-w-md sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-brand-900">Complete meeting</h2>
              <button onClick={() => setOpen(false)} className="text-brand-300 hover:text-brand-600" aria-label="Close"><X size={18} /></button>
            </div>
            {isReview && (
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
            )}
            <div>
              <label className="label">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was discussed, outcomes, next steps…" className="input min-h-[100px] text-sm" />
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
