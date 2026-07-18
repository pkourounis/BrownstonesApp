'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { notify } from '@/lib/notify';

/** Open (or create) a 1:1 DM with a teammate in the same store. */
export async function openDm(otherId: string): Promise<{ ok: boolean; channelId?: string; error?: string }> {
  await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('open_dm', { p_other: otherId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, channelId: data as string };
}

/**
 * Push a just-sent message to the channel's other members. Called after the
 * client inserts the message (which drives realtime); this only fans out push.
 */
export async function notifyMessage(channelId: string, body: string): Promise<{ ok: boolean }> {
  const me = await requireProfile();
  const supabase = await createClient();
  const { data: members } = await supabase.from('chat_channel_members').select('profile_id').eq('channel_id', channelId);
  const others = (members ?? []).map((m) => m.profile_id).filter((id) => id !== me.id);
  if (!others.length) return { ok: true };
  const name = me.display_name || me.full_name || 'New message';
  await notify(others, {
    type: 'general',
    title: name,
    body: body.length > 120 ? body.slice(0, 117) + '…' : body,
    link: `/chat?c=${channelId}`,
  });
  return { ok: true };
}
