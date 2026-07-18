import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireRole } from '@/lib/auth';
import { LocationForm } from '../../location-form';

export default async function NewLocationPage() {
  await requireRole('super_admin');
  return (
    <div className="space-y-5">
      <Link href="/admin" className="flex items-center gap-1 text-sm font-medium text-brand-700">
        <ArrowLeft size={16} /> Back to admin
      </Link>
      <h1 className="font-display text-2xl font-bold text-brand-900">Add location</h1>
      <LocationForm location={null} />
    </div>
  );
}
