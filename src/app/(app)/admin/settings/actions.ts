'use server';

import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function updateAppSettings(input: {
  logo_url?: string | null;
  splash_url?: string | null;
  primary_color?: string | null;
  labor_target_splh?: number;
  weekly_hour_cap?: number;
  shift_length?: number;
}): Promise<{ ok: boolean; error?: string }> {
  const me = await requireRole('super_admin');
  const supabase = await createClient();

  const patch: Record<string, unknown> = { id: true, updated_by: me.id, updated_at: new Date().toISOString() };
  if ('logo_url' in input) patch.logo_url = input.logo_url || null;
  if ('splash_url' in input) patch.splash_url = input.splash_url || null;
  if ('primary_color' in input) patch.primary_color = input.primary_color?.trim() || null;
  if (input.labor_target_splh != null) patch.labor_target_splh = Math.min(150, Math.max(20, input.labor_target_splh));
  if (input.weekly_hour_cap != null) patch.weekly_hour_cap = Math.min(60, Math.max(10, input.weekly_hour_cap));
  if (input.shift_length != null) patch.shift_length = Math.min(10, Math.max(4, input.shift_length));

  const { error } = await supabase.from('app_settings').upsert(patch, { onConflict: 'id' });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/settings');
  revalidatePath('/', 'layout');
  return { ok: true };
}
