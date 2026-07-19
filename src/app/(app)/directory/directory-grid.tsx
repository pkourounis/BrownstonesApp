'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import type { DirectoryProfile } from '@/lib/database.types';
import { roleLabel } from '@/lib/roles';

function initials(p: DirectoryProfile): string {
  const name = p.display_name || p.full_name || `${p.first_name ?? ''} ${p.last_name ?? ''}`;
  return name.trim().split(/\s+/).map((n) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'BC';
}
const nameOf = (p: DirectoryProfile) =>
  p.display_name || p.full_name || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Team member';

export function DirectoryGrid({ people, meId }: { people: DirectoryProfile[]; meId: string }) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? people.filter((p) =>
        [nameOf(p), p.title, p.location_name, p.department, roleLabel(p.role)]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(needle))
      )
    : people;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, role, or store…"
          className="input h-10 w-full pl-9 text-sm"
        />
      </div>

      {shown.length === 0 ? (
        <div className="card text-center text-sm text-brand-500">No teammates match “{q}”.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((p) => (
            <Link
              key={p.id}
              href={`/directory/${p.id}`}
              className="card flex flex-col items-center gap-2 p-4 text-center transition hover:border-brand-300 hover:shadow-md"
            >
              {p.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.avatar_url} alt="" className="h-16 w-16 rounded-full border border-brand-100 object-cover" />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-200 text-lg font-semibold text-brand-700">
                  {initials(p)}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-brand-900">
                  {nameOf(p)}
                  {p.id === meId && <span className="text-brand-400"> (you)</span>}
                </p>
                <p className="truncate text-xs text-brand-500">{p.title || roleLabel(p.role)}</p>
                {p.location_name && <p className="truncate text-[11px] text-brand-400">{p.location_name}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
