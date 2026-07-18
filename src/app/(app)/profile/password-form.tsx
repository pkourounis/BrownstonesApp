'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Check, Loader2, KeyRound } from 'lucide-react';

export function PasswordChange() {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (pw.length < 8) return setError('Use at least 8 characters.');
    if (pw !== confirm) return setError('Passwords do not match.');

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSaving(false);
    if (error) return setError(error.message);
    setSaved(true);
    setPw('');
    setConfirm('');
  }

  return (
    <form onSubmit={save} className="card space-y-4">
      <h2 className="flex items-center gap-2 font-semibold text-brand-900">
        <KeyRound size={18} className="text-brand-500" /> Change password
      </h2>
      <div>
        <label className="label" htmlFor="new-pw">New password</label>
        <input id="new-pw" type="password" autoComplete="new-password" className="input" value={pw}
          onChange={(e) => setPw(e.target.value)} placeholder="At least 8 characters" />
      </div>
      <div>
        <label className="label" htmlFor="confirm-pw">Confirm password</label>
        <input id="confirm-pw" type="password" autoComplete="new-password" className="input" value={confirm}
          onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button type="submit" className="btn-secondary w-full" disabled={saving || !pw}>
        {saving ? <Loader2 className="animate-spin" size={18} /> : saved ? (
          <><Check size={18} /> Password updated</>
        ) : 'Update password'}
      </button>
    </form>
  );
}
