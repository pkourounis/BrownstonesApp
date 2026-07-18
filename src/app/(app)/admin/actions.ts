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
    labor_target_splh: num('labor_target_splh') ?? 75,
    weekly_hour_cap: num('weekly_hour_cap') ?? 40,
    shift_length: num('shift_length') ?? 6,
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
