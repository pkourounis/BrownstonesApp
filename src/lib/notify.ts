import { createClient } from '@/lib/supabase/server';
import { sendPush } from '@/lib/push';
import type { NotificationType } from '@/lib/database.types';

/**
 * Notify users both in-app (notifications table, via SECURITY DEFINER RPC) and
 * with a web push (best-effort). Never notifies the actor. Never throws.
 */
export async function notify(
  targets: (string | null | undefined)[],
  opts: { type: NotificationType; title: string; body?: string; link?: string; push?: boolean }
): Promise<void> {
  const ids = [...new Set(targets.filter(Boolean))] as string[];
  if (!ids.length) return;
  try {
    const supabase = await createClient();
    await supabase.rpc('notify_users', {
      p_targets: ids,
      p_type: opts.type,
      p_title: opts.title,
      p_body: opts.body ?? null,
      p_link: opts.link ?? null,
    });
  } catch {
    /* in-app insert failed — non-fatal */
  }
  if (opts.push !== false) {
    await sendPush(ids, { title: opts.title, body: opts.body, url: opts.link });
  }
}
