import { agentClient } from './client';
import { resolveStore } from './queries';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Post an announcement to the team feed. Optionally scope to one store and require acknowledgment. */
export async function createAnnouncement(input: { title?: string; body: string; store?: string; requires_ack?: boolean }) {
  const { sb, userId } = await agentClient();
  const body = (input.body ?? '').trim();
  if (!body && !input.title?.trim()) throw new Error('An announcement needs a title or body.');
  let location_id: string | null = null;
  let storeName: string | null = null;
  if (input.store) { const s = await resolveStore(sb, input.store); location_id = s.id; storeName = s.name; }

  const { data: post, error } = await sb
    .from('posts')
    .insert({
      author_id: userId,
      location_id,
      title: input.title?.trim() || null,
      body,
      category: 'announcement',
      requires_ack: !!input.requires_ack,
      pinned: false,
      pinned_until: null,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  let notified = 0;
  if (input.requires_ack) {
    let aud = sb.from('profiles').select('id').neq('employment_status', 'inactive').neq('id', userId);
    if (location_id) aud = aud.eq('primary_location_id', location_id);
    const { data: people } = await aud;
    const ids = ((people ?? []) as any[]).map((p) => p.id);
    if (ids.length) {
      await sb.rpc('notify_users', { p_targets: ids, p_type: 'announcement', p_title: 'Please acknowledge', p_body: input.title?.trim() || body.slice(0, 117), p_link: '/feed' });
      notified = ids.length;
    }
  }
  return { ok: true, post_id: (post as any).id, store: storeName ?? 'all stores', requires_ack: !!input.requires_ack, notified };
}

/** Set (or clear) a store's daily sales goal that drives the home-screen celebration. */
export async function setDailySalesGoal(input: { store: string; amount: number | null }) {
  const { sb } = await agentClient();
  const store = await resolveStore(sb, input.store);
  const amount = input.amount == null ? null : Math.max(0, Math.round(Number(input.amount)));
  const { error } = await sb.from('locations').update({ daily_sales_goal: amount }).eq('id', store.id);
  if (error) throw new Error(error.message);
  return { ok: true, store: store.name, daily_sales_goal: amount };
}
