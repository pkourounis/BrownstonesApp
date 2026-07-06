import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile, AppRole } from '@/lib/database.types';

// Re-export the pure, client-safe helpers so existing server imports keep working.
export { roleLabel, canManage } from '@/lib/roles';

/**
 * Loads the signed-in user's profile on the server. Redirects to /login if
 * there is no session. Use this at the top of protected pages/layouts.
 */
export async function requireProfile(): Promise<Profile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/login');
  return profile as Profile;
}

/** Requires that the current user hold one of the given roles. */
export async function requireRole(...roles: AppRole[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) redirect('/dashboard');
  return profile;
}
