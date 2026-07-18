'use server';

import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function parse(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const num = (k: string) => {
    const v = String(formData.get(k) ?? '').trim();
    return v === '' ? null : Number(v);
  };
  const str = (k: string) => {
    const v = String(formData.get(k) ?? '').trim();
    return v === '' ? null : v;
  };
  return {
    name,
    slug: str('slug') || slugify(name),
    location_number: str('location_number'),
    address: str('address'),
    city: str('city'),
    state: str('state'),
    postal_code: str('postal_code'),
    phone: str('phone'),
    timezone: str('timezone') || 'America/New_York',
    opens_at: str('opens_at') || '06:00',
    seats: num('seats'),
    tables: num('tables'),
    revenue_per_hour_target: num('revenue_per_hour_target') ?? 1300,
    daily_sales_goal: num('daily_sales_goal'),
    labor_target_splh: num('labor_target_splh') ?? 130,
    weekly_hour_cap: num('weekly_hour_cap') ?? 40,
    shift_length: num('shift_length') ?? 6,
    staffing_notes: str('staffing_notes'),
    toast_guid: str('toast_guid'),
    is_active: formData.get('is_active') === 'on',
  };
}

export async function createLocation(formData: FormData): Promise<{ ok: boolean; error?: string; id?: string }> {
  await requireRole('super_admin');
  const supabase = await createClient();
  const payload = parse(formData);
  if (!payload.name) return { ok: false, error: 'Name is required.' };
  const { data, error } = await supabase.from('locations').insert(payload).select('id').single();
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin');
  return { ok: true, id: data?.id };
}

export async function updateLocation(id: string, formData: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireRole('super_admin');
  const supabase = await createClient();
  const payload = parse(formData);
  if (!payload.name) return { ok: false, error: 'Name is required.' };
  const { error } = await supabase.from('locations').update(payload).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin');
  revalidatePath(`/admin/locations/${id}`);
  return { ok: true };
}

export type StaffingRuleInput = {
  role: string;
  mon: number; tue: number; wed: number; thu: number; fri: number; sat: number; sun: number;
};

export async function saveStaffingRules(
  locationId: string,
  rules: StaffingRuleInput[],
): Promise<{ ok: boolean; error?: string }> {
  await requireRole('super_admin', 'manager');
  const supabase = await createClient();

  const clean = rules
    .map((r) => ({ ...r, role: r.role.trim() }))
    .filter((r) => r.role.length > 0);

  // De-dupe by role (last wins) so the unique (location, role) constraint holds.
  const byRole = new Map<string, StaffingRuleInput>();
  clean.forEach((r) => byRole.set(r.role, r));
  const rows = [...byRole.values()].map((r, i) => ({
    location_id: locationId,
    role: r.role,
    mon: Math.max(0, Math.round(r.mon) || 0),
    tue: Math.max(0, Math.round(r.tue) || 0),
    wed: Math.max(0, Math.round(r.wed) || 0),
    thu: Math.max(0, Math.round(r.thu) || 0),
    fri: Math.max(0, Math.round(r.fri) || 0),
    sat: Math.max(0, Math.round(r.sat) || 0),
    sun: Math.max(0, Math.round(r.sun) || 0),
    sort_order: i,
  }));

  // Full replace for this location: clear existing rows, then insert the current set.
  const { error: delErr } = await supabase.from('staffing_rules').delete().eq('location_id', locationId);
  if (delErr) return { ok: false, error: delErr.message };

  if (rows.length) {
    const { error } = await supabase.from('staffing_rules').insert(rows);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/admin/locations/${locationId}`);
  revalidatePath('/schedule/build');
  return { ok: true };
}
