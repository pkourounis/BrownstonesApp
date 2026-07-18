'use server';

import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { Employee, Department } from '@/lib/database.types';

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

/** Fully edit a roster member. */
export async function updateEmployee(
  id: string,
  patch: {
    first_name?: string;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    role_title?: string | null;
    department?: Department | null;
    location_id?: string;
    default_wage?: number | null;
    active?: boolean;
  }
): Promise<{ ok: boolean; error?: string }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const update: Partial<Employee> = {
    first_name: patch.first_name?.trim() || 'Employee',
    last_name: patch.last_name?.trim() || null,
    email: patch.email?.trim() || null,
    phone: patch.phone?.trim() || null,
    role_title: patch.role_title || null,
    department: patch.department ?? null,
    default_wage: patch.default_wage ?? null,
  };
  if (patch.location_id) update.location_id = patch.location_id;
  if (typeof patch.active === 'boolean') update.active = patch.active;

  const { data, error } = await supabase.from('employees').update(update).eq('id', id).select('id');
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: 'Not authorized for this member.' };
  revalidatePath('/roster');
  revalidatePath(`/roster/${id}`);
  return { ok: true };
}

/** Set (or clear, with 0) a roster member's star ranking. */
export async function setEmployeeRating(id: string, rating: number): Promise<{ ok: boolean; error?: string }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('employees')
    .update({ rating: rating > 0 ? rating : null })
    .eq('id', id)
    .select('id');
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: 'Not authorized for this member.' };
  revalidatePath('/roster');
  revalidatePath(`/roster/${id}`);
  return { ok: true };
}

/** Permanently delete a roster member. */
export async function deleteEmployee(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const { error } = await supabase.from('employees').delete().eq('id', id);
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
