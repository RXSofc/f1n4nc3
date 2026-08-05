const Auth = (() => {
  const SESSION_KEY = 'finance_session';
  const SESSION_TTL_MS = 15 * 60 * 60 * 1000; // 15 Jam

  function setSession(user) {
    const now = Date.now();
    const session = {
      username: user.username,
      loggedInAt: new Date(now).toISOString(),
      expiresAt: now + SESSION_TTL_MS
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }


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

  
  function isLoggedIn() {
    return !!getSession();
  }

  
  function logout() {
    localStorage.removeItem(SESSION_KEY);
  }

  function requireAuth() {
    if (!isLoggedIn()) {
      window.location.href = 'index.html';
    }
  }

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
