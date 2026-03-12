/**
 * send-push-notification — Supabase Edge Function
 * ─────────────────────────────────────────────────────────────────────────────
 * Triggered by a Supabase Database Webhook every time a row is INSERTed into
 * the `notifications` table.
 *
 * It resolves which devices should receive the push, then calls the
 * OneSignal REST API to deliver a real native Android / iOS notification.
 *
 * Environment variables required (set in Supabase Dashboard → Edge Functions → Secrets):
 *   ONESIGNAL_APP_ID      – your OneSignal App ID
 *   ONESIGNAL_REST_API_KEY – your OneSignal REST API Key
 *   SUPABASE_URL           – your project URL (auto-set by Supabase)
 *   SUPABASE_SERVICE_ROLE_KEY – service-role key (auto-set by Supabase)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationRow {
  id: number;
  school_id: number;
  title: string;
  content: string;
  target_type: string;   // 'school' | 'administrator' | 'vice_principal' | 'teacher' | 'discipline_master' | 'class' | 'parent'
  target_id: number | null;
  audience_type: string | null; // 'parent' | 'student' | null
  student_matricule: string | null;
  sender_name: string;
}

interface DeviceToken {
  player_id: string;
  role: string;
  user_id: string;
  class_id: string | null;
  student_matricule: string | null;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  try {
    // Supabase Webhook sends a POST with the record in `record` field
    const body = await req.json();
    const notif: NotificationRow = body.record ?? body;

    if (!notif?.id || !notif?.school_id) {
      return new Response('No notification data', { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── Resolve target player IDs ──────────────────────────────────────────
    const playerIds = await resolvePlayerIds(supabase, notif);

    if (playerIds.length === 0) {
      console.log(`[Push] No devices found for notif ${notif.id}`);
      return new Response('No target devices', { status: 200 });
    }

    // ── Send via OneSignal ─────────────────────────────────────────────────
    const body_text = notif.content?.slice(0, 200) ?? '';

    const onesignalPayload = {
      app_id:             Deno.env.get('ONESIGNAL_APP_ID'),
      include_player_ids: playerIds,
      headings:           { en: notif.title },
      contents:           { en: body_text },
      // Opens the app when tapped — median.co will handle the deep link
      url:                'https://cloudcampus237.com',
      // Android styling
      android_accent_color: '6366F1',
      small_icon:           'ic_stat_onesignal_default',
      // Collapse key: latest notification per school replaces stale ones of the same type
      collapse_id:          `cloudcampus_${notif.school_id}_${notif.target_type}`,
      // Data payload the app can read when opened
      data: {
        notif_id:    notif.id,
        school_id:   notif.school_id,
        target_type: notif.target_type,
      },
    };

    const osResponse = await fetch('https://onesignal.com/api/v1/notifications', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Basic ${Deno.env.get('ONESIGNAL_REST_API_KEY')}`,
      },
      body: JSON.stringify(onesignalPayload),
    });

    const osResult = await osResponse.json();

    if (!osResponse.ok) {
      console.error('[Push] OneSignal error:', osResult);
      return new Response(JSON.stringify(osResult), { status: 502 });
    }

    console.log(`[Push] Sent to ${playerIds.length} devices. OneSignal id: ${osResult.id}`);
    return new Response(JSON.stringify({ ok: true, recipients: playerIds.length, onesignal: osResult.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[Push] Unhandled error:', err);
    return new Response(String(err), { status: 500 });
  }
});

// ─── Resolver — maps notification target_type → player_ids ───────────────────

async function resolvePlayerIds(
  supabase: ReturnType<typeof createClient>,
  notif: NotificationRow,
): Promise<string[]> {

  const { school_id, target_type, target_id, audience_type, student_matricule } = notif;

  let query = supabase
    .from('device_tokens')
    .select('player_id, role, user_id, class_id, student_matricule')
    .eq('school_id', school_id);

  switch (target_type) {

    // ── School-wide: every device in this school ───────────────────────────
    case 'school':
      // no extra filter needed
      break;

    // ── Role broadcasts ────────────────────────────────────────────────────
    case 'administrator':
      query = query.eq('role', 'administrator');
      break;

    case 'vice_principal':
      query = query.eq('role', 'vice-principal');
      if (target_id) query = query.eq('user_id', String(target_id));
      break;

    case 'discipline_master':
      query = query.eq('role', 'discipline');
      if (target_id) query = query.eq('user_id', String(target_id));
      break;

    case 'teacher':
      query = query.eq('role', 'teacher');
      if (target_id) query = query.eq('user_id', String(target_id));
      break;

    // ── Class-level (parents of a specific class) ──────────────────────────
    case 'class': {
      if (audience_type === 'student' && student_matricule) {
        // Specific student's parent
        query = query
          .eq('role', 'parent')
          .eq('student_matricule', student_matricule);
      } else if (audience_type === 'parent' && target_id) {
        // All parents whose child is in this class
        query = query
          .eq('role', 'parent')
          .eq('class_id', String(target_id));
      } else {
        // Fallback: all parents in school
        query = query.eq('role', 'parent');
      }
      break;
    }

    // ── Direct parent notification (by student matricule) ─────────────────
    case 'parent':
      query = query
        .eq('role', 'parent')
        .eq('student_matricule', String(target_id));
      break;

    default:
      console.warn(`[Push] Unknown target_type: ${target_type}`);
      return [];
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Push] DB query error:', error.message);
    return [];
  }

  return (data as DeviceToken[]).map((t) => t.player_id).filter(Boolean);
}
