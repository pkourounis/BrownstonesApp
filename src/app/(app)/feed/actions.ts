'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile, requireRole } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

/** Post a new announcement to the feed (managers/admins). */
export async function createPost(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const body = String(formData.get('body') ?? '').trim();
  const scope = String(formData.get('location_id') ?? '').trim();
  if (!body) return { ok: false, error: 'Write something first.' };
  const location_id = scope && scope !== 'all' ? scope : null;

  const { error } = await supabase.from('posts').insert({ author_id: profile.id, location_id, body });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/feed');
  return { ok: true };
}

export async function deletePost(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const { error } = await supabase.from('posts').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/feed');
  return { ok: true };
}

/** Toggle the current user's 👍 on a post. */
export async function toggleReaction(postId: string): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('post_reactions')
    .select('post_id')
    .eq('post_id', postId)
    .eq('profile_id', profile.id)
    .eq('emoji', '👍')
    .maybeSingle();

  if (existing) {
    await supabase.from('post_reactions').delete().eq('post_id', postId).eq('profile_id', profile.id).eq('emoji', '👍');
  } else {
    await supabase.from('post_reactions').insert({ post_id: postId, profile_id: profile.id, emoji: '👍' });
  }
  revalidatePath('/feed');
  return { ok: true };
}
