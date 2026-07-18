'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, PenSquare, X, Users, Hash } from 'lucide-react';
import { openDm } from './actions';

export type Convo = {
  id: string;
  kind: 'store' | 'managers' | 'dm';
  label: string;
  avatar: string | null;
  preview: string;
  time: string | null;
};

const fmt = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(d)
    : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
};

function ConvoIcon({ c }: { c: Convo }) {
  if (c.kind === 'dm') {
    return c.avatar ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={c.avatar} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
    ) : (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-200 text-sm font-semibold text-brand-700">
        {c.label.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white">
      {c.kind === 'managers' ? <Users size={18} /> : <Hash size={18} />}
    </span>
  );
}

export function ConversationList({
  convos,
  activeId,
  teammates,
}: {
  convos: Convo[];
  activeId: string | null;
  teammates: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [compose, setCompose] = useState(false);
  const [pending, startTransition] = useTransition();

  const filtered = q.trim()
    ? convos.filter((c) => c.label.toLowerCase().includes(q.trim().toLowerCase()))
    : convos;
  const peopleFiltered = q.trim()
    ? teammates.filter((t) => t.name.toLowerCase().includes(q.trim().toLowerCase()))
    : teammates;

  const start = (id: string) =>
    startTransition(async () => {
      const res = await openDm(id);
      if (res.ok && res.channelId) {
        setCompose(false);
        setQ('');
        router.push(`/chat?c=${res.channelId}`);
        router.refresh();
      }
    });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-3 pb-3">
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={compose ? 'Search people…' : 'Search chats…'}
            className="input h-10 w-full pl-9 text-sm"
          />
        </div>
        <button
          onClick={() => { setCompose((v) => !v); setQ(''); }}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${compose ? 'bg-brand-100 text-brand-600' : 'bg-brand-700 text-white'}`}
          aria-label={compose ? 'Cancel' : 'New message'}
        >
          {compose ? <X size={18} /> : <PenSquare size={18} />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {compose ? (
          <>
            <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-brand-400">Message someone</p>
            {peopleFiltered.length === 0 ? (
              <p className="px-2 py-3 text-sm text-brand-400">No teammates found.</p>
            ) : (
              peopleFiltered.map((t) => (
                <button
                  key={t.id}
                  onClick={() => start(t.id)}
                  disabled={pending}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-brand-100"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-200 text-xs font-semibold text-brand-700">
                    {t.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="truncate text-sm font-medium text-brand-900">{t.name}</span>
                </button>
              ))
            )}
          </>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-brand-400">No conversations yet.</p>
        ) : (
          filtered.map((c) => (
            <Link
              key={c.id}
              href={`/chat?c=${c.id}`}
              className={`flex items-center gap-3 rounded-xl px-2 py-2.5 ${c.id === activeId ? 'bg-brand-100' : 'hover:bg-brand-50'}`}
            >
              <ConvoIcon c={c} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-brand-900">{c.label}</p>
                  {c.time && <span className="shrink-0 text-[10px] text-brand-400">{fmt(c.time)}</span>}
                </div>
                <p className="truncate text-xs text-brand-500">{c.preview || 'No messages yet'}</p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
