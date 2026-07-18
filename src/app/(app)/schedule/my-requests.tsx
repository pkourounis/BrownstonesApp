'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
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
  const [pending, startTransition] = useTransition();
  if (!requests.length) return null;

  const cancel = (id: string) => startTransition(async () => { await cancelTimeOff(id); router.refresh(); });

  return (
    <section>
      <h2 className="mb-2 font-semibold text-brand-900">My time-off requests</h2>
      <ul className="space-y-2">
        {requests.map((r) => {
          const b = BADGE[r.status];
          return (
            <li key={r.id} className="card flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-brand-900">
                  {fmt(r.start_date)}{r.end_date !== r.start_date ? ` – ${fmt(r.end_date)}` : ''}
                </p>
                {r.reason && <p className="truncate text-xs text-brand-500">{r.reason}</p>}
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${b.cls}`}>{b.label}</span>
              {r.status === 'pending' && (
                <button onClick={() => cancel(r.id)} disabled={pending} className="shrink-0 text-brand-300 hover:text-brick-600" aria-label="Cancel request">
                  <X size={16} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
