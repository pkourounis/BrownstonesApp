import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { MapPin, Building2 } from 'lucide-react';

export default async function AdminPage() {
  await requireRole('super_admin');
  const supabase = await createClient();

  const { data: locations } = await supabase
    .from('locations')
    .select('id, name, city, state, is_active')
    .order('name');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-900">Admin</h1>
        <p className="text-sm text-brand-600">Manage locations and organization settings.</p>
      </div>

      <section>
        <h2 className="mb-2 flex items-center gap-2 font-semibold text-brand-900">
          <Building2 size={18} /> Locations
        </h2>
        <ul className="space-y-2">
          {(locations ?? []).map((l) => (
            <li key={l.id} className="card flex items-center gap-3 py-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <MapPin size={18} />
              </span>
              <div className="flex-1">
                <p className="font-semibold text-brand-900">{l.name}</p>
                <p className="text-sm text-brand-500">
                  {[l.city, l.state].filter(Boolean).join(', ')}
                </p>
              </div>
              {!l.is_active && (
                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-500">
                  Inactive
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="card text-sm text-brand-500">
        Employee invites, role assignment, and location editing land in the next
        release. The permission model and data layer are already in place.
      </div>
    </div>
  );
}
