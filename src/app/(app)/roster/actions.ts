'use server';

import { randomBytes } from 'crypto';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { Employee, Department } from '@/lib/database.types';

/**
 * Provision (or link) an app login for a roster employee. Returns the temp
 * password when a new account is created. Idempotent: no-ops if already linked,
 * links to an existing profile with the same email, and falls back to a
 * synthetic email when the real one is already taken.
 */
async function provision(
  svc: ReturnType<typeof createServiceClient>,
  supabase: Awaited<ReturnType<typeof createClient>>,
  emp: Employee
): Promise<{ ok: boolean; error?: string; tempPassword?: string; email?: string; linked?: boolean }> {
  if (emp.profile_id) return { ok: true, linked: true };

  const fullName = `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim() || 'Employee';

  // Link to an existing app user with the same email, if any.
  if (emp.email) {
    const { data: existing } = await supabase.from('profiles').select('id').ilike('email', emp.email).maybeSingle();
    if (existing) {
      await svc.from('employees').update({ profile_id: existing.id }).eq('id', emp.id);
      return { ok: true, linked: true, email: emp.email };
    }
  }

  const temp = `Coffee-${randomBytes(4).toString('hex')}`;
  const primary = emp.email && emp.email.includes('@') ? emp.email : `staff-${emp.id.slice(0, 8)}@brownstones.app`;

  let userId: string | null = null;
  for (const email of [primary, `staff-${emp.id.slice(0, 8)}@brownstones.app`]) {
    const { data, error } = await svc.auth.admin.createUser({
      email,
      password: temp,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (!error && data?.user) {
      userId = data.user.id;
      break;
    }
    if (error && !/registered|exists|duplicate/i.test(error.message)) return { ok: false, error: error.message };
  }
  if (!userId) return { ok: false, error: 'Could not create the account.' };

  await svc
    .from('profiles')
    .update({
      first_name: emp.first_name,
      last_name: emp.last_name,
      full_name: fullName,
      role: 'employee',
      primary_location_id: emp.location_id,
      department: emp.department,
      title: emp.role_title,
      phone: emp.phone,
      avatar_url: emp.avatar_url,
      bio: emp.bio,
      address: emp.address,
      birthday: emp.birthday,
      hired_at: emp.hired_at,
      marital_status: emp.marital_status,
      facebook: emp.facebook,
      instagram: emp.instagram,
      emergency_contact_name: emp.emergency_contact_name,
      emergency_contact_phone: emp.emergency_contact_phone,
      must_change_password: true,
    })
    .eq('id', userId);
  await svc.from('employees').update({ profile_id: userId }).eq('id', emp.id);
  return { ok: true, tempPassword: temp, email: primary };
}

/** Grant app access to one roster member. */
export async function grantAccess(employeeId: string): Promise<{ ok: boolean; error?: string; tempPassword?: string; email?: string; linked?: boolean }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const { data: emp, error } = await supabase.from('employees').select('*').eq('id', employeeId).single();
  if (error || !emp) return { ok: false, error: 'Not authorized for this member.' };
  let svc: ReturnType<typeof createServiceClient>;
  try {
    svc = createServiceClient();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Service key not configured.' };
  }
  const res = await provision(svc, supabase, emp as Employee);
  revalidatePath(`/roster/${employeeId}`);
  revalidatePath('/roster');
  return res;
}

/** Provision the next batch of roster members without app access. */
export async function grantAccessBatch(limit = 12): Promise<{ ok: boolean; done: number; remaining: number; error?: string }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  let svc: ReturnType<typeof createServiceClient>;
  try {
    svc = createServiceClient();
  } catch (e) {
    return { ok: false, done: 0, remaining: 0, error: e instanceof Error ? e.message : 'Service key not configured.' };
  }
  const { data: batch, error } = await supabase.from('employees').select('*').eq('active', true).is('profile_id', null).limit(limit);
  if (error) return { ok: false, done: 0, remaining: 0, error: error.message };
  let done = 0;
  for (const emp of (batch ?? []) as Employee[]) {
    const r = await provision(svc, supabase, emp);
    if (r.ok) done++;
  }
  const { count } = await supabase.from('employees').select('*', { count: 'exact', head: true }).eq('active', true).is('profile_id', null);
  revalidatePath('/roster');
  return { ok: true, done, remaining: count ?? 0 };
}

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
    role_titles?: string[];
    department?: Department | null;
    location_id?: string;
    default_wage?: number | null;
    active?: boolean;
    avatar_url?: string | null;
    bio?: string | null;
    address?: string | null;
    birthday?: string | null;
    hired_at?: string | null;
    marital_status?: string | null;
    facebook?: string | null;
    instagram?: string | null;
    emergency_contact_name?: string | null;
    emergency_contact_phone?: string | null;
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
  if (patch.role_titles) update.role_titles = patch.role_titles;
  const profileKeys = ['avatar_url', 'bio', 'address', 'birthday', 'hired_at', 'marital_status', 'facebook', 'instagram', 'emergency_contact_name', 'emergency_contact_phone'] as const;
  for (const k of profileKeys) {
    if (k in patch) (update as Record<string, unknown>)[k] = (patch[k] as string | null)?.toString().trim() || null;
  }
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
