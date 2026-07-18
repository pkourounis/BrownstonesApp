'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ack', label: 'Needs acknowledgment' },
  { key: 'announcement', label: 'Announcements' },
  { key: 'post', label: 'Posts' },
  { key: 'product', label: 'New products' },
  { key: 'seasonal', label: 'Seasonal' },
  { key: 'menu', label: 'Menu changes' },
];

export function FeedFilters() {
  const sp = useSearchParams();
  const active = sp.get('filter') || 'all';

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {FILTERS.map((f) => (
        <Link
          key={f.key}
          href={f.key === 'all' ? '/feed' : `/feed?filter=${f.key}`}
          scroll={false}
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
            active === f.key ? 'bg-brand-700 text-white' : 'bg-brand-100 text-brand-600'
          }`}
        >
          {f.label}
        </Link>
      ))}
    </div>
  );
}
