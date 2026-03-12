/**
 * useDeviceNotifications.js
 * src/hooks/useDeviceNotifications.js
 *
 * Fixes in this version:
 *  1. PERMISSION BUG: now calls gonative.onesignal.register() which is the
 *     call that triggers the native "Allow notifications?" dialog on new phones.
 *     The old code only called onesignalInfo() which reads state — it never
 *     asks for permission.
 *
 *  2. TIMING BUG: gonative.onesignal.registered fires when the app opens,
 *     before React mounts. The old code added the listener too late and missed
 *     it. Fix: capture the event early via a snippet in index.html (see below),
 *     then read window.__gonativePlayerId when the hook runs.
 *
 *  3. STALE TOKEN BUG: player IDs can rotate after app updates or OS upgrades.
 *     Now re-registers on every login so the DB always has a fresh token.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REQUIRED: add this to your public/index.html <head> BEFORE any other scripts:
 *
 *   <script>
 *     window.__gonativePlayerId = null;
 *     window.addEventListener('gonative.onesignal.registered', function(e) {
 *       window.__gonativePlayerId =
 *         e.detail?.userId || e.detail?.oneSignalUserId || null;
 *     });
 *   </script>
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

// ─────────────────────────────────────────────────────────────────────────────
// RELEVANCE CHECK
// ─────────────────────────────────────────────────────────────────────────────
function isRelevant(notif, { role, userId, classId, studentMatricule }) {
  const type = notif.target_type;
  const tid  = notif.target_id;

  if (type === 'school') return true;

  const matchesId =
    (tid === null || tid === undefined || tid === 0) ||
    String(tid) === String(userId);

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
      if (type === 'class' && String(tid) === String(classId)) return true;
      if (type === 'parent' && String(tid) === String(studentMatricule)) return true;
      return false;
    default:
      return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DETECT MEDIAN.CO WRAPPER
// ─────────────────────────────────────────────────────────────────────────────
function isMedianApp() {
  return typeof window !== 'undefined' && !!window.gonative;
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTER WITH ONESIGNAL AND GET PLAYER ID
//
// Three paths run in parallel — whichever resolves first wins:
//  1. window.__gonativePlayerId — set by the early index.html listener
//  2. gonative.onesignal.registered event — fires after register() completes
//  3. onesignalInfo() direct read — for already-subscribed users
//
// register() is the key call that triggers the permission dialog on new phones.
// ─────────────────────────────────────────────────────────────────────────────
function registerAndGetPlayerId() {
  return new Promise((resolve) => {
    // Path 1: already captured before React loaded
    if (window.__gonativePlayerId) {
      console.log('[DeviceNotif] Using pre-captured player ID');
      resolve(window.__gonativePlayerId);
      return;
    }

    let resolved = false;
    const done = (id) => {
      if (resolved) return;
      resolved = true;
      if (id) window.__gonativePlayerId = id;
      resolve(id ?? null);
    };

    // Path 2: event fires after register() below
    const onRegistered = (e) => {
      const id = e.detail?.userId || e.detail?.oneSignalUserId || null;
      console.log('[DeviceNotif] Player ID from registered event:', id);
      done(id);
    };
    window.addEventListener('gonative.onesignal.registered', onRegistered, { once: true });

    // Path 3: direct read for already-subscribed users
    if (window.gonative?.onesignal?.onesignalInfo) {
      window.gonative.onesignal.onesignalInfo({
        callback: (info) => {
          if (info?.isSubscribed && info?.oneSignalUserId) {
            console.log('[DeviceNotif] Player ID from onesignalInfo:', info.oneSignalUserId);
            done(info.oneSignalUserId);
          }
        },
      });
    }

    // THE MISSING CALL — this is what shows the "Allow notifications?" dialog
    // on new phones. Without this, no prompt ever appears.
    if (window.gonative?.onesignal?.register) {
      window.gonative.onesignal.register();
    }

    // Safety timeout
    setTimeout(() => {
      if (!resolved) {
        console.warn('[DeviceNotif] Timed out waiting for player ID');
        done(null);
      }
    }, 12_000);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SAVE DEVICE TOKEN TO SUPABASE
// ─────────────────────────────────────────────────────────────────────────────
async function saveDeviceToken({ userId, role, schoolId, classId, studentMatricule, playerId }) {
  if (!playerId || !userId || !schoolId) return;

  const { error } = await supabase
    .from('device_tokens')
    .upsert(
      {
        user_id:           String(userId),
        role:              role,
        school_id:         parseInt(schoolId),
        class_id:          classId ? String(classId) : null,
        student_matricule: studentMatricule ?? null,
        player_id:         playerId,
        updated_at:        new Date().toISOString(),
      },
      { onConflict: 'user_id,school_id' }
    );

  if (error) {
    console.warn('[DeviceNotif] Failed to save device token:', error.message);
  } else {
    console.log('[DeviceNotif] Token saved — user:', userId, '| player:', playerId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WEB PUSH FALLBACK (desktop browser users only)
// ─────────────────────────────────────────────────────────────────────────────
let _swReg = null;

async function getSwRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  if (_swReg) return _swReg;
  try {
    _swReg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return _swReg;
  } catch (err) {
    console.warn('[DeviceNotif] SW registration failed:', err.message);
    return null;
  }
}

async function fireBrowserNotification(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  const options = {
    body: body || '', icon: '/favicon.ico', badge: '/favicon.ico',
    tag: `cc_${Date.now()}`, renotify: true, vibrate: [200, 100, 200],
  };
  const reg = await getSwRegistration();
  if (reg) { try { await reg.showNotification(title, options); return; } catch (_) {} }
  try { const n = new Notification(title, options); setTimeout(() => n.close(), 8000); } catch (_) {}
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

  // ── Registration: runs on every login to keep token fresh ────────────────
  useEffect(() => {
    if (!userId || !schoolId) return;

    if (isMedianApp()) {
      registerAndGetPlayerId().then((playerId) => {
        if (playerId) {
          saveDeviceToken({ userId, role, schoolId, classId, studentMatricule, playerId });
        } else {
          console.warn('[DeviceNotif] No player ID — user may have denied notifications');
        }
      });
    } else {
      // Browser fallback
      getSwRegistration();
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [userId, schoolId]);

  // ── Realtime subscription → in-app toasts ────────────────────────────────
  useEffect(() => {
    if (!schoolId) return;

    const channel = supabase
      .channel(`device_notif_${schoolId}_${role}_${userId || 'guest'}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `school_id=eq.${parseInt(schoolId)}` },
        (payload) => {
          const notif    = payload.new;
          const identity = identityRef.current;
          if (!isRelevant(notif, identity)) return;
          const body = notif.content
            ? notif.content.slice(0, 120) + (notif.content.length > 120 ? '…' : '')
            : '';
          toast({ title: notif.title, description: body, duration: 6000 });
          if (!isMedianApp()) fireBrowserNotification(notif.title, body);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [schoolId, role, userId, classId, studentMatricule]);
}
