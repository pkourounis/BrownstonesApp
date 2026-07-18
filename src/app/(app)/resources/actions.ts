'use server';

import { createClient } from '@/lib/supabase/server';
import { requireProfile, requireRole } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { Department, ResourceKind, ResourceType } from '@/lib/database.types';

const KIND_TO_TYPE: Record<ResourceKind, ResourceType> = { doc: 'document', video: 'training', link: 'link' };

/** Publish a resource with an audience (super-admin only). */
export async function createResource(input: {
  title: string;
  description: string;
  category: string;
  kind: ResourceKind;
  url: string;
  requires_signoff: boolean;
  audience: 'all' | 'managers' | 'store' | 'department';
  location_id: string | null;
  department: Department | null;
}): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireRole('super_admin');
  const supabase = await createClient();

  const title = input.title.trim();
  const url = input.url.trim();
  if (!title) return { ok: false, error: 'Add a title.' };
  if (!url) return { ok: false, error: 'Add a link or upload a file.' };

  const { data: res, error } = await supabase
    .from('resources')
    .insert({
      type: KIND_TO_TYPE[input.kind],
      kind: input.kind,
      category: input.category.trim() || 'General',
      title,
      description: input.description.trim() || null,
      url,
      requires_signoff: input.requires_signoff,
      is_active: true,
      published_by: profile.id,
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };

  const assignment: Record<string, unknown> = { resource_id: res.id, location_id: null, profile_id: null, department: null, managers_only: false };
  if (input.audience === 'managers') assignment.managers_only = true;
  else if (input.audience === 'store') assignment.location_id = input.location_id;
  else if (input.audience === 'department') assignment.department = input.department;
  const { error: aErr } = await supabase.from('resource_assignments').insert(assignment);
  if (aErr) return { ok: false, error: aErr.message };

  revalidatePath('/resources');
  return { ok: true };
}

/** Remove a resource (super-admin only). */
export async function deleteResource(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireRole('super_admin');
  const supabase = await createClient();
  const { error } = await supabase.from('resources').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/resources');
  return { ok: true };
}

/** Acknowledge (sign off) a resource that requires it. */
export async function signOffResource(resourceId: string): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from('resource_signoffs').insert({ resource_id: resourceId, profile_id: profile.id });
  if (error && !error.message.includes('duplicate')) return { ok: false, error: error.message };
  revalidatePath('/resources');
  return { ok: true };
}
