import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { money2 } from '@/lib/format';
import type { Location, Employee } from '@/lib/database.types';
import { RosterControls } from './roster-controls';

export const dynamic = 'force-dynamic';

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRole('super_admin', 'manager');
  const sp = await searchParams;
  const store = sp.store && sp.store !== 'all' ? sp.store : null;

  const supabase = await createClient();
  const [{ data: locs }, empRes] = await Promise.all([
    supabase.from('locations').select('id, name').eq('is_active', true),
    (store
      ? supabase.from('employees').select('*').eq('active', true).eq('location_id', store)
      : supabase.from('employees').select('*').eq('active', true)
    ).order('first_name', { ascending: true }),
  ]);

  const locations = (locs ?? []) as Pick<Location, 'id' | 'name'>[];
  const nameById = new Map(locations.map((l) => [l.id, l.name]));
  const employees = (empRes.data ?? []) as Employee[];

  const groups = new Map<string, Employee[]>();
  for (const e of employees) {
    const list = groups.get(e.location_id) ?? [];
    list.push(e);
    groups.set(e.location_id, list);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-900">Roster</h1>
        <p className="text-sm text-brand-600">
          {employees.length} active · imported from Toast + added here
        </p>
      </div>

      <RosterControls locations={locations} store={store} />

      {employees.length === 0 ? (
        <div className="card text-center text-sm text-brand-500">
          No employees yet. Add one, or tap <span className="font-medium">Toast</span> to import from punch history.
        </div>
      ) : (
        [...groups.entries()].map(([locId, staff]) => (
          <section key={locId} className="card">
            <div className="mb-3 flex items-baseline justify-between gap-2 border-b border-brand-100 pb-2">
              <h2 className="font-semibold text-brand-900">{nameById.get(locId) ?? 'Store'}</h2>
              <span className="text-xs text-brand-400">{staff.length}</span>
            </div>
            <ul className="divide-y divide-brand-50">
              {staff.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-brand-900">
                      {e.first_name} {e.last_name ?? ''}
                      {e.source === 'manual' && (
                        <span className="ml-2 rounded-full bg-gold-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">added</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-brand-500">{e.role_title ?? 'Staff'}</p>
                  </div>
                  <span className="shrink-0 text-right text-xs tabular-nums text-brand-500">
                    {e.default_wage && Number(e.default_wage) > 0 ? `${money2(Number(e.default_wage))}/hr` : '—'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
