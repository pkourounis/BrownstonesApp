'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Check, Loader2 } from 'lucide-react';
import { acknowledgePost } from '../feed/actions';

type Item = { id: string; title: string | null; body: string };

export function AckList({ items }: { items: Item[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const ack = (id: string) => {
    setBusy(id);
    startTransition(async () => {
      await acknowledgePost(id);
      setDone((prev) => new Set(prev).add(id));
      setBusy(null);
      router.refresh();
    });
  };

  const visible = items.filter((i) => !done.has(i.id));
  if (visible.length === 0) return null;

  return (
    <div className="card border-l-4 border-l-gold-500 bg-gold-100/60">
      <div className="mb-2 flex items-center gap-2">
        <ShieldCheck size={18} className="text-brand-700" />
        <h2 className="font-semibold text-brand-900">Needs your acknowledgment</h2>
      </div>
      <ul className="space-y-2">
        {visible.map((i) => (
          <li key={i.id} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5">
            <div className="min-w-0 flex-1">
              {i.title && <p className="truncate text-sm font-semibold text-brand-900">{i.title}</p>}
              <p className="truncate text-xs text-brand-600">{i.body || 'Tap to acknowledge you’ve seen this.'}</p>
            </div>
            <button
              onClick={() => ack(i.id)}
              disabled={pending && busy === i.id}
              className="btn-primary h-8 shrink-0 px-3 text-xs"
            >
              {pending && busy === i.id ? <Loader2 size={14} className="animate-spin" /> : <><Check size={14} /> Acknowledge</>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
