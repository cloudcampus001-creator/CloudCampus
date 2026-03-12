/**
 * useDeviceNotifications.js
 * src/hooks/useDeviceNotifications.js
 *
 * What this does:
 *  1. On mount, detects whether the app is running inside the median.co
 *     Android/iOS wrapper (window.gonative exists).
 *  2. If yes → asks OneSignal (via the median.co bridge) for the device's
 *     player ID and saves it to the `device_tokens` table in Supabase.
 *     The Supabase Edge Function will use these IDs to deliver real pushes.
 *  3. If no (plain browser) → falls back to the existing Web Push / Service
 *     Worker path so desktop users still get browser notifications.
 *  4. Subscribes to Supabase Realtime for in-app toast notifications
 *     (these work regardless of push permission — they're in-app banners).
 */

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

// ─────────────────────────────────────────────────────────────────────────────
// RELEVANCE CHECK  (unchanged from previous version)
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
// window.gonative is injected by the median.co native shell
// ─────────────────────────────────────────────────────────────────────────────
function isMedianApp() {
  return typeof window !== 'undefined' && !!window.gonative;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET ONESIGNAL PLAYER ID FROM MEDIAN.CO BRIDGE
//
// median.co exposes OneSignal through window.gonative.onesignal
// We call getPlayerTags / getIds to get the subscription id.
// This resolves once the native bridge fires the callback.
// ─────────────────────────────────────────────────────────────────────────────
function getOneSignalPlayerId() {
  return new Promise((resolve) => {
    try {
      // median.co OneSignal bridge — available when OneSignal plugin is enabled
      if (window.gonative?.onesignal?.onesignalInfo) {
        window.gonative.onesignal.onesignalInfo({
          callback: (info) => {
            // info = { oneSignalUserId: "...", pushToken: "...", isSubscribed: true, ... }
            resolve(info?.oneSignalUserId ?? null);
          },
        });
      } else {
        // The bridge might not be ready yet — wait for the native event
        window.addEventListener(
          'gonative.onesignal.registered',
          (e) => resolve(e.detail?.userId ?? null),
          { once: true }
        );
        // Timeout after 10 seconds if the event never fires
        setTimeout(() => resolve(null), 10_000);
      }
    } catch (err) {
      console.warn('[DeviceNotif] Could not get OneSignal player ID:', err);
      resolve(null);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SAVE DEVICE TOKEN TO SUPABASE
// Upserts so re-installs or token rotations are handled automatically.
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
    console.log('[DeviceNotif] Device token registered for user:', userId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WEB PUSH FALLBACK (for browser users, unchanged from previous version)
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
    console.warn('[DeviceNotif] Service worker registration failed:', err.message);
    return null;
  }
}

async function fireBrowserNotification(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const options = {
    body:     body || '',
    icon:     '/favicon.ico',
    badge:    '/favicon.ico',
    tag:      `cloudcampus_${Date.now()}`,
    renotify: true,
    vibrate:  [200, 100, 200],
  };

  const reg = await getSwRegistration();
  if (reg) {
    try { await reg.showNotification(title, options); return; }
    catch (err) { console.warn('[DeviceNotif] showNotification failed:', err.message); }
  }

  try {
    const n = new Notification(title, options);
    setTimeout(() => n.close(), 8000);
  } catch (_) {}
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

  // ── OneSignal registration (median.co) OR Web Push (browser) ─────────────
  useEffect(() => {
    if (!userId || !schoolId) return;

    if (isMedianApp()) {
      // ── MEDIAN.CO PATH ──────────────────────────────────────────────────
      // The median.co shell handles requesting push permission natively.
      // We just need to grab the player ID and store it.
      getOneSignalPlayerId().then((playerId) => {
        if (playerId) {
          saveDeviceToken({ userId, role, schoolId, classId, studentMatricule, playerId });
        } else {
          console.warn('[DeviceNotif] No OneSignal player ID — push permission may be denied.');
        }
      });
    } else {
      // ── BROWSER FALLBACK PATH ───────────────────────────────────────────
      getSwRegistration();
      if (!('Notification' in window)) return;
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((p) => {
          if (p === 'granted') console.log('[DeviceNotif] Browser notification permission granted.');
        });
      }
    }
  }, [userId, schoolId]);

  // ── Supabase Realtime → in-app toasts (works for all users) ──────────────
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

          // In-app toast (always works, even without push permission)
          toast({ title: notif.title, description: body, duration: 6000 });

          // Browser notification (non-median.co users only)
          // median.co users receive the push natively via OneSignal — no need to
          // double-fire here, as the edge function already sent the device push
          if (!isMedianApp()) {
            fireBrowserNotification(notif.title, body);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [schoolId, role, userId, classId, studentMatricule]);
}
