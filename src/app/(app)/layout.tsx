import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getAppSettings } from '@/lib/settings';
import { brandScaleCss } from '@/lib/theme';
import { AppShell } from '@/components/app-shell';
import { SplashScreen } from '@/components/splash-screen';

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

  const themeCss = brandScaleCss(settings.primary_color);

  return (
    <>
      {themeCss && <style>{themeCss}</style>}
      <SplashScreen url={settings.splash_url} />
      <AppShell profile={profile} unread={count ?? 0} logoUrl={settings.logo_url}>
        {children}
      </AppShell>
    </>
  );
}
