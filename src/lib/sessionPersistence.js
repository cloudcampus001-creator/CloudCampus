/**
 * sessionPersistence.js
 * ---------------------
 * CloudCampus — Persistent Session Manager
 *
 * Keeps users logged in for up to 5 days of INACTIVITY.
 * The timer resets every time the user does anything in the app.
 * If they haven't opened the app for 5 full days, they are
 * automatically signed out next time the app loads.
 *
 * Works perfectly in APK/WebView environments (median.co) because
 * it uses localStorage which WebViews persist between app launches.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_KEY        = 'cc_session';       // main session blob
const ACTIVITY_KEY       = 'cc_last_activity'; // last-activity timestamp (ms)
const INACTIVITY_LIMIT   = 5 * 24 * 60 * 60 * 1000; // 5 days in milliseconds

// ─── Types (JSDoc) ────────────────────────────────────────────────────────────
/**
 * @typedef {Object} CCSession
 * @property {string} userRole       - 'parent' | 'teacher' | 'discipline' | 'vice-principal' | 'administrator'
 * @property {string|number} userId  - DB row id
 * @property {string} userName       - Display name
 * @property {string|number} schoolId
 * @property {string|number} [classId]
 * @property {string} [studentName]  - For parent sessions
 * @property {number} loginTime      - Unix ms when the session was created
 * @property {number} lastActivity   - Unix ms of the most recent activity
 */

// ─── Core API ─────────────────────────────────────────────────────────────────

/**
 * Save a new session after a successful login.
 * Call this instead of individual localStorage.setItem() calls.
 *
 * @param {Omit<CCSession, 'loginTime' | 'lastActivity'>} data
 */
export function saveSession(data) {
  const now = Date.now();

  /** @type {CCSession} */
  const session = {
    userRole:    data.userRole    || '',
    userId:      data.userId      ?? '',
    userName:    data.userName    || '',
    schoolId:    data.schoolId    ?? '',
    classId:     data.classId     ?? '',
    studentName: data.studentName || '',
    loginTime:   now,
    lastActivity: now,
  };

  // Write the structured session blob
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));

  // Mirror individual keys that the rest of the app reads directly
  // This keeps every existing page working without changes
  _mirrorToLegacyKeys(session);
}

/**
 * Read and validate the current session.
 * Returns null if there is no session OR the inactivity limit has been exceeded.
 *
 * @returns {CCSession|null}
 */
export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    /** @type {CCSession} */
    const session = JSON.parse(raw);

    // ── Inactivity check ──────────────────────────────────────────────────────
    const lastActivity = session.lastActivity || session.loginTime || 0;
    const elapsed      = Date.now() - lastActivity;

    if (elapsed > INACTIVITY_LIMIT) {
      // Session has expired due to inactivity — clear everything
      clearSession('inactivity');
      return null;
    }

    return session;
  } catch {
    clearSession('parse_error');
    return null;
  }
}

/**
 * Record activity right now.
 * Call this on any significant user interaction (click, keydown, etc.).
 * Debounced internally so it only writes to storage at most once per minute.
 */
let _lastWrite = 0;
export function touchActivity() {
  const now = Date.now();

  // Throttle: only write to localStorage once per 60 seconds
  if (now - _lastWrite < 60_000) return;
  _lastWrite = now;

  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;

    const session = JSON.parse(raw);
    session.lastActivity = now;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Silently ignore — non-critical
  }
}

/**
 * Destroy the session (logout or expiry).
 * @param {'logout'|'inactivity'|'parse_error'} [reason]
 */
export function clearSession(reason = 'logout') {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[CloudCampus] Session cleared — reason: ${reason}`);
  }

  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(ACTIVITY_KEY);

  // Clear all legacy keys so old code doesn't see stale data
  const legacyKeys = [
    'userRole', 'userId', 'userName', 'schoolId',
    'classId', 'studentName',
  ];
  legacyKeys.forEach(k => localStorage.removeItem(k));
}

/**
 * Returns true if a valid (non-expired) session exists.
 */
export function isSessionAlive() {
  return getSession() !== null;
}

/**
 * How many milliseconds remain before the session expires due to inactivity.
 * Returns 0 if there is no active session.
 */
export function sessionTimeRemaining() {
  const session = getSession();
  if (!session) return 0;
  const elapsed = Date.now() - session.lastActivity;
  return Math.max(0, INACTIVITY_LIMIT - elapsed);
}

/**
 * Human-readable time remaining (e.g. "4d 12h").
 */
export function sessionTimeRemainingHuman() {
  const ms = sessionTimeRemaining();
  if (!ms) return 'Expired';

  const days    = Math.floor(ms / 86_400_000);
  const hours   = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);

  if (days > 0)   return `${days}d ${hours}h`;
  if (hours > 0)  return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Mirror session fields into the individual localStorage keys that
 * existing pages read directly (e.g. localStorage.getItem('userRole')).
 * This ensures 100% backward compatibility.
 * @param {CCSession} session
 */
function _mirrorToLegacyKeys(session) {
  const map = {
    userRole:    session.userRole,
    userId:      session.userId,
    userName:    session.userName,
    schoolId:    session.schoolId,
    classId:     session.classId,
    studentName: session.studentName,
  };

  Object.entries(map).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      localStorage.setItem(key, String(value));
    }
  });
}
