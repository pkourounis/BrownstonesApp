'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserCheck, Loader2 } from 'lucide-react';
import { grantAccessBatch } from './actions';

export function GrantAll({ pendingCount }: { pendingCount: number }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(pendingCount);

  if (pendingCount === 0) return null;

  const run = async () => {
    setRunning(true);
    let rem = remaining;
    let guard = 0;
    while (rem > 0 && guard < 40) {
      const res = await grantAccessBatch(12);
      guard++;
      if (!res.ok) break;
      rem = res.remaining;
      setRemaining(rem);
    }
    setRunning(false);
    router.refresh();
  };

  return (
    <div className="card border-gold-400 bg-gold-100/60">
      <p className="text-sm font-medium text-brand-900">{remaining} roster members don&apos;t have app access yet</p>
      <p className="mt-0.5 text-xs text-brand-600">
        Give everyone a login so they can use chat, the feed, and their schedule. They sign in with their email (magic link) or a temporary password.
      </p>
      {confirm ? (
        <div className="mt-2 flex gap-2">
          <button onClick={run} disabled={running} className="btn-primary h-9 flex-1 text-sm">
            {running ? <><Loader2 size={15} className="animate-spin" /> {remaining} left…</> : `Yes, grant access to ${remaining}`}
          </button>
          {!running && (
            <button onClick={() => setConfirm(false)} className="btn-secondary h-9 px-3 text-sm">Cancel</button>
          )}
        </div>
      ) : (
        <button onClick={() => setConfirm(true)} className="btn-secondary mt-2 h-9 w-full text-sm">
          <UserCheck size={15} /> Give everyone app access
        </button>
      )}
    </div>
  );
}
