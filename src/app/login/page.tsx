import { createClient } from '@/lib/supabase/server';
import { brandScaleCss } from '@/lib/theme';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('app_branding').select('logo_url, splash_url, primary_color').maybeSingle();
  const branding = (data ?? null) as { logo_url: string | null; splash_url: string | null; primary_color: string | null } | null;
  const themeCss = brandScaleCss(branding?.primary_color);
  const splash = branding?.splash_url;

  return (
    <>
      {themeCss && <style>{themeCss}</style>}
      <main className="relative flex min-h-screen items-center justify-center bg-cream px-4">
        {splash && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={splash} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-cream/80 backdrop-blur-sm" />
          </>
        )}
        <div className="relative z-10">
          <LoginForm logoUrl={branding?.logo_url ?? null} />
        </div>
      </main>
    </>
  );
}
