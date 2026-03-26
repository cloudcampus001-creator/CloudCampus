/**
 * useDeviceNotifications.js
 * src/hooks/useDeviceNotifications.js
 *
 * What this does:
 *  1. On login → registers device with OneSignal via Median bridge and sends
 *     tags (school_id, role, user_id, class_id, student_matricule).
 *     Tags are what the send-push Edge Function uses to target the right devices.
 *
 *  2. Listens to Supabase realtime on the notifications table and:
 *     a. Shows an in-app toast when the app is in the FOREGROUND
 *     b. On Median (mobile app): also fires a Median local notification so
 *        the native banner appears even while the app is open (foreground push)
 *     c. On web browser: fires a Web Push notification via the Service Worker
 *
 *  The BACKGROUND push (when app is closed / phone locked) is handled
 *  server-side by the send-push Supabase Edge Function + OneSignal.
 *  No client code needed for that path — it works automatically once
 *  the device is registered with OneSignal tags.
 */

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

// ─────────────────────────────────────────────────────────────────────────────
// RELEVANCE CHECK (for in-app toasts & foreground native notifications)
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
// DETECT MEDIAN (mobile app wrapper)
// ─────────────────────────────────────────────────────────────────────────────
function isMedianApp() {
  return typeof window !== 'undefined' && !!window.gonative;
}

// ─────────────────────────────────────────────────────────────────────────────
// WAIT UNTIL SUBSCRIBED
// Polls onesignalInfo every 2s until isSubscribed = true.
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
            setTimeout(check, 2000);
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
// 1. Trigger OneSignal permission dialog (first run only)
// 2. Poll until isSubscribed = true
// 3. Set tags — these are used by send-push Edge Function to target devices
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
// MEDIAN FOREGROUND LOCAL NOTIFICATION
// When the app IS open and a realtime event fires, we still want the native
// banner to appear at the top of the screen (like WhatsApp does when you're
// inside the app). Median's localnotifications bridge handles this.
// ─────────────────────────────────────────────────────────────────────────────
function fireMedianLocalNotif(title, body, url) {
  if (!isMedianApp()) return;

  // Median bridge: https://median.co/docs/local-notifications
  if (window.gonative?.localnotifications?.add) {
    window.gonative.localnotifications.add({
      id:      Date.now(),
      title:   title || 'CloudCampus',
      message: body  || '',
      badge:   1,
      // Deep link — when tapped, opens this URL inside the app
      url:     url   || 'https://cloudcampus237.com/',
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WEB PUSH FALLBACK (desktop / browser users who are NOT on Median)
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
  const opts = {
    body:     body || '',
    icon:     '/logo.png',
    badge:    '/logo.png',
    tag:      `cc_${Date.now()}`,
    renotify: true,
    vibrate:  [200, 100, 200],
  };
  const reg = await getSwReg();
  if (reg) {
    try { await reg.showNotification(title, opts); return; } catch (_) {}
  }
  try {
    const n = new Notification(title, opts);
    setTimeout(() => n.close(), 8000);
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD DEEP LINK for notification tap
// ─────────────────────────────────────────────────────────────────────────────
function buildDeepLink(role) {
  const base = 'https://cloudcampus237.com';
  const paths = {
    administrator:  '/dashboard/administrator',
    'vice-principal': '/dashboard/vice-principal',
    teacher:        '/dashboard/teacher',
    discipline:     '/dashboard/discipline',
    parent:         '/dashboard/parent/notifications',
  };
  return base + (paths[role] || '/');
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
      // Mobile app — register with OneSignal and set targeting tags
      registerAndTag({ schoolId, role, userId, classId, studentMatricule });
    } else {
      // Web browser — set up service worker and request Web Push permission
      getSwReg();
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [userId, schoolId]);

  // ── Realtime subscription ─────────────────────────────────────────────────
  // Handles FOREGROUND notifications (app is open).
  // BACKGROUND notifications are handled by send-push Edge Function + OneSignal.
  useEffect(() => {
    if (!schoolId) return;

    const channel = supabase
      .channel(`device_notif_${schoolId}_${role}_${userId || 'guest'}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `school_id=eq.${parseInt(schoolId)}`,
        },
        (payload) => {
          const notif = payload.new;

          // Skip if not relevant to this user
          if (!isRelevant(notif, identityRef.current)) return;

          const body = notif.content
            ? notif.content.slice(0, 120) + (notif.content.length > 120 ? '…' : '')
            : '';

          // ── In-app toast (always shown when app is open) ──
          toast({ title: notif.title, description: body, duration: 6000 });

          // ── Native foreground notification (the WhatsApp-style banner) ──
          const deepLink = buildDeepLink(identityRef.current.role);

          if (isMedianApp()) {
            // Median app → use local notification bridge for native banner
            fireMedianLocalNotif(notif.title, body, deepLink);
          } else {
            // Web browser → use Service Worker Web Push
            fireBrowserNotif(notif.title, body);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [schoolId, role, userId, classId, studentMatricule]);
}
