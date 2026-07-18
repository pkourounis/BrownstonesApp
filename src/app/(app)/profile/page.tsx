import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { Availability } from '@/lib/database.types';
import { ProfileForm } from './profile-form';
import { AvailabilityEditor } from './availability-editor';
import { PasswordChange } from './password-form';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: locations }, { data: availability }] = await Promise.all([
    supabase.from('locations').select('id, name').order('name'),
    supabase.from('availability').select('*').eq('profile_id', profile.id).order('day_of_week'),
  ]);

  const primaryLocation =
    locations?.find((l) => l.id === profile.primary_location_id)?.name ?? null;

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold text-brand-900">Your profile</h1>
      <ProfileForm profile={profile} primaryLocation={primaryLocation} />
      <AvailabilityEditor profileId={profile.id} initial={(availability ?? []) as Availability[]} />
      <PasswordChange />
    </div>
  );
}
