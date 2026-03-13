/**
 * useDeviceNotifications.js
 * src/hooks/useDeviceNotifications.js
 *
 * Simplified approach — uses OneSignal TAGS instead of player IDs.
 *
 * How it works:
 *  - On login, we tag the device: { school_id, role, user_id, class_id, ... }
 *  - The edge function uses these tags as filters to find the right devices
 *  - No device_tokens table needed, no player ID capture, no timing issues
 *  - OneSignal handles everything — tags survive reinstalls and ID rotation
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

// ─────────────────────────────────────────────────────────────────────────────
// DETECT MEDIAN.CO
// ─────────────────────────────────────────────────────────────────────────────
function isMedianApp() {
  return typeof window !== 'undefined' && !!window.gonative;
}

// ─────────────────────────────────────────────────────────────────────────────
// TAG THE DEVICE
// Sets OneSignal tags so the edge function can find this device by filter.
// Called on every login — safe to call multiple times, tags just overwrite.
// ─────────────────────────────────────────────────────────────────────────────
function tagDevice({ schoolId, role, userId, classId, studentMatricule }) {
  if (!isMedianApp()) return;

  const tags = {
    school_id:         String(schoolId  || ''),
    role:              String(role      || ''),
    user_id:           String(userId    || ''),
    class_id:          String(classId   || ''),
    student_matricule: String(studentMatricule || ''),
    // timestamp so you can see last-active in OneSignal dashboard
    last_login:        new Date().toISOString().slice(0, 10),
  };

  console.log('[DeviceNotif] Setting OneSignal tags:', tags);

  // median.co bridge call — sets tags on this device in OneSignal
  if (window.gonative?.onesignal?.sendTags) {
    window.gonative.onesignal.sendTags({ tags });
  }

  // Also trigger permission dialog on new phones
  if (window.gonative?.onesignal?.register) {
    window.gonative.onesignal.register();
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

  // ── Tag the device on login ───────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !schoolId) return;

    if (isMedianApp()) {
      tagDevice({ schoolId, role, userId, classId, studentMatricule });
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
