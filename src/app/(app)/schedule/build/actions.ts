'use server';

import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

/** Create one draft shift from the week builder. */
export async function createShift(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();

  const p_location = String(formData.get('location_id') ?? '');
  const p_date = String(formData.get('date') ?? '');
  const p_start = String(formData.get('start') ?? '');
  const p_end = String(formData.get('end') ?? '');
  const p_employee = String(formData.get('employee_id') ?? '') || null;
  const p_break = Number(formData.get('break') ?? 0) || 0;

  if (!p_location || !p_date || !p_start || !p_end) return { ok: false, error: 'Missing fields.' };

  const { error } = await supabase.rpc('create_shift', { p_location, p_date, p_start, p_end, p_break, p_employee });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/schedule/build');
  return { ok: true };
}

/** Delete a draft/published shift. */
export async function deleteShift(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const { error } = await supabase.from('shifts').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/schedule/build');
  return { ok: true };
}

/** Publish all draft shifts in a store's week (ET), making them visible to staff. */
export async function publishWeek(
  location_id: string,
  monday: string
): Promise<{ ok: boolean; error?: string; count?: number }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('publish_week', { p_location: location_id, p_monday: monday });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/schedule/build');
  return { ok: true, count: (data as number) ?? 0 };
}
