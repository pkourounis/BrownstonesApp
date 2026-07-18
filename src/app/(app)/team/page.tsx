import Link from 'next/link';
import { Star, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireProfile, roleLabel, canManage } from '@/lib/auth';
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

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const profile = await requireProfile();
  const manager = canManage(profile.role);
  const supabase = await createClient();

  const [{ data }, { data: ratings }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, display_name, avatar_url, role, title, employment_status')
      .order('full_name', { ascending: true }),
    manager ? supabase.from('staff_ratings').select('profile_id, rating') : Promise.resolve({ data: [] }),
  ]);

  const team = (data as Profile[]) ?? [];
  const ratingBy = new Map((ratings ?? []).map((r) => [r.profile_id, r.rating]));

  const Row = ({ p }: { p: Profile }) => {
    const archived = p.employment_status === 'inactive';
    const rating = ratingBy.get(p.id) ?? 0;
    return (
      <div className={`flex items-center gap-3 ${archived ? 'opacity-50' : ''}`}>
        {p.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover" />
        ) : (
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-200 font-semibold text-brand-800">
            {initials(p)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-brand-900">
            {p.display_name || p.full_name}
            {p.id === profile.id && <span className="text-brand-400"> (you)</span>}
          </p>
          <p className="text-sm text-brand-500">{p.title || roleLabel(p.role)}</p>
        </div>
        {manager && rating > 0 && (
          <span className="flex items-center gap-0.5 text-sm font-semibold tabular-nums text-brand-700">
            <Star size={14} className="fill-gold-400 text-gold-500" /> {rating}
          </span>
        )}
        {archived ? (
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-500">Archived</span>
        ) : p.employment_status === 'onboarding' ? (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Onboarding</span>
        ) : null}
        {manager && <ChevronRight size={18} className="text-brand-300" />}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-900">Team</h1>
        <p className="text-sm text-brand-600">{team.length} people</p>
      </div>

      <ul className="space-y-2">
        {team.map((p) => (
          <li key={p.id} className="card py-3">
            {manager ? (
              <Link href={`/team/${p.id}`} className="block">
                <Row p={p} />
              </Link>
            ) : (
              <Row p={p} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
