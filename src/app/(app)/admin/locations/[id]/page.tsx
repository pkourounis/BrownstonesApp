import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import type { Location } from '@/lib/database.types';
import { LocationForm } from '../../location-form';

export const dynamic = 'force-dynamic';

export default async function EditLocationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('super_admin');
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('locations').select('*').eq('id', id).single();
  if (!data) notFound();

  return (
    <div className="space-y-5">
      <Link href="/admin" className="flex items-center gap-1 text-sm font-medium text-brand-700">
        <ArrowLeft size={16} /> Back to admin
      </Link>
      <h1 className="font-display text-2xl font-bold text-brand-900">Edit location</h1>
      <LocationForm location={data as Location} />
    </div>
  );
}
