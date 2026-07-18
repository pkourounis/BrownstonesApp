'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile, requireRole, canManage } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

const CATEGORIES = ['post', 'announcement', 'product', 'seasonal', 'menu'] as const;
type Category = (typeof CATEGORIES)[number];

/** Convert a pin-duration choice into an expiry timestamp (null = not pinned). */
function pinExpiry(pin: string): string | null {
  const now = Date.now();
  const day = 86_400_000;
  const map: Record<string, number> = { '1d': day, '3d': 3 * day, '1w': 7 * day, '2w': 14 * day, forever: 3650 * day };
  if (!pin || !(pin in map)) return null;
  return new Date(now + map[pin]).toISOString();
}

/** Publish a feed post (managers + super-admins). */
export async function createPost(input: {
  title: string;
  body: string;
  category: string;
  location_id: string | null;
  requires_ack: boolean;
  pin: string;
  attachments: { url: string; mime: string }[];
}): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const body = input.body.trim();
  if (!body && !input.title.trim()) return { ok: false, error: 'Add a title or description.' };
  const category: Category = (CATEGORIES as readonly string[]).includes(input.category) ? (input.category as Category) : 'post';
  const pinned_until = pinExpiry(input.pin);

  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      author_id: profile.id,
      location_id: input.location_id,
      title: input.title.trim() || null,
      body,
      category,
      requires_ack: input.requires_ack,
      pinned: !!pinned_until,
      pinned_until,
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

/** Repost an existing post to the feed (managers + super-admins). */
export async function repost(originalId: string): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const { data: orig, error: readErr } = await supabase
    .from('posts')
    .select('category, location_id')
    .eq('id', originalId)
    .single();
  if (readErr || !orig) return { ok: false, error: 'Original post not found.' };

  const { error } = await supabase.from('posts').insert({
    author_id: profile.id,
    location_id: orig.location_id,
    body: '',
    category: orig.category,
    reposted_from: originalId,
  });
  if (error) return { ok: false, error: error.message };
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

/** Who has / hasn't acknowledged a post (managers + super-admins). */
export async function getAckStatus(
  postId: string
): Promise<{ ok: boolean; acked?: string[]; pending?: string[]; error?: string }> {
  const profile = await requireProfile();
  if (!canManage(profile.role)) return { ok: false, error: 'Not allowed.' };
  const supabase = await createClient();

  const { data: post } = await supabase.from('posts').select('location_id').eq('id', postId).single();
  if (!post) return { ok: false, error: 'Post not found.' };

  // Intended recipients: everyone active, scoped to the post's store when set.
  let recips = supabase.from('profiles').select('id, display_name, full_name').neq('employment_status', 'inactive');
  if (post.location_id) recips = recips.eq('primary_location_id', post.location_id);
  const [{ data: people }, { data: acks }] = await Promise.all([
    recips,
    supabase.from('post_acks').select('profile_id').eq('post_id', postId),
  ]);

  const ackedIds = new Set((acks ?? []).map((a) => a.profile_id));
  const name = (p: { display_name: string | null; full_name: string | null }) => p.display_name || p.full_name || 'Team';
  const acked: string[] = [];
  const pending: string[] = [];
  for (const p of people ?? []) (ackedIds.has(p.id) ? acked : pending).push(name(p));
  acked.sort((a, b) => a.localeCompare(b));
  pending.sort((a, b) => a.localeCompare(b));
  return { ok: true, acked, pending };
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
