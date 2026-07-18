import { createClient } from '@/lib/supabase/server';
import { brandScaleCss } from '@/lib/theme';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('app_branding').select('logo_url, primary_color').maybeSingle();
  const branding = (data ?? null) as { logo_url: string | null; primary_color: string | null } | null;
  const themeCss = brandScaleCss(branding?.primary_color);

  return (
    <>
      {themeCss && <style>{themeCss}</style>}
      <main className="flex min-h-screen items-center justify-center bg-cream px-4">
        <LoginForm logoUrl={branding?.logo_url ?? null} />
      </main>
    </>
  );
}
