import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Mail, Phone } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireProfile, roleLabel, canManage } from '@/lib/auth';
import type { Profile, Location } from '@/lib/database.types';
import { MemberAdmin } from './member-admin';

export const dynamic = 'force-dynamic';

function initials(p: Profile) {
  return `${p.first_name?.[0] ?? p.full_name?.[0] ?? ''}${p.last_name?.[0] ?? ''}`.toUpperCase() || 'BC';
}

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const caller = await requireProfile();
  if (!canManage(caller.role)) redirect('/team');
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: member }, { data: ratingRow }, { data: locations }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', id).single(),
    supabase.from('staff_ratings').select('rating').eq('profile_id', id).maybeSingle(),
    supabase.from('locations').select('id, name').order('name'),
  ]);

  if (!member) notFound();
  const m = member as Profile;
  const locs = (locations ?? []) as Pick<Location, 'id' | 'name'>[];
  const name = `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || m.display_name || m.full_name;

  return (
    <div className="space-y-5">
      <Link href="/team" className="flex items-center gap-1 text-sm font-medium text-brand-700">
        <ArrowLeft size={16} /> Back to team
      </Link>

      <div className="card flex items-center gap-4">
        {m.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.avatar_url} alt="" className="h-16 w-16 rounded-full border border-brand-100 object-cover" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-200 text-xl font-semibold text-brand-700">
            {initials(m)}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-brand-900">{name}</p>
          <p className="text-sm text-brand-500">{m.title || roleLabel(m.role)}</p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-brand-500">
            {m.email && (
              <span className="flex items-center gap-1"><Mail size={12} /> {m.email}</span>
            )}
            {m.phone && (
              <span className="flex items-center gap-1"><Phone size={12} /> {m.phone}</span>
            )}
          </div>
        </div>
      </div>

      <MemberAdmin member={m} rating={ratingRow?.rating ?? 0} locations={locs} callerRole={caller.role} />
    </div>
  );
}
