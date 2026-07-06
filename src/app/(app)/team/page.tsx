import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { roleLabel } from '@/lib/auth';
import type { Profile } from '@/lib/database.types';

function initials(p: Pick<Profile, 'full_name' | 'display_name'>): string {
  const name = p.display_name || p.full_name || '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default async function TeamPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  // RLS returns only teammates in scope (same location, or all for admin).
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, display_name, avatar_url, role, title, employment_status')
    .order('full_name', { ascending: true });

  const team = (data as Profile[]) ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-900">Team</h1>
        <p className="text-sm text-brand-600">{team.length} people</p>
      </div>

      <ul className="space-y-2">
        {team.map((p) => (
          <li key={p.id} className="card flex items-center gap-3 py-3">
            {p.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.avatar_url}
                alt=""
                className="h-11 w-11 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-200 font-semibold text-brand-800">
                {initials(p)}
              </span>
            )}
            <div className="flex-1">
              <p className="font-semibold text-brand-900">
                {p.display_name || p.full_name}
                {p.id === profile.id && <span className="text-brand-400"> (you)</span>}
              </p>
              <p className="text-sm text-brand-500">{p.title || roleLabel(p.role)}</p>
            </div>
            {p.employment_status === 'onboarding' && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                Onboarding
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
