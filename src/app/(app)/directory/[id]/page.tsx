import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Instagram, Globe, MapPin } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { roleLabel } from '@/lib/roles';
import type { DirectoryProfile } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

const DEPT_LABEL: Record<string, string> = { foh: 'Front of house', boh: 'Back of house', management: 'Management', support: 'Support' };

function initials(p: DirectoryProfile) {
  const name = p.display_name || p.full_name || `${p.first_name ?? ''} ${p.last_name ?? ''}`;
  return name.trim().split(/\s+/).map((n) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'BC';
}
const igUrl = (v: string) => (v.startsWith('http') ? v : `https://instagram.com/${v.replace(/^@/, '')}`);
const ttUrl = (v: string) => (v.startsWith('http') ? v : `https://tiktok.com/@${v.replace(/^@/, '')}`);
const fbUrl = (v: string) => (v.startsWith('http') ? v : `https://facebook.com/${v}`);
const siteUrl = (v: string) => (v.startsWith('http') ? v : `https://${v}`);

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireProfile();
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('directory_profiles').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();
  const p = data as DirectoryProfile;
  const name = p.display_name || p.full_name || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Team member';

  const socials: { label: string; href: string }[] = [];
  if (p.instagram) socials.push({ label: 'Instagram', href: igUrl(p.instagram) });
  if (p.tiktok) socials.push({ label: 'TikTok', href: ttUrl(p.tiktok) });
  if (p.facebook) socials.push({ label: 'Facebook', href: fbUrl(p.facebook) });
  if (p.website) socials.push({ label: 'Website', href: siteUrl(p.website) });

  return (
    <div className="space-y-5">
      <Link href="/directory" className="flex items-center gap-1 text-sm font-medium text-brand-700">
        <ArrowLeft size={16} /> Back to team
      </Link>

      <div className="card flex flex-col items-center gap-3 text-center">
        {p.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.avatar_url} alt="" className="h-24 w-24 rounded-full border border-brand-100 object-cover" />
        ) : (
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-200 text-2xl font-semibold text-brand-700">
            {initials(p)}
          </span>
        )}
        <div>
          <h1 className="text-xl font-bold text-brand-900">{name}</h1>
          <p className="text-sm text-brand-500">{p.title || roleLabel(p.role)}</p>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-brand-500">
            {p.location_name && <span className="flex items-center gap-1"><MapPin size={12} /> {p.location_name}</span>}
            {p.department && <span>{DEPT_LABEL[p.department] ?? p.department}</span>}
          </div>
        </div>
      </div>

      {p.bio && (
        <div className="card">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-400">About</h2>
          <p className="whitespace-pre-line text-sm text-brand-800">{p.bio}</p>
        </div>
      )}

      {socials.length > 0 && (
        <div className="card">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-400">Find them</h2>
          <div className="flex flex-wrap gap-2">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100"
              >
                {s.label === 'Instagram' ? <Instagram size={14} /> : s.label === 'Website' ? <Globe size={14} /> : null}
                {s.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
