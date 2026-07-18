import { createClient as createSbClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

/**
 * Headless Supabase client for the agent API, signed in as a dedicated
 * super-admin service account. This reuses the app's own Row Level Security
 * (a super admin already sees every store) so the agent gets full read/write
 * without needing the Supabase service-role key.
 *
 * Credentials come from AGENT_USER_EMAIL / AGENT_USER_PASSWORD (Netlify env).
 */
let cached: { sb: SupabaseClient<Database>; userId: string; at: number } | null = null;
const TTL_MS = 30 * 60 * 1000; // re-auth every 30 min

export async function agentClient(): Promise<{ sb: SupabaseClient<Database>; userId: string }> {
  if (cached && Date.now() - cached.at < TTL_MS) return { sb: cached.sb, userId: cached.userId };

  const email = process.env.AGENT_USER_EMAIL;
  const password = process.env.AGENT_USER_PASSWORD;
  if (!email || !password) {
    throw new Error('Agent service account not configured — set AGENT_USER_EMAIL and AGENT_USER_PASSWORD in Netlify.');
  }

  const sb = createSbClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`Agent sign-in failed: ${error?.message ?? 'no session'}`);

  cached = { sb, userId: data.user.id, at: Date.now() };
  return { sb, userId: data.user.id };
}
