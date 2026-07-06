import Link from 'next/link';
import { LogOut } from 'lucide-react';
import type { Profile } from '@/lib/database.types';
import { roleLabel } from '@/lib/auth';
import { Wordmark } from '@/components/wordmark';

export function AppHeader({ profile }: { profile: Profile }) {
  const name = profile.display_name || profile.full_name || 'Team member';
  return (
    <header className="sticky top-0 z-20 border-b border-brand-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" aria-label="Brownstones Coffee home">
          <Wordmark size="sm" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="text-right leading-tight">
            <p className="text-sm font-semibold text-brand-900">{name}</p>
            <p className="text-[11px] uppercase tracking-wide text-brand-500">
              {roleLabel(profile.role)}
            </p>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              aria-label="Sign out"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-400 hover:bg-brand-100 hover:text-brand-700"
            >
              <LogOut size={18} />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
