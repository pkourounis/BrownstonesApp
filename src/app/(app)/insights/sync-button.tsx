'use client';

import { useState, useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { syncToastNow } from './actions';

export function SyncButton() {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const router = useRouter();

  const onClick = () => {
    setStatus('idle');
    startTransition(async () => {
      const res = await syncToastNow();
      if (res.ok) {
        setStatus('ok');
        router.refresh();
      } else {
        setStatus('err');
      }
    });
  };

  return (
    <button
      onClick={onClick}
      disabled={pending}
      className="btn-secondary shrink-0 whitespace-nowrap px-3 py-2 text-xs"
      title="Pull today's sales from Toast"
    >
      <RefreshCw size={14} className={pending ? 'animate-spin' : ''} />
      {pending ? 'Syncing…' : status === 'ok' ? 'Updated' : status === 'err' ? 'Retry' : 'Sync now'}
    </button>
  );
}
