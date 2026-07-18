'use client';

import { useState } from 'react';
import { ChevronDown, CircleDot } from 'lucide-react';
import { money2 } from '@/lib/format';

type OnPerson = { name: string; in_at: string | null };
type Store = { id: string; name: string; net: number; prev: number; on_now: number; on: OnPerson[] };

const fmtTime = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(new Date(iso)) : '';

export function StoreBoard({ stores }: { stores: Store[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <ul className="space-y-2">
      {stores.map((st) => {
        const isOpen = open === st.id;
        return (
          <li key={st.id} className="card overflow-hidden p-0">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : st.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-brand-900">{st.name}</p>
                <p className="flex items-center gap-1 text-xs text-brand-500">
                  {st.on_now > 0 ? (
                    <>
                      <CircleDot size={11} className="text-green-500" /> {st.on_now} on the clock
                    </>
                  ) : (
                    'none clocked in'
                  )}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-bold tabular-nums text-brand-900">{money2(st.net)}</p>
                <p className="text-[11px] tabular-nums text-brand-400">yest {money2(st.prev)}</p>
              </div>
              {st.on_now > 0 && (
                <ChevronDown size={16} className={`shrink-0 text-brand-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              )}
            </button>

            {isOpen && st.on.length > 0 && (
              <ul className="border-t border-brand-100 bg-brand-50 px-4 py-2">
                {st.on.map((p, i) => (
                  <li key={i} className="flex items-center justify-between py-1 text-sm">
                    <span className="text-brand-800">{p.name}</span>
                    {p.in_at && <span className="text-xs tabular-nums text-brand-500">since {fmtTime(p.in_at)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
