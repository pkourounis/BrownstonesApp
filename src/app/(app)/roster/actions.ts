'use server';

import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

/** Add a new employee to the roster by hand (source = manual). */
export async function addEmployee(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireRole('super_admin', 'manager');
  const supabase = await createClient();

  const first_name = String(formData.get('first_name') ?? '').trim();
  const location_id = String(formData.get('location_id') ?? '').trim();
  if (!first_name) return { ok: false, error: 'First name is required.' };
  if (!location_id) return { ok: false, error: 'Pick a store.' };

  const last_name = String(formData.get('last_name') ?? '').trim() || null;
  const role_title = String(formData.get('role_title') ?? '').trim() || null;
  const email = String(formData.get('email') ?? '').trim() || null;
  const phone = String(formData.get('phone') ?? '').trim() || null;
  const wageRaw = String(formData.get('default_wage') ?? '').trim();
  const default_wage = wageRaw ? Number(wageRaw) : null;
  if (default_wage != null && (Number.isNaN(default_wage) || default_wage < 0)) {
    return { ok: false, error: 'Wage must be a positive number.' };
  }

  const { error } = await supabase.from('employees').insert({
    location_id,
    first_name,
    last_name,
    role_title,
    email,
    phone,
    default_wage,
    source: 'manual',
    active: true,
    created_by: profile.id,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath('/roster');
  return { ok: true };
}

/** Toggle an employee active/inactive. */
export async function setEmployeeActive(id: string, active: boolean): Promise<{ ok: boolean; error?: string }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const { error } = await supabase.from('employees').update({ active, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/roster');
  return { ok: true };
}

/** Refresh the Toast side of the roster from already-synced punch history. */
export async function importFromToast(): Promise<{ ok: boolean; error?: string; count?: number }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('roster_import_from_toast');
  if (error) return { ok: false, error: error.message };
  revalidatePath('/roster');
  return { ok: true, count: (data as number) ?? 0 };
}
