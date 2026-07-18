import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import type { StaffingRule } from '@/lib/database.types';
import { LocationForm } from '../../location-form';
import { rowsFromRules, type CopySource } from '../../staffing-shared';

export const dynamic = 'force-dynamic';

export default async function NewLocationPage() {
  await requireRole('super_admin');
  const supabase = await createClient();

  // Existing stores + their staffing rules, so a new store can copy a chart.
  const [{ data: locs }, { data: rules }] = await Promise.all([
    supabase.from('locations').select('id, name').eq('is_active', true).order('name'),
    supabase.from('staffing_rules').select('*').order('sort_order'),
  ]);
  const rulesByLoc = new Map<string, StaffingRule[]>();
  for (const r of (rules ?? []) as StaffingRule[]) {
    rulesByLoc.set(r.location_id, [...(rulesByLoc.get(r.location_id) ?? []), r]);
  }
  const sources: CopySource[] = ((locs ?? []) as { id: string; name: string }[])
    .filter((l) => (rulesByLoc.get(l.id)?.length ?? 0) > 0)
    .map((l) => ({ id: l.id, name: l.name, rows: rowsFromRules(rulesByLoc.get(l.id) ?? []) }));

  return (
    <div className="space-y-5">
      <Link href="/admin" className="flex items-center gap-1 text-sm font-medium text-brand-700">
        <ArrowLeft size={16} /> Back to admin
      </Link>
      <h1 className="font-display text-2xl font-bold text-brand-900">Add location</h1>
      <LocationForm location={null} staffingSources={sources} />
    </div>
  );
}
