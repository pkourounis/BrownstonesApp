'use server';

import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { notify } from '@/lib/notify';
import { revalidatePath } from 'next/cache';

/** Schedule a review for a team member (defaults to 6 months out if no date). */
export async function requestReview(profileId: string, dueDate: string): Promise<{ ok: boolean; error?: string }> {
  const me = await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  if (!profileId) return { ok: false, error: 'Pick a team member.' };
  const due = dueDate || (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().slice(0, 10);
  })();
  const { error } = await supabase.from('employee_reviews').insert({
    profile_id: profileId,
    reviewer_id: me.id,
    due_date: due,
    status: 'scheduled',
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/reviews');
  return { ok: true };
}

/** Complete a review: record notes + a star rating, and update the person's rating. */
export async function completeReview(id: string, rating: number, notes: string): Promise<{ ok: boolean; error?: string }> {
  const me = await requireRole('super_admin', 'manager');
  const supabase = await createClient();

  const { data: review } = await supabase.from('employee_reviews').select('profile_id').eq('id', id).single();
  if (!review) return { ok: false, error: 'Review not found.' };

  const { data, error } = await supabase
    .from('employee_reviews')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      notes: notes.trim() || null,
      reviewer_id: me.id,
      skills_snapshot: rating > 0 ? { overall: rating } : null,
    })
    .eq('id', id)
    .select('id');
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: 'Not authorized for this review.' };

  if (rating > 0) {
    await supabase.from('staff_ratings').upsert({ profile_id: review.profile_id, rating, updated_at: new Date().toISOString() });
  }
  await notify([review.profile_id], { type: 'general', title: 'Your review is complete', body: 'Your manager completed your review.', link: '/profile', push: false });
  revalidatePath('/reviews');
  return { ok: true };
}

/** Remove a scheduled review. */
export async function cancelReview(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const { error } = await supabase.from('employee_reviews').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/reviews');
  return { ok: true };
}
