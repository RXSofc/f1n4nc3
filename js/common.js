/**
 * common.js — Shared chrome logic for every authenticated page:
 * auth guard, active bottom-nav highlighting, toast + loading overlay helpers,
 * and logout wiring. Include after auth.js and before the page-specific script.
 */

const Common = (() => {
  function init() {
    Auth.requireAuth();
    highlightActiveNav();
    bindLogout();
  }

  function highlightActiveNav() {
    const current = location.pathname.split('/').pop() || 'dashboard.html';
    document.querySelectorAll('.nav-item[data-page]').forEach((el) => {
      el.classList.toggle('active', el.dataset.page === current);
    });
  }

  function bindLogout() {
    document.getElementById('btn-logout')?.addEventListener('click', () => {
      Auth.logout();
      window.location.href = 'index.html';
    });
  }

  function showToast(msg, type = '') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = 'toast show' + (type ? ` ${type}` : '');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function showLoading(show) {
    document.getElementById('loading')?.classList.toggle('show', show);
  }

  return { init, showToast, showLoading, highlightActiveNav };
})();
