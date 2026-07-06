'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { roleLabel } from '@/lib/roles';
import type { Profile } from '@/lib/database.types';
import { Check, Loader2 } from 'lucide-react';

export function ProfileForm({
  profile,
  primaryLocation,
}: {
  profile: Profile;
  primaryLocation: string | null;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.full_name);
  const [displayName, setDisplayName] = useState(profile.display_name ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        display_name: displayName || null,
        phone: phone || null,
        bio: bio || null,
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
      <div className="card space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-brand-500">Role</span>
          <span className="font-medium text-brand-900">{roleLabel(profile.role)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-brand-500">Location</span>
          <span className="font-medium text-brand-900">{primaryLocation ?? 'Unassigned'}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-brand-500">Email</span>
          <span className="font-medium text-brand-900">{profile.email}</span>
        </div>
      </div>

      <div className="card space-y-4">
        <div>
          <label className="label" htmlFor="fullName">Full name</label>
          <input id="fullName" className="input" value={fullName}
            onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="displayName">Display name</label>
          <input id="displayName" className="input" value={displayName}
            onChange={(e) => setDisplayName(e.target.value)} placeholder="What the team calls you" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone</label>
          <input id="phone" type="tel" className="input" value={phone}
            onChange={(e) => setPhone(e.target.value)} placeholder="(516) 555-0123" />
        </div>
        <div>
          <label className="label" htmlFor="bio">About</label>
          <textarea id="bio" className="input min-h-[80px]" value={bio}
            onChange={(e) => setBio(e.target.value)} placeholder="A few words about you" />
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button type="submit" className="btn-primary w-full" disabled={saving}>
        {saving ? <Loader2 className="animate-spin" size={18} /> : saved ? (
          <><Check size={18} /> Saved</>
        ) : 'Save changes'}
      </button>
    </form>
  );
}
