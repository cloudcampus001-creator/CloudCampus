/**
 * cloud-campus-auth — Supabase Edge Function
 * ------------------------------------------
 * Unified server-side authentication gateway for all CloudCampus roles.
 * Replaces all direct-to-database logins from the client.
 *
 * DEPLOY:
 *   supabase functions deploy cloud-campus-auth
 *
 * REQUIRED SECRETS (set via Supabase Dashboard → Settings → Edge Functions):
 *   supabase secrets set AUTH_SECRET=<a long random string>
 *   (generate one with: openssl rand -base64 48)
 *
 * REQUEST BODY (POST):
 *   { role: 'administrator', name: string, password: string, schoolId: string }
 *   { role: 'teacher',       name: string, id: string,       schoolId: string }
 *   { role: 'discipline',    name: string, dmId: string,     schoolId: string }
 *   { role: 'vice-principal',name: string, vpId: string,     schoolId: string }
 *   { role: 'parent', studentName: string, matricule: string, schoolId: string }
 *
 * RESPONSE (200):
 *   { session: SupabaseSession, userMeta: { role, userId, userName, schoolId, ... } }
 *
 * RESPONSE (401):
 *   { error: 'Invalid credentials' }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL            = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY       = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const AUTH_SECRET             = Deno.env.get('AUTH_SECRET')!;

// Service-role client — bypasses RLS for credential lookup
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
// Anon client — used only for issuing sessions
const anonClient  = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Derive a deterministic synthetic password ────────────────────────────────
// The password is HMAC-SHA256(userId:role:schoolId, AUTH_SECRET).
// It is NEVER stored anywhere — recomputed on every login.
// An attacker would need AUTH_SECRET (a server-side secret) to forge it.
async function deriveSyntheticPassword(
  userId: string,
  role: string,
  schoolId: string,
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(AUTH_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(`${userId}:${role}:${schoolId}`),
  );
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

// ─── Password hashing (PBKDF2 — for administrator passwords) ──────────────────
async function hashPassword(plain: string): Promise<string> {
  const enc  = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key  = await crypto.subtle.importKey('raw', enc.encode(plain), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    key, 256,
  );
  const hash    = btoa(String.fromCharCode(...new Uint8Array(bits)));
  const saltB64 = btoa(String.fromCharCode(...salt));
  return `pbkdf2:${saltB64}:${hash}`;
}

async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!stored) return false;

  // Legacy: plaintext stored in DB (will be rehashed on next successful login)
  if (!stored.startsWith('pbkdf2:')) {
    return plain === stored;
  }

  const [, saltB64, expectedHash] = stored.split(':');
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const enc  = new TextEncoder();
  const key  = await crypto.subtle.importKey('raw', enc.encode(plain), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    key, 256,
  );
  const computed = btoa(String.fromCharCode(...new Uint8Array(bits)));
  return computed === expectedHash;
}

// ─── Get-or-create a Supabase Auth user for this person ───────────────────────
// The synthetic email: role.userId@schoolId.cloudcampus.local
// This email never receives mail — it's purely an internal identifier.
async function getOrCreateAuthUser(
  role: string,
  userId: string,
  schoolId: string,
  userMeta: Record<string, unknown>,
): Promise<string> {
  const syntheticEmail = `${role}.${userId}@${schoolId}.cloudcampus.local`;
  const syntheticPwd   = await deriveSyntheticPassword(userId, role, schoolId);

  // Check if Auth user already exists
  const { data: { users } } = await adminClient.auth.admin.listUsers();
  const existing = users.find((u) => u.email === syntheticEmail);

  if (existing) {
    // Update metadata to keep it fresh (e.g., after a name change)
    await adminClient.auth.admin.updateUserById(existing.id, {
      user_metadata: userMeta,
    });
    return syntheticEmail;
  }

  // Create new Auth user — email_confirm: true skips the confirmation email
  const { error } = await adminClient.auth.admin.createUser({
    email:          syntheticEmail,
    password:       syntheticPwd,
    email_confirm:  true,
    user_metadata:  userMeta,
  });

  if (error) throw new Error(`Failed to create auth user: ${error.message}`);
  return syntheticEmail;
}

// ─── Issue a real Supabase JWT session ────────────────────────────────────────
async function issueSession(
  role: string,
  userId: string,
  schoolId: string,
  userMeta: Record<string, unknown>,
) {
  const email = await getOrCreateAuthUser(role, userId, schoolId, userMeta);
  const pwd   = await deriveSyntheticPassword(userId, role, schoolId);

  const { data, error } = await anonClient.auth.signInWithPassword({
    email,
    password: pwd,
  });

  if (error || !data.session) {
    throw new Error(`Session issuance failed: ${error?.message}`);
  }

  return data.session;
}

// ─── Role handlers ────────────────────────────────────────────────────────────

async function loginAdministrator(body: Record<string, string>) {
  const { name, password, schoolId } = body;
  if (!name || !password || !schoolId) throw { status: 400, message: 'Missing fields' };

  // Fetch only the columns we need — never expose password_hash via response
  const { data: admin, error } = await adminClient
    .from('administrators')
    .select('id, name, school_id, password_hash')
    .eq('name', name)
    .eq('school_id', parseInt(schoolId))
    .single();

  if (error || !admin) throw { status: 401, message: 'Invalid credentials' };

  const valid = await verifyPassword(password, admin.password_hash);
  if (!valid) throw { status: 401, message: 'Invalid credentials' };

  // Transparently migrate plaintext → PBKDF2 on first successful login
  if (!admin.password_hash.startsWith('pbkdf2:')) {
    const hashed = await hashPassword(password);
    await adminClient
      .from('administrators')
      .update({ password_hash: hashed })
      .eq('id', admin.id);
  }

  const userMeta = {
    role:     'administrator',
    userId:   String(admin.id),
    userName: admin.name,
    schoolId: String(schoolId),
  };

  const session = await issueSession('administrator', String(admin.id), schoolId, userMeta);
  return { session, userMeta };
}

async function loginTeacher(body: Record<string, string>) {
  const { name, id, schoolId } = body;
  if (!name || !id || !schoolId) throw { status: 400, message: 'Missing fields' };

  const { data: teacher, error } = await adminClient
    .from('teachers')
    .select('id, name, school_id, subjects, classes_teaching')
    .ilike('name', name)
    .eq('id', parseInt(id))
    .eq('school_id', parseInt(schoolId))
    .single();

  if (error || !teacher) throw { status: 401, message: 'Invalid credentials' };

  const userMeta = {
    role:             'teacher',
    userId:           String(teacher.id),
    userName:         teacher.name,
    schoolId:         String(schoolId),
    subjects:         teacher.subjects || [],
    classesTeaching:  teacher.classes_teaching || [],
  };

  const session = await issueSession('teacher', String(teacher.id), schoolId, userMeta);
  return { session, userMeta };
}

async function loginDiscipline(body: Record<string, string>) {
  const { name, dmId, schoolId } = body;
  if (!name || !dmId || !schoolId) throw { status: 400, message: 'Missing fields' };

  const { data: dm, error } = await adminClient
    .from('discipline_masters')
    .select('id, name, school_id')
    .eq('id', parseInt(dmId))
    .ilike('name', name)
    .eq('school_id', parseInt(schoolId))
    .single();

  if (error || !dm) throw { status: 401, message: 'Invalid credentials' };

  const userMeta = {
    role:     'discipline',
    userId:   String(dm.id),
    userName: dm.name,
    schoolId: String(schoolId),
  };

  const session = await issueSession('discipline', String(dm.id), schoolId, userMeta);
  return { session, userMeta };
}

async function loginVicePrincipal(body: Record<string, string>) {
  const { name, vpId, schoolId } = body;
  if (!name || !vpId || !schoolId) throw { status: 400, message: 'Missing fields' };

  const { data: vp, error } = await adminClient
    .from('vice_principals')
    .select('id, name, school_id, classes_managing')
    .eq('id', parseInt(vpId))
    .ilike('name', name)
    .eq('school_id', parseInt(schoolId))
    .single();

  if (error || !vp) throw { status: 401, message: 'Invalid credentials' };

  const userMeta = {
    role:            'vice-principal',
    userId:          String(vp.id),
    userName:        vp.name,
    schoolId:        String(schoolId),
    classesManaging: vp.classes_managing || [],
  };

  const session = await issueSession('vice-principal', String(vp.id), schoolId, userMeta);
  return { session, userMeta };
}

async function loginParent(body: Record<string, string>) {
  const { studentName, matricule, schoolId } = body;
  if (!studentName || !matricule || !schoolId) throw { status: 400, message: 'Missing fields' };

  const { data: student, error } = await adminClient
    .from('students')
    .select('name, matricule, school_id, class_id')
    .ilike('name', studentName)
    .eq('matricule', matricule)
    .eq('school_id', parseInt(schoolId))
    .single();

  if (error || !student) throw { status: 401, message: 'Invalid student details' };

  // Parents use matricule as their userId (it's unique per student)
  const userMeta = {
    role:             'parent',
    userId:           student.matricule,
    userName:         `Parent of ${student.name}`,
    schoolId:         String(schoolId),
    classId:          String(student.class_id || ''),
    studentName:      student.name,
    studentMatricule: student.matricule,
  };

  const session = await issueSession('parent', student.matricule, schoolId, userMeta);
  return { session, userMeta };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { role } = body;

    let result: { session: unknown; userMeta: unknown };

    switch (role) {
      case 'administrator':  result = await loginAdministrator(body);  break;
      case 'teacher':        result = await loginTeacher(body);        break;
      case 'discipline':     result = await loginDiscipline(body);     break;
      case 'vice-principal': result = await loginVicePrincipal(body);  break;
      case 'parent':         result = await loginParent(body);         break;
      default:
        return new Response(JSON.stringify({ error: 'Unknown role' }), {
          status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    const status  = e.status  || 500;
    const message = e.message || 'Internal server error';

    // Don't leak internal errors to the client
    const clientMessage = status === 401 ? message : 'An error occurred. Please try again.';

    return new Response(JSON.stringify({ error: clientMessage }), {
      status, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
