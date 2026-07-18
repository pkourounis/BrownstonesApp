'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function markAllRead(): Promise<{ ok: boolean }> {
  const me = await requireProfile();
  const supabase = await createClient();
  await supabase.from('notifications').update({ is_read: true }).eq('profile_id', me.id).eq('is_read', false);
  revalidatePath('/notifications');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function markRead(id: string): Promise<{ ok: boolean }> {
  await requireProfile();
  const supabase = await createClient();
  await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  revalidatePath('/notifications');
  return { ok: true };
}
