/**
 * useDeviceNotifications.js
 * src/hooks/useDeviceNotifications.js
 *
 * Fully self-contained — no changes to index.html required.
 * Polls for the OneSignal player ID with retries so it works even when
 * OneSignal isn't ready yet (fresh install, reinstall, slow device).
 */

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const PLAYER_ID_KEY = 'cc_onesignal_player_id';

// ─────────────────────────────────────────────────────────────────────────────
// RELEVANCE CHECK
// ─────────────────────────────────────────────────────────────────────────────
function isRelevant(notif, { role, userId, classId, studentMatricule }) {
  const type = notif.target_type;
  const tid  = notif.target_id;
  if (type === 'school') return true;
  const matchesId = (tid === null || tid === undefined || tid === 0) || String(tid) === String(userId);
  switch (role) {
    case 'administrator':  return type === 'administrator'    && matchesId;
    case 'vice-principal': return type === 'vice_principal'   && matchesId;
    case 'teacher':        return type === 'teacher'          && matchesId;
    case 'discipline':     return type === 'discipline_master'&& matchesId;
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
// READ PLAYER ID ONCE (single attempt, no side-effects)
// Returns the player ID string if subscribed, or null.
// ─────────────────────────────────────────────────────────────────────────────
function readPlayerIdOnce() {
  return new Promise((resolve) => {
    if (!window.gonative?.onesignal?.onesignalInfo) {
      resolve(null);
      return;
    }
    const timer = setTimeout(() => resolve(null), 3000);
    window.gonative.onesignal.onesignalInfo({
      callback: (info) => {
        clearTimeout(timer);
        const id = info?.oneSignalUserId || info?.userId || null;
        // Only return an ID if the user is actually subscribed
        resolve(info?.isSubscribed && id ? id : null);
      },
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET PLAYER ID WITH POLLING
//
// OneSignal registration takes a few seconds after install.
// This polls every 2 seconds for up to 30 seconds before giving up.
// Also listens for the registered event in case it fires during polling.
// ─────────────────────────────────────────────────────────────────────────────
function getPlayerIdWithRetry(maxWaitMs = 30000) {
  return new Promise((resolve) => {
    // Check localStorage first — if we already have it from a previous session
    const cached = localStorage.getItem(PLAYER_ID_KEY);
    if (cached) {
      console.log('[DeviceNotif] Using cached player ID:', cached);
      // Still re-verify in the background to catch rotated IDs
      readPlayerIdOnce().then((fresh) => {
        if (fresh && fresh !== cached) {
          console.log('[DeviceNotif] Player ID rotated, updating cache:', fresh);
          localStorage.setItem(PLAYER_ID_KEY, fresh);
        }
      });
      resolve(cached);
      return;
    }

    let resolved = false;
    let pollInterval = null;
    let giveUpTimer = null;

    const done = (id) => {
      if (resolved) return;
      resolved = true;
      clearInterval(pollInterval);
      clearTimeout(giveUpTimer);
      if (id) {
        localStorage.setItem(PLAYER_ID_KEY, id);
        console.log('[DeviceNotif] Player ID obtained:', id);
      } else {
        console.warn('[DeviceNotif] Could not obtain player ID after retries');
      }
      resolve(id);
    };

    // Listen for the registration event (fires right after permission granted)
    const onRegistered = (e) => {
      const id = e.detail?.userId || e.detail?.oneSignalUserId || null;
      if (id) {
        console.log('[DeviceNotif] Player ID from registered event:', id);
        done(id);
      }
    };
    window.addEventListener('gonative.onesignal.registered', onRegistered, { once: true });

    // Trigger the permission dialog (shows "Allow notifications?" on new phones)
    if (window.gonative?.onesignal?.register) {
      window.gonative.onesignal.register();
    }

    // Poll every 2 seconds — handles the case where register() was called
    // before but the event already fired and was missed
    pollInterval = setInterval(async () => {
      const id = await readPlayerIdOnce();
      if (id) done(id);
    }, 2000);

    // Give up after maxWaitMs
    giveUpTimer = setTimeout(() => {
      window.removeEventListener('gonative.onesignal.registered', onRegistered);
      done(null);
    }, maxWaitMs);
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
        role,
        school_id:         parseInt(schoolId),
        class_id:          classId ? String(classId) : null,
        student_matricule: studentMatricule ?? null,
        player_id:         playerId,
        updated_at:        new Date().toISOString(),
      },
      { onConflict: 'user_id,school_id' }
    );
  if (error) console.warn('[DeviceNotif] Failed to save token:', error.message);
  else       console.log('[DeviceNotif] Token saved — user:', userId, '| player:', playerId);
}

// ─────────────────────────────────────────────────────────────────────────────
// WEB PUSH FALLBACK (desktop browser only)
// ─────────────────────────────────────────────────────────────────────────────
let _swReg = null;
async function getSwReg() {
  if (!('serviceWorker' in navigator)) return null;
  if (_swReg) return _swReg;
  try { _swReg = await navigator.serviceWorker.register('/sw.js', { scope: '/' }); await navigator.serviceWorker.ready; return _swReg; }
  catch (e) { return null; }
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

  // ── Token registration ────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !schoolId) return;

    if (isMedianApp()) {
      // Clear cached ID on every fresh login so reinstalls always re-register
      // (the upsert means re-saving the same ID is harmless)
      getPlayerIdWithRetry().then((playerId) => {
        if (playerId) saveDeviceToken({ userId, role, schoolId, classId, studentMatricule, playerId });
      });
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
