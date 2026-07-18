'use client';

import { useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Store } from 'lucide-react';
import type { Location } from '@/lib/database.types';

export function StoreSelect({ locations, store }: { locations: Pick<Location, 'id' | 'name'>[]; store: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const go = (id: string) => {
    const p = new URLSearchParams(params.toString());
    p.set('store', id);
    startTransition(() => router.push(`/schedule?${p.toString()}`));
  };

  return (
    <div className={`no-print flex items-center gap-2 ${pending ? 'opacity-60' : ''}`}>
      <Store size={16} className="shrink-0 text-brand-500" />
      <select value={store} onChange={(e) => go(e.target.value)} className="input h-9 flex-1 text-sm" aria-label="Store">
        {locations.map((l) => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>
    </div>
  );
}
