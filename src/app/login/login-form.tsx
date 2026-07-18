'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

export function LoginForm({ logoUrl }: { logoUrl: string | null }) {
  return (
    <Suspense fallback={null}>
      <Inner logoUrl={logoUrl} />
    </Suspense>
  );
}

function Inner({ logoUrl }: { logoUrl: string | null }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.replace(next);
    router.refresh();
  }

  async function sendMagicLink() {
    setError(null);
    if (!email) { setError('Enter your email first.'); return; }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${next}` },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setMagicSent(true);
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center gap-4 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl || '/brownstones-logo.png'} alt="Brownstones Coffee" className="h-auto w-52 drop-shadow-sm" />
        <p className="text-xs uppercase tracking-[0.25em] text-brand-400">Team Portal</p>
      </div>

      <div className="card">
        {magicSent ? (
          <div className="text-center">
            <p className="font-semibold text-brand-900">Check your email</p>
            <p className="mt-2 text-sm text-brand-600">
              We sent a sign-in link to <span className="font-medium">{email}</span>.
            </p>
          </div>
        ) : (
          <form onSubmit={signInWithPassword} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" autoComplete="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@brownstones.com" />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" size={18} /> : 'Sign in'}
            </button>
            <button type="button" onClick={sendMagicLink} className="w-full text-center text-sm font-medium text-brand-700 hover:underline" disabled={loading}>
              Email me a sign-in link instead
            </button>
          </form>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-brand-500">Trouble signing in? Contact your manager.</p>
    </div>
  );
}
