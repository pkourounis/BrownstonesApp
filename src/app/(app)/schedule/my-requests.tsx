'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2 } from 'lucide-react';
import type { RequestStatus } from '@/lib/database.types';
import { cancelTimeOff } from '../approvals/actions';

export type MyReq = { id: string; start_date: string; end_date: string; reason: string | null; status: RequestStatus };

const fmt = (d: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(d + 'T12:00:00'));

const BADGE: Record<RequestStatus, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', cls: 'bg-green-100 text-green-700' },
  denied: { label: 'Declined', cls: 'bg-brick-500/15 text-brick-600' },
  cancelled: { label: 'Cancelled', cls: 'bg-brand-100 text-brand-500' },
};

export function MyRequests({ requests }: { requests: MyReq[] }) {
  const router = useRouter();
  const [list, setList] = useState(requests);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!list.length) return null;

  const cancel = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await cancelTimeOff(id);
      if (res?.ok) { setList((cur) => cur.filter((r) => r.id !== id)); router.refresh(); }
      else { setError(res?.error ?? 'Could not remove that request.'); setBusyId(null); }
    } catch {
      setError('Something went wrong. Please try again.');
      setBusyId(null);
    }
  };

  return (
    <section>
      <h2 className="mb-2 font-semibold text-brand-900">My time-off requests</h2>
      <ul className="space-y-2">
        {list.map((r) => {
          const b = BADGE[r.status];
          const removable = r.status === 'pending' || r.status === 'denied' || r.status === 'cancelled';
          return (
            <li key={r.id} className="card flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-brand-900">
                  {fmt(r.start_date)}{r.end_date !== r.start_date ? ` – ${fmt(r.end_date)}` : ''}
                </p>
                {r.reason && <p className="truncate text-xs text-brand-500">{r.reason}</p>}
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${b.cls}`}>{b.label}</span>
              {removable && (
                <button onClick={() => cancel(r.id)} disabled={busyId === r.id} className="shrink-0 rounded-full p-1 text-brand-300 hover:bg-brand-100 hover:text-brick-600 disabled:opacity-50" aria-label={r.status === 'pending' ? 'Cancel request' : 'Dismiss request'}>
                  {busyId === r.id ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-1 text-xs text-brick-600">{error}</p>}
    </section>
  );
}
