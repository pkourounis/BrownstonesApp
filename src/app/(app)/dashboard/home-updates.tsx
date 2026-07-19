'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Bell, X } from 'lucide-react';
import { markRead } from '../notifications/actions';

type Update = { id: string; title: string; body: string | null; link: string | null; created_at: string };

const rel = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
};

/** Home-screen updates (recent unread notifications) with a per-item dismiss. */
export function HomeUpdates({ updates }: { updates: Update[] }) {
  const [list, setList] = useState(updates);
  const [, startTransition] = useTransition();

  const dismiss = (id: string) => {
    setList((cur) => cur.filter((n) => n.id !== id));
    startTransition(() => { markRead(id); });
  };

  if (list.length === 0) return null;

  return (
    <ul className="space-y-2">
      {list.map((n) => {
        const inner = (
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700"><Bell size={15} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-brand-900">{n.title}</p>
              {n.body && <p className="text-sm text-brand-600">{n.body}</p>}
              <p className="mt-0.5 text-[11px] text-brand-400">{rel(n.created_at)}</p>
            </div>
          </div>
        );
        return (
          <li key={n.id} className="card flex items-start gap-2 border-l-4 border-l-brand-600 py-3">
            <div className="min-w-0 flex-1">
              {n.link ? <Link href={n.link}>{inner}</Link> : inner}
            </div>
            <button onClick={() => dismiss(n.id)} className="shrink-0 rounded-full p-1 text-brand-300 hover:bg-brand-100 hover:text-brand-700" aria-label="Dismiss update">
              <X size={16} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
