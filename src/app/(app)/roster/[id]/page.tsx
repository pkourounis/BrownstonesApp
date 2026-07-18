import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import type { Employee, Location } from '@/lib/database.types';
import { RosterMemberEdit } from './roster-member-edit';

export const dynamic = 'force-dynamic';

export default async function RosterMemberPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('super_admin', 'manager');
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: emp }, { data: locs }] = await Promise.all([
    supabase.from('employees').select('*').eq('id', id).single(),
    supabase.from('locations').select('id, name').order('name'),
  ]);

  if (!emp) notFound();
  const member = emp as Employee;
  const locations = (locs ?? []) as Pick<Location, 'id' | 'name'>[];

  // Link to an app-user profile if this person has one (matched by email).
  let linkedProfileId: string | null = null;
  if (member.email) {
    const { data: prof } = await supabase.from('profiles').select('id').eq('email', member.email).maybeSingle();
    linkedProfileId = prof?.id ?? null;
  }

  const name = `${member.first_name} ${member.last_name ?? ''}`.trim();

  return (
    <div className="space-y-5">
      <Link href="/roster" className="flex items-center gap-1 text-sm font-medium text-brand-700">
        <ArrowLeft size={16} /> Back to roster
      </Link>
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-900">{name}</h1>
        <p className="text-sm text-brand-600">
          {member.role_title ?? 'Staff'} · {member.source === 'toast' ? 'from Toast' : 'added in-app'}
        </p>
      </div>
      <RosterMemberEdit member={member} locations={locations} linkedProfileId={linkedProfileId} />
    </div>
  );
}
