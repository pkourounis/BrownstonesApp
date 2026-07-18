'use server';

import { randomBytes } from 'crypto';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { AppRole, Department, EmploymentStatus, Profile } from '@/lib/database.types';

/** Create a brand-new app user with a chosen role (super-admin only). Returns a temp password. */
export async function createAppUser(input: {
  first_name: string;
  last_name: string;
  email: string;
  role: AppRole;
  primary_location_id: string | null;
}): Promise<{ ok: boolean; error?: string; tempPassword?: string }> {
  await requireRole('super_admin');
  const email = input.email.trim().toLowerCase();
  const first = input.first_name.trim();
  const last = input.last_name.trim();
  if (!first) return { ok: false, error: 'First name is required.' };
  if (!email || !email.includes('@')) return { ok: false, error: 'A valid email is required.' };

  let svc: ReturnType<typeof createServiceClient>;
  try {
    svc = createServiceClient();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Service key not configured.' };
  }
  const temp = `Coffee-${randomBytes(4).toString('hex')}`;
  const fullName = `${first} ${last}`.trim();
  const { data, error } = await svc.auth.admin.createUser({
    email,
    password: temp,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data?.user) return { ok: false, error: error?.message ?? 'Could not create the account.' };

  const { error: pErr } = await svc
    .from('profiles')
    .update({
      first_name: first,
      last_name: last || null,
      full_name: fullName,
      role: input.role,
      primary_location_id: input.primary_location_id,
      employment_status: 'active',
      must_change_password: true,
    })
    .eq('id', data.user.id);
  if (pErr) return { ok: false, error: pErr.message };

  revalidatePath('/team');
  return { ok: true, tempPassword: temp };
}

/** Set (or clear) a team member's star ranking. rating 0 clears it. */
export async function setRating(profileId: string, rating: number): Promise<{ ok: boolean; error?: string }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  if (rating <= 0) {
    const { error } = await supabase.from('staff_ratings').delete().eq('profile_id', profileId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from('staff_ratings')
      .upsert({ profile_id: profileId, rating, updated_at: new Date().toISOString() });
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath(`/team/${profileId}`);
  revalidatePath('/team');
  return { ok: true };
}

/** Archive (deactivate) or restore a team member. */
export async function setArchived(profileId: string, archived: boolean): Promise<{ ok: boolean; error?: string }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .update({ employment_status: (archived ? 'inactive' : 'active') as EmploymentStatus })
    .eq('id', profileId)
    .select('id');
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: 'Not authorized for this member.' };
  revalidatePath(`/team/${profileId}`);
  revalidatePath('/team');
  return { ok: true };
}

/** Edit a member's work details. Role changes are super-admin only. */
export async function updateMember(
  profileId: string,
  patch: {
    title?: string | null;
    department?: Department | null;
    primary_location_id?: string | null;
    employment_status?: EmploymentStatus;
    role?: AppRole;
  }
): Promise<{ ok: boolean; error?: string }> {
  const caller = await requireRole('super_admin', 'manager');
  const supabase = await createClient();

  const update: Partial<Profile> = {
    title: patch.title ?? null,
    department: patch.department ?? null,
    primary_location_id: patch.primary_location_id ?? null,
  };
  if (patch.employment_status) update.employment_status = patch.employment_status;
  if (patch.role && caller.role === 'super_admin') update.role = patch.role;

  const { data, error } = await supabase.from('profiles').update(update).eq('id', profileId).select('id');
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: 'Not authorized for this member.' };
  revalidatePath(`/team/${profileId}`);
  revalidatePath('/team');
  return { ok: true };
}

/**
 * Reset a member's app access by setting a temporary password. Authorization is
 * enforced by RLS: we first flag the row via the caller's own client (which only
 * succeeds in scope), then set the password with the service role. The temp
 * password is returned once to hand to the employee; they must change it.
 */
export async function resetPassword(profileId: string): Promise<{ ok: boolean; error?: string; tempPassword?: string }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('profiles')
    .update({ must_change_password: true })
    .eq('id', profileId)
    .select('id');
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: 'Not authorized for this member.' };

  const temp = `Coffee-${randomBytes(4).toString('hex')}`;
  let svc: ReturnType<typeof createServiceClient>;
  try {
    svc = createServiceClient();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Service key not configured.' };
  }
  const { error: pwErr } = await svc.auth.admin.updateUserById(profileId, { password: temp });
  if (pwErr) return { ok: false, error: pwErr.message };

  revalidatePath(`/team/${profileId}`);
  return { ok: true, tempPassword: temp };
}
