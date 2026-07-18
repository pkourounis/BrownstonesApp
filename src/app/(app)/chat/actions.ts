'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';

/** Open (or create) a 1:1 DM with a teammate in the same store. */
export async function openDm(otherId: string): Promise<{ ok: boolean; channelId?: string; error?: string }> {
  await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('open_dm', { p_other: otherId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, channelId: data as string };
}
