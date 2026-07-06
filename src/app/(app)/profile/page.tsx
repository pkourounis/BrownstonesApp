import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ProfileForm } from './profile-form';

export default async function ProfilePage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: locations } = await supabase
    .from('locations')
    .select('id, name')
    .order('name');

  const primaryLocation =
    locations?.find((l) => l.id === profile.primary_location_id)?.name ?? null;

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold text-brand-900">Your profile</h1>
      <ProfileForm profile={profile} primaryLocation={primaryLocation} />
    </div>
  );
}
