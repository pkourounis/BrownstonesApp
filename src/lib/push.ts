import webpush from 'web-push';
import { createClient } from '@/lib/supabase/server';

const PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:pkourounis@gmail.com';

let configured = false;
if (PUBLIC && PRIVATE) {
  try {
    webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
    configured = true;
  } catch {
    configured = false;
  }
}

export type PushPayload = { title: string; body?: string; url?: string; tag?: string };

/**
 * Best-effort web-push to every device of the given profiles. Silently no-ops
 * if VAPID isn't configured; prunes dead subscriptions (404/410). Never throws.
 */
export async function sendPush(profileIds: string[], payload: PushPayload): Promise<void> {
  const ids = [...new Set(profileIds.filter(Boolean))];
  if (!configured || ids.length === 0) return;

  // Fetch recipients' subscriptions via a SECURITY DEFINER RPC — works with the
  // caller's session, so no Supabase service key is required.
  const supabase = await createClient();
  const { data: subs } = await supabase.rpc('push_subscriptions_for', { p_targets: ids });
  if (!subs?.length) return;

  const body = JSON.stringify(payload);
  const dead: string[] = [];
  await Promise.all(
    (subs as { id: string; endpoint: string; p256dh: string; auth: string }[]).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body);
      } catch (e: unknown) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) dead.push(s.id);
      }
    })
  );
  if (dead.length) await supabase.rpc('prune_push_subscriptions', { p_ids: dead });
}
