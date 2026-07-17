'use client';

import { useState } from 'react';
import { money, moneyShort } from '@/lib/format';

export type Bar = { label: string; value: number; peak: boolean; full?: string };

/** Interactive bar chart: gradient bars, value axis + gridlines, tap to read out. */
export function BarChart({ bars, max, showEvery = 1 }: { bars: Bar[]; max: number; showEvery?: number }) {
  const [sel, setSel] = useState<number | null>(null);
  const active = sel != null ? bars[sel] : null;
  const ticks = 4;

  return (
    <div>
      <div className="mb-2 flex h-9 items-center justify-between rounded-lg border border-brand-100 bg-brand-50 px-3">
        {active ? (
          <>
            <span className="truncate text-sm font-semibold text-brand-800">{active.full ?? active.label}</span>
            <span className="shrink-0 pl-2 text-sm font-bold tabular-nums text-brick-600">{money(active.value)}</span>
          </>
        ) : (
          <span className="text-xs text-brand-400">Tap a bar to see the numbers</span>
        )}
      </div>

      <div className="flex gap-2">
        <div className="relative h-40 w-10 shrink-0">
          {Array.from({ length: ticks + 1 }).map((_, i) => (
            <span
              key={i}
              className="absolute right-0 -translate-y-1/2 text-[9px] tabular-nums text-brand-400"
              style={{ top: `${(i / ticks) * 100}%` }}
            >
              {moneyShort((max * (ticks - i)) / ticks)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative h-40 border-b border-l border-brand-100">
            {Array.from({ length: ticks }).map((_, i) => (
              <div key={i} className="absolute inset-x-0 border-t border-dashed border-brand-100" style={{ top: `${(i / ticks) * 100}%` }} />
            ))}
            <div className="absolute inset-0 flex items-end gap-[3px] px-1">
              {bars.map((b, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSel(sel === i ? null : i)}
                  className="flex h-full min-w-0 flex-1 items-end justify-center focus:outline-none"
                  aria-label={`${b.full ?? b.label}: ${money(b.value)}`}
                >
                  <div
                    className={`w-full max-w-[26px] rounded-t-sm bg-gradient-to-t shadow-sm transition ${
                      b.peak ? 'from-brick-600 to-brick-400' : 'from-gold-500 to-gold-300'
                    } ${sel === i ? 'ring-2 ring-brand-700 ring-offset-1' : sel != null ? 'opacity-60' : ''}`}
                    style={{ height: `${Math.max(2, (b.value / max) * 100)}%` }}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="mt-1.5 flex gap-[3px] px-1">
            {bars.map((b, i) => (
              <div key={i} className="min-w-0 flex-1 text-center text-[9px] tabular-nums text-brand-400">
                {i % showEvery === 0 ? b.label : ''}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Compact, non-interactive 7-bar sparkline (gradient) for the forecast list. */
export function Sparkline({ bars, max }: { bars: Bar[]; max: number }) {
  return (
    <div className="flex h-9 items-end gap-[2px]">
      {bars.map((b, i) => (
        <div
          key={i}
          title={`${b.full ?? b.label}: ${money(b.value)}`}
          className={`min-w-0 flex-1 rounded-t-[2px] bg-gradient-to-t ${b.peak ? 'from-brick-600 to-brick-400' : 'from-gold-500 to-gold-300'}`}
          style={{ height: `${Math.max(6, (b.value / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}
