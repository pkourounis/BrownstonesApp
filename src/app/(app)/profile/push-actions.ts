'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';

/** Save (or refresh) this device's web-push subscription for the current user. */
export async function saveSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent?: string): Promise<{ ok: boolean; error?: string }> {
  const me = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { profile_id: me.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: userAgent ?? null },
      { onConflict: 'endpoint' }
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Remove this device's subscription (turning notifications off). */
export async function removeSubscription(endpoint: string): Promise<{ ok: boolean; error?: string }> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
