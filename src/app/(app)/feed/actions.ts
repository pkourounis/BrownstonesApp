'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile, requireRole } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

const CATEGORIES = ['announcement', 'product', 'seasonal', 'menu'] as const;
type Category = (typeof CATEGORIES)[number];

/** Publish a feed announcement (super-admin only). */
export async function createPost(input: {
  title: string;
  body: string;
  category: string;
  location_id: string | null;
  requires_ack: boolean;
  attachments: { url: string; mime: string }[];
}): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireRole('super_admin');
  const supabase = await createClient();
  const body = input.body.trim();
  if (!body && !input.title.trim()) return { ok: false, error: 'Add a title or description.' };
  const category: Category = (CATEGORIES as readonly string[]).includes(input.category) ? (input.category as Category) : 'announcement';

  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      author_id: profile.id,
      location_id: input.location_id,
      title: input.title.trim() || null,
      body,
      category,
      requires_ack: input.requires_ack,
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };

  if (input.attachments.length) {
    const rows = input.attachments.map((a) => ({ post_id: post.id, url: a.url, mime: a.mime }));
    await supabase.from('post_attachments').insert(rows);
  }
  revalidatePath('/feed');
  return { ok: true };
}

/** Acknowledge a post that requires it. */
export async function acknowledgePost(postId: string): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from('post_acks').insert({ post_id: postId, profile_id: profile.id });
  if (error && !error.message.includes('duplicate')) return { ok: false, error: error.message };
  revalidatePath('/feed');
  return { ok: true };
}

/** Add a comment to a post. */
export async function addComment(postId: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const text = body.trim();
  if (!text) return { ok: false, error: 'Empty comment.' };
  const { error } = await supabase.from('post_comments').insert({ post_id: postId, author_id: profile.id, body: text });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/feed');
  return { ok: true };
}

export async function deleteComment(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from('post_comments').delete().eq('id', id);
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
