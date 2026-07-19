import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { DirectoryProfile } from '@/lib/database.types';
import { DirectoryGrid } from './directory-grid';

export const dynamic = 'force-dynamic';

export default async function DirectoryPage() {
  const me = await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from('directory_profiles')
    .select('*')
    .order('first_name', { ascending: true });
  const people = (data ?? []) as DirectoryProfile[];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-900">Team</h1>
        <p className="text-sm text-brand-600">{people.length} {people.length === 1 ? 'teammate' : 'teammates'} · tap anyone to see their profile</p>
      </div>
      <DirectoryGrid people={people} meId={me.id} />
    </div>
  );
}
