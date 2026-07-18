import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getAppSettings } from '@/lib/settings';
import { AppShell } from '@/components/app-shell';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [{ count }, settings] = await Promise.all([
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('profile_id', profile.id).eq('is_read', false),
    getAppSettings(),
  ]);

  return (
    <>
      {settings.primary_color && (
        <style>{`.btn-primary,.btn-primary:hover{background-color:${settings.primary_color} !important}.btn-primary:hover{filter:brightness(0.93)}`}</style>
      )}
      <AppShell profile={profile} unread={count ?? 0} logoUrl={settings.logo_url}>
        {children}
      </AppShell>
    </>
  );
}
