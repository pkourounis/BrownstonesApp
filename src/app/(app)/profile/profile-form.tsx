'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { roleLabel } from '@/lib/roles';
import { jobRoleOptions } from '@/lib/job-roles';
import type { Profile } from '@/lib/database.types';
import { Check, Loader2, Camera } from 'lucide-react';

const DEPARTMENTS: [string, string][] = [
  ['foh', 'Front of House'],
  ['boh', 'Back of House'],
  ['management', 'Management'],
];

function initials(first: string, last: string) {
  const a = first.trim()[0] ?? '';
  const b = last.trim()[0] ?? '';
  return (a + b).toUpperCase() || 'BC';
}

// Module-level so its identity is stable across renders — defining it inside the
// component remounts every input on each keystroke (you could only type one char).
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

export function ProfileForm({
  profile,
  primaryLocation,
}: {
  profile: Profile;
  primaryLocation: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? '');
  const [uploading, setUploading] = useState(false);

  const [f, setF] = useState({
    first_name: profile.first_name ?? '',
    last_name: profile.last_name ?? '',
    display_name: profile.display_name ?? '',
    phone: profile.phone ?? '',
    email: profile.email ?? '',
    address: profile.address ?? '',
    facebook: profile.facebook ?? '',
    instagram: profile.instagram ?? '',
    department: profile.department ?? '',
    title: profile.title ?? '',
    hired_at: profile.hired_at ? profile.hired_at.slice(0, 10) : '',
    birthday: profile.birthday ? profile.birthday.slice(0, 10) : '',
    marital_status: profile.marital_status ?? '',
    bio: profile.bio ?? '',
    emergency_contact_name: profile.emergency_contact_name ?? '',
    emergency_contact_phone: profile.emergency_contact_phone ?? '',
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (upErr) {
      setUploading(false);
      setError(upErr.message);
      return;
    }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = data.publicUrl;
    await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id);
    setAvatarUrl(url);
    setUploading(false);
    router.refresh();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    const full_name = `${f.first_name} ${f.last_name}`.trim() || profile.full_name;
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: f.first_name || null,
        last_name: f.last_name || null,
        full_name,
        display_name: f.display_name || null,
        phone: f.phone || null,
        email: f.email || null,
        address: f.address || null,
        facebook: f.facebook || null,
        instagram: f.instagram || null,
        department: (f.department || null) as Profile['department'],
        title: f.title || null,
        hired_at: f.hired_at || null,
        birthday: f.birthday || null,
        marital_status: f.marital_status || null,
        bio: f.bio || null,
        emergency_contact_name: f.emergency_contact_name || null,
        emergency_contact_phone: f.emergency_contact_phone || null,
      })
      .eq('id', profile.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {/* Photo + identity */}
      <div className="card flex items-center gap-4">
        <div className="relative">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-20 w-20 rounded-full border border-brand-100 object-cover" />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-200 text-2xl font-semibold text-brand-700">
              {initials(f.first_name, f.last_name)}
            </span>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label="Upload photo"
            className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-brand-700 text-white shadow"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-brand-900">
            {f.first_name || f.last_name ? `${f.first_name} ${f.last_name}`.trim() : profile.full_name}
          </p>
          <p className="text-sm text-brand-500">
            {roleLabel(profile.role)} · {primaryLocation ?? 'Unassigned'}
          </p>
          <p className="mt-0.5 text-xs text-brand-400">Tap the camera to upload a photo</p>
        </div>
      </div>

      {/* Basics */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-brand-900">Basics</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <input className="input" value={f.first_name} onChange={set('first_name')} required />
          </Field>
          <Field label="Last name">
            <input className="input" value={f.last_name} onChange={set('last_name')} />
          </Field>
        </div>
        <Field label="Preferred name">
          <input className="input" value={f.display_name} onChange={set('display_name')} placeholder="What the team calls you" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <input type="tel" className="input" value={f.phone} onChange={set('phone')} placeholder="(516) 555-0123" />
          </Field>
          <Field label="Email">
            <input type="email" className="input" value={f.email} onChange={set('email')} />
          </Field>
        </div>
        <Field label="Address">
          <input className="input" value={f.address} onChange={set('address')} placeholder="Street, City, NY" />
        </Field>
        <Field label="Birthday">
          <input type="date" className="input" value={f.birthday} onChange={set('birthday')} />
        </Field>
        <Field label="Marital status">
          <select className="input" value={f.marital_status} onChange={set('marital_status')}>
            <option value="">—</option>
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="other">Prefer not to say</option>
          </select>
        </Field>
      </div>

      {/* Work */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-brand-900">Work</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Department">
            <select className="input" value={f.department} onChange={set('department')}>
              <option value="">—</option>
              {DEPARTMENTS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Job role">
            <select className="input" value={f.title} onChange={set('title')}>
              <option value="">—</option>
              {jobRoleOptions(profile.title).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Time hired">
          <input type="date" className="input" value={f.hired_at} onChange={set('hired_at')} />
        </Field>
      </div>

      {/* About + links */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-brand-900">About me</h2>
        <Field label="Bio">
          <textarea className="input min-h-[90px]" value={f.bio} onChange={set('bio')} placeholder="A few words about you" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Facebook">
            <input className="input" value={f.facebook} onChange={set('facebook')} placeholder="facebook.com/you" />
          </Field>
          <Field label="Instagram">
            <input className="input" value={f.instagram} onChange={set('instagram')} placeholder="@handle" />
          </Field>
        </div>
      </div>

      {/* Emergency */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-brand-900">Emergency contact</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <input className="input" value={f.emergency_contact_name} onChange={set('emergency_contact_name')} />
          </Field>
          <Field label="Phone">
            <input type="tel" className="input" value={f.emergency_contact_phone} onChange={set('emergency_contact_phone')} />
          </Field>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button type="submit" className="btn-primary sticky bottom-4 w-full shadow-lg" disabled={saving}>
        {saving ? <Loader2 className="animate-spin" size={18} /> : saved ? (
          <>
            <Check size={18} /> Saved
          </>
        ) : (
          'Save changes'
        )}
      </button>
    </form>
  );
}
