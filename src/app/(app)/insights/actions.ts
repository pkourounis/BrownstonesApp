'use server';

import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

/** Pull today's sales from Toast on demand (manager/admin only), then refresh. */
export async function syncToastNow(): Promise<{ ok: boolean; error?: string }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const { error } = await supabase.rpc('sync_toast_now');
  if (error) return { ok: false, error: error.message };
  revalidatePath('/insights');
  return { ok: true };
}
