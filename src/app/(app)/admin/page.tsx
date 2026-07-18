import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { MapPin, Building2, Plus, ChevronRight, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

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
        <p className="text-sm text-brand-600">Manage people, locations, and organization settings.</p>
      </div>

      <Link href="/team" className="card flex items-center gap-3 hover:border-brand-300">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
          <Users size={18} />
        </span>
        <div className="flex-1">
          <p className="font-semibold text-brand-900">People &amp; roles</p>
          <p className="text-sm text-brand-500">Add managers &amp; admins, set roles, reset app access</p>
        </div>
        <ChevronRight size={18} className="text-brand-300" />
      </Link>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold text-brand-900">
            <Building2 size={18} /> Locations
          </h2>
          <Link href="/admin/locations/new" className="btn-primary h-9 px-3 text-xs">
            <Plus size={15} /> Add location
          </Link>
        </div>
        <ul className="space-y-2">
          {(locations ?? []).map((l) => (
            <li key={l.id} className="card py-3">
              <Link href={`/admin/locations/${l.id}`} className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                  <MapPin size={18} />
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-brand-900">{l.name}</p>
                  <p className="text-sm text-brand-500">{[l.city, l.state].filter(Boolean).join(', ') || 'No address set'}</p>
                </div>
                {!l.is_active && (
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-500">Inactive</span>
                )}
                <ChevronRight size={18} className="text-brand-300" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
