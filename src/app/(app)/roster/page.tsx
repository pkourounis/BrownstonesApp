import Link from 'next/link';
import { Star, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { money2 } from '@/lib/format';
import { DEPARTMENT_LABELS } from '@/lib/database.types';
import type { Location, Employee, Department } from '@/lib/database.types';
import { RosterControls } from './roster-controls';
import { RosterFilters } from './roster-filters';
import { GrantAll } from './grant-all';

export const dynamic = 'force-dynamic';

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole('super_admin', 'manager');
  const sp = await searchParams;
  const store = sp.store && sp.store !== 'all' ? sp.store : null;
  const status = sp.status ?? 'active';

  const supabase = await createClient();
  const { data: locs } = await supabase.from('locations').select('id, name').eq('is_active', true);
  const locations = (locs ?? []) as Pick<Location, 'id' | 'name'>[];
  const nameById = new Map(locations.map((l) => [l.id, l.name]));

  let query = supabase.from('employees').select('*').order('first_name');
  if (status === 'active') query = query.eq('active', true);
  else if (status === 'archived') query = query.eq('active', false);
  if (store) query = query.eq('location_id', store);
  if (sp.dept) query = query.eq('department', sp.dept as Department);
  if (sp.title) query = query.eq('role_title', sp.title);
  const q = sp.q?.replace(/[,()*%]/g, '').trim();
  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`);

  const { data: emps } = await query;
  const employees = (emps ?? []) as Employee[];

  const { count: pendingAccess } = await supabase
    .from('employees')
    .select('*', { count: 'exact', head: true })
    .eq('active', true)
    .is('profile_id', null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-900">Roster</h1>
        <p className="text-sm text-brand-600">{employees.length} shown · imported from Toast + added here</p>
      </div>

      <RosterFilters locations={locations} />
      <RosterControls locations={locations} store={store} />
      <GrantAll pendingCount={pendingAccess ?? 0} />

      {employees.length === 0 ? (
        <div className="card text-center text-sm text-brand-500">No employees match these filters.</div>
      ) : (
        <ul className="space-y-2">
          {employees.map((e) => (
            <li key={e.id} className="card py-3">
              <Link href={`/roster/${e.id}`} className={`flex items-center gap-3 ${e.active ? '' : 'opacity-50'}`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-brand-900">
                    {e.first_name} {e.last_name ?? ''}
                    {e.source === 'manual' && (
                      <span className="ml-2 rounded-full bg-gold-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">added</span>
                    )}
                    {!e.active && <span className="ml-2 text-[10px] uppercase text-brand-400">archived</span>}
                  </p>
                  <p className="truncate text-xs text-brand-500">
                    {e.role_title ?? 'Staff'}
                    {e.department ? ` · ${DEPARTMENT_LABELS[e.department]}` : ''}
                    {` · ${nameById.get(e.location_id) ?? '—'}`}
                  </p>
                </div>
                {e.rating ? (
                  <span className="flex items-center gap-0.5 text-sm font-semibold tabular-nums text-brand-700">
                    <Star size={14} className="fill-gold-400 text-gold-500" /> {e.rating}
                  </span>
                ) : null}
                <span className="shrink-0 text-right text-xs tabular-nums text-brand-500">
                  {e.default_wage && Number(e.default_wage) > 0 ? `${money2(Number(e.default_wage))}/hr` : ''}
                </span>
                <ChevronRight size={18} className="shrink-0 text-brand-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
