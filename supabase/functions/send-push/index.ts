/**
 * send-push — Supabase Edge Function
 * ────────────────────────────────────────────────────────────────────────────
 * Triggered by a Supabase Database Webhook on:
 *   Table : public.notifications
 *   Event : INSERT
 *
 * What it does:
 *  1. Reads the new notification row from the webhook payload
 *  2. Builds OneSignal filters that mirror the isRelevant() logic in
 *     useDeviceNotifications.js — so only the right devices get the push
 *  3. POSTs to the OneSignal REST API → device gets a native push notification
 *     (like WhatsApp) even when the app is closed / in background
 *
 * DEPLOY:
 *   supabase functions deploy send-push
 *
 * REQUIRED SECRETS (Supabase Dashboard → Settings → Edge Functions → Secrets):
 *   ONESIGNAL_APP_ID       — your OneSignal App ID  (Median dashboard → Push → OneSignal)
 *   ONESIGNAL_REST_API_KEY — OneSignal REST API Key  (OneSignal → Settings → Keys & IDs)
 *
 * WEBHOOK SETUP (Supabase Dashboard → Database → Webhooks → Create):
 *   Name   : notify_push
 *   Table  : public.notifications
 *   Events : INSERT
 *   URL    : https://<project-ref>.supabase.co/functions/v1/send-push
 *   Headers: { "Authorization": "Bearer <SUPABASE_ANON_KEY>" }
 * ────────────────────────────────────────────────────────────────────────────
 */

const ONESIGNAL_APP_ID       = Deno.env.get('ONESIGNAL_APP_ID')!;
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── OneSignal filter builder ─────────────────────────────────────────────────
/**
 * Mirrors the isRelevant() function from useDeviceNotifications.js.
 * Returns an array of OneSignal filters so only the matching devices receive
 * the native push.
 *
 * OneSignal tag keys must match what registerAndTag() sets:
 *   school_id, role, user_id, class_id, student_matricule
 */
function buildFilters(notif: {
  school_id: number | string;
  target_type: string;
  target_id:   string | number | null;
}): object[] {
  const schoolTag = {
    field: 'tag', key: 'school_id', relation: '=', value: String(notif.school_id),
  };

  // Helper — AND join
  const AND = { operator: 'AND' };

  switch (notif.target_type) {

    // ── Whole school ──────────────────────────────────────────────────────────
    case 'school':
      // All devices tagged with this school_id
      return [schoolTag];

    // ── Administrator ─────────────────────────────────────────────────────────
    case 'administrator': {
      const filters: object[] = [schoolTag, AND, { field: 'tag', key: 'role', relation: '=', value: 'administrator' }];
      if (notif.target_id) {
        filters.push(AND, { field: 'tag', key: 'user_id', relation: '=', value: String(notif.target_id) });
      }
      return filters;
    }

    // ── Vice Principal ────────────────────────────────────────────────────────
    case 'vice_principal': {
      const filters: object[] = [schoolTag, AND, { field: 'tag', key: 'role', relation: '=', value: 'vice-principal' }];
      if (notif.target_id) {
        filters.push(AND, { field: 'tag', key: 'user_id', relation: '=', value: String(notif.target_id) });
      }
      return filters;
    }

    // ── Teacher ───────────────────────────────────────────────────────────────
    case 'teacher': {
      const filters: object[] = [schoolTag, AND, { field: 'tag', key: 'role', relation: '=', value: 'teacher' }];
      if (notif.target_id) {
        filters.push(AND, { field: 'tag', key: 'user_id', relation: '=', value: String(notif.target_id) });
      }
      return filters;
    }

    // ── Discipline Master ─────────────────────────────────────────────────────
    case 'discipline_master': {
      const filters: object[] = [schoolTag, AND, { field: 'tag', key: 'role', relation: '=', value: 'discipline' }];
      if (notif.target_id) {
        filters.push(AND, { field: 'tag', key: 'user_id', relation: '=', value: String(notif.target_id) });
      }
      return filters;
    }

    // ── Class (broadcast to all parents of that class) ────────────────────────
    case 'class':
      return [
        schoolTag, AND,
        { field: 'tag', key: 'role',     relation: '=', value: 'parent' }, AND,
        { field: 'tag', key: 'class_id', relation: '=', value: String(notif.target_id) },
      ];

    // ── Individual parent (by student matricule) ──────────────────────────────
    case 'parent':
      return [
        schoolTag, AND,
        { field: 'tag', key: 'role',               relation: '=', value: 'parent' }, AND,
        { field: 'tag', key: 'student_matricule',  relation: '=', value: String(notif.target_id) },
      ];

    // ── Fallback: target the whole school ─────────────────────────────────────
    default:
      return [schoolTag];
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    // ── Parse Supabase webhook payload ──
    const payload = await req.json();

    // Supabase webhooks wrap the row in payload.record
    const notif = payload?.record ?? payload;

    if (!notif || !notif.school_id) {
      return new Response(JSON.stringify({ skipped: 'no record' }), {
        status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ── Build notification title & body ──
    const title = notif.title   || 'CloudCampus';
    const body  = notif.content
      ? (notif.content.length > 160 ? notif.content.slice(0, 157) + '…' : notif.content)
      : 'You have a new notification';

    // ── Build filters ──
    const filters = buildFilters(notif);

    // ── Build deep-link URL (opens the right dashboard page) ──
    // Notifications pages per role:
    const roleUrls: Record<string, string> = {
      administrator:    '/dashboard/administrator',
      vice_principal:   '/dashboard/vice-principal',
      teacher:          '/dashboard/teacher',
      discipline_master:'/dashboard/discipline',
      class:            '/dashboard/parent/notifications',
      parent:           '/dashboard/parent/notifications',
      school:           '/',
    };
    const targetUrl = roleUrls[notif.target_type] || '/';

    // ── POST to OneSignal REST API ──
    const osPayload = {
      app_id:            ONESIGNAL_APP_ID,
      filters,
      headings:          { en: title },
      contents:          { en: body },
      // Deep link — opens the app and navigates to the right screen
      url:               `https://cloudcampus237.com${targetUrl}`,
      // Android channel (create "cloudcampus_default" in OneSignal dashboard)
      android_channel_id: 'cloudcampus_default',
      // iOS badge increment
      ios_badgeType:     'Increase',
      ios_badgeCount:    1,
      // Priority
      priority:          10,
      // Collapse duplicate notifications of same type
      collapse_id:       `cc_${notif.target_type}_${notif.target_id ?? 'school'}_${notif.school_id}`,
      // Small icon (Android) — must be in your app's res/drawable
      small_icon:        'ic_stat_onesignal_default',
      // Vibrate pattern
      android_vibrate:   true,
    };

    console.log('[send-push] Sending to OneSignal:', JSON.stringify({
      target_type: notif.target_type,
      target_id:   notif.target_id,
      school_id:   notif.school_id,
      title,
    }));

    const osRes = await fetch('https://onesignal.com/api/v1/notifications', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(osPayload),
    });

    const osData = await osRes.json();

    if (!osRes.ok) {
      console.error('[send-push] OneSignal error:', JSON.stringify(osData));
      return new Response(JSON.stringify({ error: 'OneSignal rejected the request', details: osData }), {
        status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    console.log('[send-push] OneSignal response:', JSON.stringify(osData));

    return new Response(JSON.stringify({ success: true, recipients: osData.recipients ?? 0 }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    const e = err as Error;
    console.error('[send-push] Unexpected error:', e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
