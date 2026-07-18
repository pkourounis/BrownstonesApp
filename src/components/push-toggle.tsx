'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { saveSubscription, removeSubscription } from '@/app/(app)/profile/push-actions';

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlB64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushToggle() {
  const [supported, setSupported] = useState(true);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !VAPID) {
      setSupported(false);
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setOn(!!sub))
      .catch(() => {});
  }, []);

  const enable = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setMsg('Notifications are blocked in your browser settings.'); setBusy(false); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(VAPID!) as BufferSource });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const res = await saveSubscription({ endpoint: json.endpoint, keys: json.keys }, navigator.userAgent);
      if (res.ok) { setOn(true); setMsg('Notifications on for this device.'); }
      else setMsg(res.error ?? 'Could not enable.');
    } catch {
      setMsg('Could not enable notifications on this device.');
    }
    setBusy(false);
  };

  const disable = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await removeSubscription(sub.endpoint); await sub.unsubscribe(); }
      setOn(false);
      setMsg('Notifications off for this device.');
    } catch {
      setMsg('Could not turn off notifications.');
    }
    setBusy(false);
  };

  if (!supported) {
    return (
      <div className="card">
        <h2 className="font-semibold text-brand-900">Notifications</h2>
        <p className="mt-1 text-sm text-brand-500">This device or browser doesn&apos;t support push notifications. On iPhone, add the app to your Home Screen first.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-brand-900">Notifications</h2>
          <p className="text-sm text-brand-500">Get push alerts for direct messages and posts that need your acknowledgment.</p>
        </div>
        <button onClick={on ? disable : enable} disabled={busy} className={`shrink-0 ${on ? 'btn-secondary' : 'btn-primary'} h-9 px-3 text-sm`}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : on ? <><BellOff size={15} /> Turn off</> : <><Bell size={15} /> Turn on</>}
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-brand-600">{msg}</p>}
    </div>
  );
}
