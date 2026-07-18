'use client';

import { useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Location } from '@/lib/database.types';

/** Store selector + day picker (with prev/next) for the timesheet view. */
export function TimesheetFilter({
  locations,
  date,
}: {
  locations: Pick<Location, 'id' | 'name'>[];
  date: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const store = params.get('store') ?? 'all';

  const go = (next: Record<string, string>) => {
    const p = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([k, v]) => {
      if (!v || v === 'all') p.delete(k);
      else p.set(k, v);
    });
    startTransition(() => router.push(`/timesheets?${p.toString()}`));
  };

  const shiftDay = (delta: number) => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    go({ date: d.toISOString().slice(0, 10) });
  };

  return (
    <div className={`flex items-center gap-2 ${pending ? 'opacity-60' : ''}`}>
      <select
        value={store}
        onChange={(e) => go({ store: e.target.value })}
        className="input h-9 min-w-0 flex-1 text-sm"
        aria-label="Store"
      >
        <option value="all">All stores</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <button onClick={() => shiftDay(-1)} className="btn-secondary h-9 shrink-0 px-2" aria-label="Previous day">
        <ChevronLeft size={16} />
      </button>
      <input
        type="date"
        value={date}
        onChange={(e) => e.target.value && go({ date: e.target.value })}
        className="input h-9 shrink-0 text-sm"
        aria-label="Date"
      />
      <button onClick={() => shiftDay(1)} className="btn-secondary h-9 shrink-0 px-2" aria-label="Next day">
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
