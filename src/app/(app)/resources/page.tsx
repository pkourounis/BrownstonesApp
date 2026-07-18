import { BookOpen } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { DEPARTMENT_LABELS } from '@/lib/database.types';
import type { Location, Resource, ResourceAssignment, Department } from '@/lib/database.types';
import { ResourceComposer } from './resource-composer';
import { ResourceCard, type ResourceItem } from './resource-card';

export const dynamic = 'force-dynamic';

export default async function ResourcesPage() {
  const profile = await requireProfile();
  const isSuper = profile.role === 'super_admin';
  const supabase = await createClient();

  // RLS returns only resources this user is allowed to see.
  const { data: resData } = await supabase
    .from('resources')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('created_at', { ascending: false });
  const resources = (resData as Resource[]) ?? [];
  const ids = resources.map((r) => r.id);

  const [{ data: signoffs }, { data: locs }, { data: assigns }] = await Promise.all([
    ids.length ? supabase.from('resource_signoffs').select('resource_id').eq('profile_id', profile.id).in('resource_id', ids) : Promise.resolve({ data: [] }),
    supabase.from('locations').select('id, name').eq('is_active', true).order('name'),
    isSuper && ids.length ? supabase.from('resource_assignments').select('*').in('resource_id', ids) : Promise.resolve({ data: [] }),
  ]);

  const signedIds = new Set((signoffs ?? []).map((s) => s.resource_id));
  const locations = (locs ?? []) as Pick<Location, 'id' | 'name'>[];
  const nameById = new Map(locations.map((l) => [l.id, l.name]));

  // Audience label for super admins (from the first assignment row).
  const audienceByResource = new Map<string, string>();
  for (const a of (assigns as ResourceAssignment[]) ?? []) {
    if (audienceByResource.has(a.resource_id)) continue;
    let label = 'Everyone';
    if (a.managers_only) label = 'Managers only';
    else if (a.location_id) label = nameById.get(a.location_id) ?? 'Store';
    else if (a.department) label = DEPARTMENT_LABELS[a.department as Department];
    audienceByResource.set(a.resource_id, label);
  }

  // Group by category (already sorted by category).
  const groups: { category: string; items: ResourceItem[] }[] = [];
  for (const r of resources) {
    const item: ResourceItem = {
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      kind: r.kind,
      url: r.url ?? '',
      requiresSignoff: r.requires_signoff,
      signedByMe: signedIds.has(r.id),
      audienceLabel: audienceByResource.get(r.id) ?? null,
    };
    const g = groups.find((x) => x.category === r.category);
    if (g) g.items.push(item);
    else groups.push({ category: r.category, items: [item] });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-900">Resources</h1>
          <p className="text-sm text-brand-600">Manuals, training, and helpful links.</p>
        </div>
        {isSuper && <ResourceComposer locations={locations} />}
      </div>

      {groups.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 py-10 text-center text-sm text-brand-500">
          <BookOpen size={28} className="text-brand-300" />
          {isSuper ? 'No resources yet — tap “Add resource” to publish your first one.' : 'No resources available to you yet.'}
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.category}>
            <h2 className="mb-2 font-semibold text-brand-900">{g.category}</h2>
            <div className="space-y-3">
              {g.items.map((r) => (
                <ResourceCard key={r.id} r={r} canManage={isSuper} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
