/**
 * useDeviceNotifications.js
 * src/hooks/useDeviceNotifications.js
 *
 * Mount this once inside each dashboard shell component. Completely invisible — no UI.
 *
 * Fixes applied vs previous version:
 *   1. RELEVANCE BUG: targeted notifications (teacher, parent, VP, etc.) were not
 *      signalling because only target_type='school' was broad enough to pass the
 *      filter. Now every target_type is handled correctly, including broadcasts
 *      where target_id is null (meaning "all of this role").
 *
 *   2. MOBILE BUG: new Notification() is a desktop-only API. Android Chrome and
 *      iOS Safari (PWA) silently ignore it. This file now registers a service
 *      worker (public/sw.js) and uses registration.showNotification() which is
 *      the exact API WhatsApp and every other app uses to produce the
 *      slide-down-from-top signal on mobile.
 */
import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

// ─────────────────────────────────────────────────────────────────────────────
// RELEVANCE CHECK
// A notification is relevant to the current user when:
//   • target_type = 'school'                         → everybody sees it
//   • target_type matches the user's role AND
//       target_id = userId  (sent to this specific person)
//       OR target_id is null/0  (broadcast to everyone of that role)
//   • parent special case: class-level or direct parent target
// ─────────────────────────────────────────────────────────────────────────────
function isRelevant(notif, { role, userId, classId, studentMatricule }) {
  const type = notif.target_type;
  const tid  = notif.target_id;

  // School-wide → every logged-in user
  if (type === 'school') return true;

  // Broadcast to role (no specific target_id) or sent to this specific user
  const matchesId = (tid === null || tid === undefined || tid === 0)
    || String(tid) === String(userId);

  switch (role) {
    case 'administrator':
      return type === 'administrator' && matchesId;

    case 'vice-principal':
      return type === 'vice_principal' && matchesId;

    case 'teacher':
      return type === 'teacher' && matchesId;

    case 'discipline':
      return type === 'discipline_master' && matchesId;

    case 'parent':
      // Class-level notification (sent to all parents of a class)
      if (type === 'class' && String(tid) === String(classId)) return true;
      // Direct notification to this parent
      if (type === 'parent' && String(tid) === String(studentMatricule)) return true;
      return false;

    default:
      return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE WORKER REGISTRATION
// We register once and reuse the same registration object.
// This must complete before we can call showNotification().
// ─────────────────────────────────────────────────────────────────────────────
let _swReg = null;

async function getSwRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  if (_swReg) return _swReg;
  try {
    _swReg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    // Wait until the SW is actually active before we use it
    await navigator.serviceWorker.ready;
    return _swReg;
  } catch (err) {
    console.warn('[DeviceNotif] Service worker registration failed:', err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FIRE NOTIFICATION
// Uses Service Worker showNotification() — this is the API that produces
// the WhatsApp-style slide-from-top banner on Android Chrome and iOS Safari.
// Falls back to the old Notification() API on desktop if SW is unavailable.
// ─────────────────────────────────────────────────────────────────────────────
async function fireNotification(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const options = {
    body:     body || '',
    icon:     '/favicon.ico',
    badge:    '/favicon.ico',
    tag:      `cloudcampus_${Date.now()}`,  // unique so notifications stack
    renotify: true,
    vibrate:  [200, 100, 200],              // haptic feedback on Android
  };

  const reg = await getSwRegistration();

  if (reg) {
    // ── Mobile + Desktop: Service Worker path ──────────────────────────────
    // This is the ONLY path that works on Android Chrome and iOS Safari PWA
    try {
      await reg.showNotification(title, options);
      return;
    } catch (err) {
      console.warn('[DeviceNotif] showNotification failed, falling back:', err.message);
    }
  }

  // ── Desktop fallback: classic Notification API ─────────────────────────
  try {
    const n = new Notification(title, options);
    setTimeout(() => n.close(), 8000);
  } catch (_) { /* permission blocked */ }
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

  // Keep identity in a ref so the Realtime callback always sees current values
  const identityRef = useRef({ role, userId, classId, studentMatricule });
  useEffect(() => {
    identityRef.current = { role, userId, classId, studentMatricule };
  }, [role, userId, classId, studentMatricule]);

  // Register SW + ask permission once on mount
  useEffect(() => {
    getSwRegistration(); // start SW registration immediately

    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          console.log('[DeviceNotif] Notification permission granted.');
        }
      });
    }
  }, []);

  // Supabase Realtime subscription
  useEffect(() => {
    if (!schoolId) return;

    const channelName = `device_notif_${schoolId}_${role}_${userId || 'guest'}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `school_id=eq.${parseInt(schoolId)}`,
        },
        (payload) => {
          const notif    = payload.new;
          const identity = identityRef.current;

          if (!isRelevant(notif, identity)) return;

          const body = notif.content
            ? notif.content.slice(0, 120) + (notif.content.length > 120 ? '…' : '')
            : '';

          // 1 — Device notification (slides from top, works on mobile + desktop)
          fireNotification(notif.title, body);

          // 2 — In-app toast (visible on whichever page the user is on)
          toast({ title: notif.title, description: body, duration: 6000 });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [schoolId, role, userId, classId, studentMatricule]);
}
