/**
 * sessionPersistence.js
 * ---------------------
 * CloudCampus — UI Session Mirror
 *
 * SECURITY NOTE (updated):
 * The source of truth for authentication is now the Supabase JWT,
 * set via supabase.auth.setSession() in each login page.
 * ProtectedRoute validates the JWT — NOT localStorage.
 *
 * This file's only remaining job is to mirror session data
 * (role, schoolId, userName etc.) into the individual localStorage
 * keys that existing dashboard pages read with getItem().
 * It is no longer used for access control decisions.
 *
 * The 5-day inactivity feature has been removed — Supabase manages
 * token expiry with automatic refresh tokens.
 */

const SESSION_KEY  = 'cc_session';

// ─── Core API ─────────────────────────────────────────────────────────────────

/**
 * Mirror session data to localStorage after a successful login.
 * Called alongside supabase.auth.setSession() — never instead of it.
 *
 * @param {{ userRole, userId, userName, schoolId, classId?, studentName?, studentMatricule? }} data
 */
export function saveSession(data) {
  const session = {
    userRole:         data.userRole         || '',
    userId:           data.userId           ?? '',
    userName:         data.userName         || '',
    schoolId:         data.schoolId         ?? '',
    classId:          data.classId          ?? '',
    studentName:      data.studentName      || '',
    studentMatricule: data.studentMatricule || '',
    savedAt:          Date.now(),
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  _mirrorToLegacyKeys(session);
}

/**
 * Read the mirrored session (for UI use only — not for auth decisions).
 * @returns {object|null}
 */
export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Destroy all session data.
 * Always call alongside supabase.auth.signOut().
 */
export function clearSession(reason = 'logout') {
  if (import.meta.env.DEV) {
    console.log(`[CloudCampus] Session cleared — reason: ${reason}`);
  }

  localStorage.removeItem(SESSION_KEY);

  const legacyKeys = [
    'userRole', 'userId', 'userName', 'schoolId',
    'classId', 'studentName', 'studentMatricule',
    // Legacy activity key from old sessionPersistence
    'cc_last_activity',
  ];
  legacyKeys.forEach((k) => localStorage.removeItem(k));
}

/**
 * Returns true if there is any session data in localStorage.
 * NOTE: This is NOT an auth check — use supabase.auth.getSession() for that.
 */
export function isSessionAlive() {
  return getSession() !== null;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _mirrorToLegacyKeys(session) {
  const map = {
    userRole:         session.userRole,
    userId:           session.userId,
    userName:         session.userName,
    schoolId:         session.schoolId,
    classId:          session.classId,
    studentName:      session.studentName,
    studentMatricule: session.studentMatricule,
  };

  Object.entries(map).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      localStorage.setItem(key, String(value));
    }
  });
}


/**
 * touchActivity — kept for App.jsx compatibility.
 * No longer writes to localStorage (Supabase handles token refresh).
 */
export function touchActivity() {
  // No-op: session expiry is now managed by Supabase JWT refresh tokens.
  // This export is kept so App.jsx doesn't need to change.
}
