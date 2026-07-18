'use server';

import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { notify } from '@/lib/notify';
import { revalidatePath } from 'next/cache';
import type { MeetingType } from '@/lib/database.types';

/** Combine an ET wall date + time into a UTC ISO timestamp (DST-safe). */
function etWallToUtc(dateStr: string, time: string): string | null {
  if (!dateStr) return null;
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = (time || '09:00').split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(guess));
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const nyAsUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'));
  return new Date(guess + (guess - nyAsUtc)).toISOString();
}

const TYPES: MeetingType[] = ['review', 'disciplinary', 'training', 'discussion', 'other'];

export async function requestMeeting(input: {
  employee_id: string;
  type: string;
  date: string;
  time: string;
  location: string;
  description: string;
}): Promise<{ ok: boolean; error?: string }> {
  const me = await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  if (!input.employee_id) return { ok: false, error: 'Pick a team member.' };
  if (!input.date) return { ok: false, error: 'Pick a date.' };
  const type = (TYPES as string[]).includes(input.type) ? (input.type as MeetingType) : 'review';

  const { error } = await supabase.from('meetings').insert({
    employee_id: input.employee_id,
    requested_by: me.id,
    type,
    scheduled_at: etWallToUtc(input.date, input.time),
    location: input.location.trim() || null,
    description: input.description.trim() || null,
    status: 'scheduled',
  });
  if (error) return { ok: false, error: error.message };

  // Notify the employee if they have an app account.
  const { data: emp } = await supabase.from('employees').select('profile_id').eq('id', input.employee_id).maybeSingle();
  if (emp?.profile_id) {
    await notify([emp.profile_id], { type: 'general', title: 'Meeting scheduled', body: 'A meeting has been scheduled with you — check with your manager.', link: '/dashboard', push: false });
  }
  revalidatePath('/meetings');
  return { ok: true };
}

export async function completeMeeting(id: string, rating: number, notes: string): Promise<{ ok: boolean; error?: string }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();

  const { data: mtg } = await supabase.from('meetings').select('employee_id, type').eq('id', id).single();
  if (!mtg) return { ok: false, error: 'Meeting not found.' };

  const { data, error } = await supabase
    .from('meetings')
    .update({ status: 'completed', completed_at: new Date().toISOString(), rating: rating > 0 ? rating : null, notes: notes.trim() || null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: 'Not authorized for this meeting.' };

  // A completed review with a rating updates the employee's star rating.
  if (mtg.type === 'review' && rating > 0) {
    await supabase.from('employees').update({ rating }).eq('id', mtg.employee_id);
  }
  revalidatePath('/meetings');
  return { ok: true };
}

export async function cancelMeeting(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const { error } = await supabase.from('meetings').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/meetings');
  return { ok: true };
}
