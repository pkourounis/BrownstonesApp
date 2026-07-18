'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Send, Gauge } from 'lucide-react';
import type { Location } from '@/lib/database.types';
import { publishWeek } from './actions';

export function BuilderControls({
  locations,
  store,
  monday,
  weekLabel,
  draftCount,
}: {
  locations: Pick<Location, 'id' | 'name'>[];
  store: string | null;
  monday: string;
  weekLabel: string;
  draftCount: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const push = (next: Record<string, string>) => {
    const p = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([k, v]) => {
      if (!v || (k === 'store' && v === 'all')) p.delete(k);
      else p.set(k, v);
    });
    startTransition(() => router.push(`/schedule/build?${p.toString()}`));
  };

  const shiftWeek = (delta: number) => {
    const d = new Date(monday + 'T12:00:00');
    d.setDate(d.getDate() + delta * 7);
    push({ week: d.toISOString().slice(0, 10) });
  };

  const onPublish = () => {
    if (!store) return;
    setMsg(null);
    startTransition(async () => {
      const res = await publishWeek(store, monday);
      setMsg(res.ok ? `Published ${res.count ?? 0} shift${res.count === 1 ? '' : 's'}.` : res.error ?? 'Publish failed.');
      if (res.ok) router.refresh();
    });
  };

  return (
    <div className={`space-y-3 ${pending ? 'opacity-60' : ''}`}>
      <select
        value={store ?? ''}
        onChange={(e) => push({ store: e.target.value })}
        className="input h-10 w-full text-sm"
        aria-label="Store"
      >
        <option value="">Pick a store…</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>

      <div className="flex items-center justify-between gap-2">
        <button onClick={() => shiftWeek(-1)} className="btn-secondary h-9 px-2" aria-label="Previous week">
          <ChevronLeft size={16} />
        </button>
        <span className="flex-1 text-center text-sm font-semibold text-brand-800">{weekLabel}</span>
        <button onClick={() => shiftWeek(1)} className="btn-secondary h-9 px-2" aria-label="Next week">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Link href={`/schedule/staffing${store ? `?store=${store}` : ''}`} className="btn-secondary h-9 flex-1 justify-center text-xs">
          <Gauge size={14} /> Staffing guide
        </Link>
        <button onClick={onPublish} disabled={pending || !store || draftCount === 0} className="btn-primary h-9 flex-1 justify-center text-xs">
          <Send size={14} /> Publish{draftCount > 0 ? ` (${draftCount})` : ''}
        </button>
      </div>

      {msg && <p className="text-center text-xs text-brand-600">{msg}</p>}
    </div>
  );
}
