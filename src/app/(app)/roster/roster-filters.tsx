'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import type { Location } from '@/lib/database.types';
import { JOB_ROLES } from '@/lib/job-roles';

const DEPARTMENTS: [string, string][] = [
  ['foh', 'Front of House'],
  ['boh', 'Back of House'],
  ['management', 'Management'],
];

export function RosterFilters({ locations }: { locations: Pick<Location, 'id' | 'name'>[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get('q') ?? '');

  const push = (next: Record<string, string>) => {
    const p = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([k, v]) => {
      if (!v) p.delete(k);
      else p.set(k, v);
    });
    startTransition(() => router.push(`/roster?${p.toString()}`));
  };

  return (
    <div className={`space-y-2 ${pending ? 'opacity-60' : ''}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          push({ q });
        }}
        className="relative"
      >
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name…"
          className="input h-10 w-full pl-9 text-sm"
          aria-label="Search name"
        />
      </form>
      <div className="grid grid-cols-2 gap-2">
        <select value={params.get('store') ?? ''} onChange={(e) => push({ store: e.target.value })} className="input h-9 text-sm" aria-label="Location">
          <option value="">All locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <select value={params.get('dept') ?? ''} onChange={(e) => push({ dept: e.target.value })} className="input h-9 text-sm" aria-label="Department">
          <option value="">All departments</option>
          {DEPARTMENTS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select value={params.get('title') ?? ''} onChange={(e) => push({ title: e.target.value })} className="input h-9 text-sm" aria-label="Job role">
          <option value="">All roles</option>
          {JOB_ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select value={params.get('status') ?? 'active'} onChange={(e) => push({ status: e.target.value })} className="input h-9 text-sm" aria-label="Status">
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </select>
      </div>
    </div>
  );
}
