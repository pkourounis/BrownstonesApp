'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Loader2 } from 'lucide-react';
import { decideTimeOff, decideAvailability, decideSwap } from './actions';

type Kind = 'timeoff' | 'availability' | 'swap';

const FN: Record<Kind, (id: string, approve: boolean) => Promise<{ ok: boolean; error?: string }>> = {
  timeoff: decideTimeOff,
  availability: decideAvailability,
  swap: decideSwap,
};

export function Decide({ id, kind }: { id: string; kind: Kind }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const go = (approve: boolean) =>
    startTransition(async () => {
      await FN[kind](id, approve);
      router.refresh();
    });

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button onClick={() => go(false)} disabled={pending} className="flex h-8 w-8 items-center justify-center rounded-lg bg-brick-500/10 text-brick-600 hover:bg-brick-500/20" aria-label="Deny">
        {pending ? <Loader2 size={15} className="animate-spin" /> : <X size={16} />}
      </button>
      <button onClick={() => go(true)} disabled={pending} className="flex h-8 items-center gap-1 rounded-lg bg-green-600 px-3 text-xs font-semibold text-white hover:bg-green-700" aria-label="Approve">
        <Check size={15} /> Approve
      </button>
    </div>
  );
}
