'use client';

import { useState } from 'react';
import { ChevronDown, CircleDot } from 'lucide-react';
import { money2 } from '@/lib/format';

type OnPerson = { name: string; in_at: string | null; role: string | null; dept: string | null };
type Store = {
  id: string;
  name: string;
  net: number;
  prev: number;
  on_now: number;
  on_foh: number;
  on_boh: number;
  on_mgmt: number;
  on: OnPerson[];
};

const fmtTime = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(new Date(iso)) : '';

const DEPT: Record<string, { label: string; cls: string }> = {
  foh: { label: 'FOH', cls: 'bg-gold-100 text-brand-700' },
  boh: { label: 'BOH', cls: 'bg-brand-100 text-brand-700' },
  management: { label: 'MGR', cls: 'bg-brick-500/15 text-brick-600' },
};

export function StoreBoard({ stores }: { stores: Store[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <ul className="space-y-2">
      {stores.map((st) => {
        const isOpen = open === st.id;
        const parts = [
          st.on_foh ? `${st.on_foh} FOH` : null,
          st.on_boh ? `${st.on_boh} BOH` : null,
          st.on_mgmt ? `${st.on_mgmt} Mgr` : null,
        ].filter(Boolean);
        return (
          <li key={st.id} className="card overflow-hidden p-0">
            <button type="button" onClick={() => setOpen(isOpen ? null : st.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-brand-900">{st.name}</p>
                <p className="flex items-center gap-1 text-xs text-brand-500">
                  {st.on_now > 0 ? (
                    <>
                      <CircleDot size={11} className="text-green-500" /> {st.on_now} on
                      {parts.length > 0 ? ` · ${parts.join(' · ')}` : ''}
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
              {st.on_now > 0 && <ChevronDown size={16} className={`shrink-0 text-brand-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
            </button>

            {isOpen && st.on.length > 0 && (
              <ul className="border-t border-brand-100 bg-brand-50 px-4 py-2">
                {st.on.map((p, i) => {
                  const d = p.dept ? DEPT[p.dept] : null;
                  return (
                    <li key={i} className="flex items-center gap-2 py-1 text-sm">
                      <span className={`w-9 shrink-0 rounded px-1 py-0.5 text-center text-[10px] font-bold ${d?.cls ?? 'bg-brand-100 text-brand-400'}`}>
                        {d?.label ?? '—'}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-brand-800">
                        {p.name}
                        {p.role ? <span className="text-brand-400"> · {p.role}</span> : ''}
                      </span>
                      {p.in_at && <span className="shrink-0 text-xs tabular-nums text-brand-500">since {fmtTime(p.in_at)}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
