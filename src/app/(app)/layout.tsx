import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/app-shell';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profile.id)
    .eq('is_read', false);

  return <AppShell profile={profile} unread={count ?? 0}>{children}</AppShell>;
}
