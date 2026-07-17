import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile, AppRole } from '@/lib/database.types';

// Re-export the pure, client-safe helpers so existing server imports keep working.
export { roleLabel, canManage } from '@/lib/roles';

/**
 * Resolves the current user's profile, or null if unauthenticated.
 *
 * Wrapped in React `cache()` so the `auth.getUser()` network round-trip and the
 * `profiles` query run at most ONCE per request — the layout and the page (and
 * any server action) that all need the profile share a single memoized result
 * instead of each hitting Supabase Auth again.
 */
const loadProfile = cache(async function loadProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return (profile as Profile) ?? null;
});

/**
 * Loads the signed-in user's profile on the server. Redirects to /login if
 * there is no session. Use this at the top of protected pages/layouts.
 */
export async function requireProfile(): Promise<Profile> {
  const profile = await loadProfile();
  if (!profile) redirect('/login');
  return profile;
}

/** Requires that the current user hold one of the given roles. */
export async function requireRole(...roles: AppRole[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) redirect('/dashboard');
  return profile;
}
