'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PenSquare, X } from 'lucide-react';
import { openDm } from './actions';

export function NewDm({ teammates }: { teammates: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const start = (id: string) =>
    startTransition(async () => {
      const res = await openDm(id);
      if (res.ok && res.channelId) {
        setOpen(false);
        router.push(`/chat?c=${res.channelId}`);
        router.refresh();
      }
    });

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="shrink-0 rounded-full bg-brand-100 p-2 text-brand-600 hover:bg-brand-200"
        aria-label="New direct message"
      >
        {open ? <X size={16} /> : <PenSquare size={16} />}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-20 max-h-72 w-56 overflow-y-auto rounded-xl border border-brand-100 bg-white p-1 shadow-xl">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-brand-400">Message someone</p>
          {teammates.length === 0 ? (
            <p className="px-3 py-2 text-sm text-brand-400">No teammates found.</p>
          ) : (
            teammates.map((t) => (
              <button
                key={t.id}
                onClick={() => start(t.id)}
                disabled={pending}
                className="block w-full truncate rounded-lg px-3 py-2 text-left text-sm text-brand-800 hover:bg-brand-100"
              >
                {t.name}
              </button>
            ))
          )}
        </div>
      )}
    </>
  );
}
