import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireRole } from '@/lib/auth';
import { getAppSettings } from '@/lib/settings';
import { SettingsForm } from './settings-form';
import { AgentApiInfo } from './agent-api-info';

export const dynamic = 'force-dynamic';

export default async function AppSettingsPage() {
  await requireRole('super_admin');
  const settings = await getAppSettings();

  return (
    <div className="space-y-5">
      <Link href="/admin" className="flex items-center gap-1 text-sm font-medium text-brand-700">
        <ArrowLeft size={16} /> Back to admin
      </Link>
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-900">App settings</h1>
        <p className="text-sm text-brand-600">Branding and scheduling defaults.</p>
      </div>
      <SettingsForm settings={settings} />
      <AgentApiInfo />
    </div>
  );
}
