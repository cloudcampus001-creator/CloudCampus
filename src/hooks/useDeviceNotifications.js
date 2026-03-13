/**
 * useDeviceNotifications.js
 * src/hooks/useDeviceNotifications.js
 *
 * Fix: sendTags was being called BEFORE register() completed.
 * OneSignal silently drops tags for unsubscribed devices.
 * Now: register first → wait for subscription confirmed → then sendTags.
 */

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

// ─────────────────────────────────────────────────────────────────────────────
// RELEVANCE CHECK (for in-app toasts)
// ─────────────────────────────────────────────────────────────────────────────
function isRelevant(notif, { role, userId, classId, studentMatricule }) {
  const type = notif.target_type;
  const tid  = notif.target_id;
  if (type === 'school') return true;
  const matchesId = (tid === null || tid === undefined || tid === 0) || String(tid) === String(userId);
  switch (role) {
    case 'administrator':  return type === 'administrator'     && matchesId;
    case 'vice-principal': return type === 'vice_principal'    && matchesId;
    case 'teacher':        return type === 'teacher'           && matchesId;
    case 'discipline':     return type === 'discipline_master' && matchesId;
    case 'parent':
      if (type === 'class'  && String(tid) === String(classId))          return true;
      if (type === 'parent' && String(tid) === String(studentMatricule)) return true;
      return false;
    default: return false;
  }
}

function isMedianApp() {
  return typeof window !== 'undefined' && !!window.gonative;
}

// ─────────────────────────────────────────────────────────────────────────────
// WAIT UNTIL SUBSCRIBED
// Polls onesignalInfo every 2s until isSubscribed = true, then resolves.
// Gives up after 30s (user may have denied, or very slow device).
// ─────────────────────────────────────────────────────────────────────────────
function waitUntilSubscribed(maxWaitMs = 30000) {
  return new Promise((resolve) => {
    const deadline = Date.now() + maxWaitMs;

    function check() {
      if (!window.gonative?.onesignal?.onesignalInfo) {
        resolve(false);
        return;
      }
      window.gonative.onesignal.onesignalInfo({
        callback: (info) => {
          console.log('[DeviceNotif] onesignalInfo:', JSON.stringify(info));
          if (info?.isSubscribed) {
            resolve(true);
          } else if (Date.now() < deadline) {
            setTimeout(check, 2000); // retry in 2s
          } else {
            console.warn('[DeviceNotif] Gave up waiting for subscription');
            resolve(false);
          }
        },
      });
    }

    check();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTER THEN TAG
// 1. Call register() — shows permission dialog on first run
// 2. Poll until isSubscribed = true
// 3. Call sendTags — OneSignal now accepts them
// ─────────────────────────────────────────────────────────────────────────────
async function registerAndTag({ schoolId, role, userId, classId, studentMatricule }) {
  if (!isMedianApp()) return;

  // Step 1: trigger permission dialog / confirm subscription
  if (window.gonative?.onesignal?.register) {
    window.gonative.onesignal.register();
  }

  // Step 2: wait until the device is actually subscribed
  const subscribed = await waitUntilSubscribed();

  if (!subscribed) {
    console.warn('[DeviceNotif] Device not subscribed — tags not sent');
    return;
  }

  // Step 3: now safe to set tags
  const tags = {
    school_id:         String(schoolId          || ''),
    role:              String(role              || ''),
    user_id:           String(userId            || ''),
    class_id:          String(classId           || ''),
    student_matricule: String(studentMatricule  || ''),
    last_login:        new Date().toISOString().slice(0, 10),
  };

  console.log('[DeviceNotif] Sending tags:', JSON.stringify(tags));

  if (window.gonative?.onesignal?.sendTags) {
    window.gonative.onesignal.sendTags({ tags });
    console.log('[DeviceNotif] Tags sent successfully');
  } else {
    console.warn('[DeviceNotif] sendTags not available on this bridge version');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WEB PUSH FALLBACK (desktop browser only)
// ─────────────────────────────────────────────────────────────────────────────
let _swReg = null;
async function getSwReg() {
  if (!('serviceWorker' in navigator)) return null;
  if (_swReg) return _swReg;
  try {
    _swReg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return _swReg;
  } catch (_) { return null; }
}
async function fireBrowserNotif(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = { body: body || '', icon: '/favicon.ico', badge: '/favicon.ico', tag: `cc_${Date.now()}`, renotify: true, vibrate: [200, 100, 200] };
  const reg = await getSwReg();
  if (reg) { try { await reg.showNotification(title, opts); return; } catch (_) {} }
  try { const n = new Notification(title, opts); setTimeout(() => n.close(), 8000); } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────
export function useDeviceNotifications() {
  const { toast } = useToast();

  const schoolId         = localStorage.getItem('schoolId');
  const role             = localStorage.getItem('userRole');
  const userId           = localStorage.getItem('userId');
  const classId          = localStorage.getItem('classId');
  const studentMatricule = localStorage.getItem('studentMatricule');

  const identityRef = useRef({ role, userId, classId, studentMatricule });
  useEffect(() => {
    identityRef.current = { role, userId, classId, studentMatricule };
  }, [role, userId, classId, studentMatricule]);

  // ── Register + tag on login ───────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !schoolId) return;
    if (isMedianApp()) {
      registerAndTag({ schoolId, role, userId, classId, studentMatricule });
    } else {
      getSwReg();
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [userId, schoolId]);

  // ── Realtime → in-app toasts ──────────────────────────────────────────────
  useEffect(() => {
    if (!schoolId) return;
    const channel = supabase
      .channel(`device_notif_${schoolId}_${role}_${userId || 'guest'}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `school_id=eq.${parseInt(schoolId)}` },
        (payload) => {
          const notif = payload.new;
          if (!isRelevant(notif, identityRef.current)) return;
          const body = notif.content ? notif.content.slice(0, 120) + (notif.content.length > 120 ? '…' : '') : '';
          toast({ title: notif.title, description: body, duration: 6000 });
          if (!isMedianApp()) fireBrowserNotif(notif.title, body);
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [schoolId, role, userId, classId, studentMatricule]);
}
