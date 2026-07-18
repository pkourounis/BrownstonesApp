'use client';

import { useState } from 'react';
import { money, hourLabel } from '@/lib/format';

export type HourPoint = { hour: number; value: number };

/**
 * Average sales per hour of day with the store's hourly sales goal drawn as a
 * reference line. Bars are colored by how close each hour got to the goal, so
 * it's obvious when the store hit (green), came close (gold), or fell short.
 */
export function HourlyGoalChart({ hours, goal }: { hours: HourPoint[]; goal: number }) {
  const [sel, setSel] = useState<number | null>(null);
  if (!hours.length) return <p className="text-sm text-brand-500">No hourly sales for this selection.</p>;

  const maxVal = Math.max(...hours.map((h) => h.value));
  const max = Math.max(maxVal, goal) * 1.08 || 1;
  const goalPct = goal > 0 ? (goal / max) * 100 : 0;
  const hitCount = goal > 0 ? hours.filter((h) => h.value >= goal).length : 0;
  const active = sel != null ? hours[sel] : null;

  const tone = (v: number) => {
    if (goal <= 0) return 'from-gold-500 to-gold-300';
    if (v >= goal) return 'from-green-600 to-green-400';
    if (v >= goal * 0.8) return 'from-gold-500 to-gold-300';
    return 'from-brand-300 to-brand-200';
  };

  return (
    <div>
      <div className="mb-2 flex h-9 items-center justify-between rounded-lg border border-brand-100 bg-brand-50 px-3">
        {active ? (
          <>
            <span className="truncate text-sm font-semibold text-brand-800">{hourLabel(active.hour)}</span>
            <span className="shrink-0 pl-2 text-sm font-bold tabular-nums text-brand-800">
              {money(active.value)}
              {goal > 0 && <span className={`ml-2 ${active.value >= goal ? 'text-green-700' : 'text-brand-400'}`}>{Math.round((active.value / goal) * 100)}% of goal</span>}
            </span>
          </>
        ) : (
          <span className="text-xs text-brand-400">
            {goal > 0 ? `Goal ${money(goal)}/hr · hit in ${hitCount} hour${hitCount === 1 ? '' : 's'} · tap a bar` : 'Tap a bar to see the numbers'}
          </span>
        )}
      </div>

      <div className="relative h-48 border-b border-l border-brand-100">
        {/* Goal line */}
        {goal > 0 && (
          <div className="pointer-events-none absolute inset-x-0 z-10" style={{ bottom: `${goalPct}%` }}>
            <div className="border-t-2 border-dashed border-brick-500/70" />
            <span className="absolute -top-2 right-0 rounded bg-brick-500/10 px-1 text-[9px] font-semibold text-brick-600">
              {money(goal)} goal
            </span>
          </div>
        )}
        <div className="absolute inset-0 flex items-end gap-[3px] px-1">
          {hours.map((h, i) => (
            <button
              key={h.hour}
              type="button"
              onClick={() => setSel(sel === i ? null : i)}
              className="flex h-full min-w-0 flex-1 items-end justify-center focus:outline-none"
              aria-label={`${hourLabel(h.hour)}: ${money(h.value)}`}
            >
              <div
                className={`w-full max-w-[30px] rounded-t-sm bg-gradient-to-t shadow-sm transition ${tone(h.value)} ${
                  sel === i ? 'ring-2 ring-brand-700 ring-offset-1' : sel != null ? 'opacity-60' : ''
                }`}
                style={{ height: `${Math.max(2, (h.value / max) * 100)}%` }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex gap-[3px] px-1">
        {hours.map((h) => (
          <div key={h.hour} className="min-w-0 flex-1 text-center text-[9px] tabular-nums text-brand-400">
            {h.hour % 2 === 0 ? hourLabel(h.hour).replace(':00', '') : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
