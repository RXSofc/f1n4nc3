/**
 * auth.js — Session management with localStorage
 */

const Auth = (() => {
  const SESSION_KEY = 'finance_session';
  const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

  /** Save user session after successful login */
  function setSession(user) {
    const now = Date.now();
    const session = {
      username: user.username,
      loggedInAt: new Date(now).toISOString(),
      expiresAt: now + SESSION_TTL_MS
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  /** Get current session (or null if missing/expired) */
  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (session.expiresAt && Date.now() > session.expiresAt) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  /** Check if user is logged in */
  function isLoggedIn() {
    return !!getSession();
  }

  /** Clear session (logout) */
  function logout() {
    localStorage.removeItem(SESSION_KEY);
  }

  /** Redirect to login if not authenticated (call on every protected page) */
  function requireAuth() {
    if (!isLoggedIn()) {
      window.location.href = 'index.html';
    }
  }

  /** Redirect to dashboard if already logged in (call on login page) */
  function redirectIfLoggedIn() {
    if (isLoggedIn()) {
      window.location.href = 'dashboard.html';
    }
  }

  return {
    setSession,
    getSession,
    isLoggedIn,
    logout,
    requireAuth,
    redirectIfLoggedIn
  };
})();
