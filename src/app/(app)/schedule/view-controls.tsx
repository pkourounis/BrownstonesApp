'use client';

import { useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const VIEWS: { key: string; label: string }[] = [
  { key: 'list', label: 'Next 2 weeks' },
  { key: 'week', label: 'Week' },
  { key: 'weekend', label: 'Weekend' },
];

export function ViewControls({ view, weekLabel, monday }: { view: string; weekLabel: string; monday: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const go = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    startTransition(() => router.push(`/schedule?${p.toString()}`));
  };

  const shiftWeek = (delta: number) => {
    const d = new Date(monday + 'T12:00:00');
    d.setDate(d.getDate() + delta * 7);
    go({ week: d.toISOString().slice(0, 10) });
  };

  return (
    <div className={`space-y-2 ${pending ? 'opacity-60' : ''}`}>
      <div className="flex gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => go({ view: v.key === 'list' ? null : v.key, ...(v.key === 'list' ? { week: null } : {}) })}
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold ${view === v.key ? 'bg-brand-700 text-white' : 'bg-brand-100 text-brand-600'}`}
          >
            {v.label}
          </button>
        ))}
      </div>
      {view !== 'list' && (
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => shiftWeek(-1)} className="btn-secondary h-8 px-2" aria-label="Previous week"><ChevronLeft size={16} /></button>
          <span className="flex-1 text-center text-sm font-semibold text-brand-800">{weekLabel}</span>
          <button onClick={() => shiftWeek(1)} className="btn-secondary h-8 px-2" aria-label="Next week"><ChevronRight size={16} /></button>
        </div>
      )}
    </div>
  );
}
