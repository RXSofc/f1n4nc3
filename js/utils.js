/**
 * utils.js — Pure, DOM-free helper functions.
 * Kept dependency-free so they can run identically in the browser
 * (as `window.Utils`) and under Node for the test suite (as CommonJS exports).
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = mod; // Node / tests
  }
  if (root) {
    root.Utils = mod; // Browser
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /** Format a number as Indonesian Rupiah, e.g. 15000 -> "Rp 15.000" */
  function formatCurrency(num) {
    const n = Number(num) || 0;
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(n);
  }

  /** Format an ISO-ish date string into a readable Indonesian date, e.g. "2 Agu 2026" */
  function formatDate(str) {
    if (!str) return '';
    const d = new Date(str);
    if (isNaN(d)) return String(str);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /** Return today's date as YYYY-MM-DD in local time (not UTC — avoids the classic off-by-one-day bug) */
  function todayISO() {
    return toISODate(new Date());
  }

  /** Convert a Date object to a local YYYY-MM-DD string (no UTC shift) */
  function toISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** Number of days in a given YYYY-MM month string, e.g. "2026-02" -> 28 */
  function daysInMonth(yyyyMm) {
    const [y, m] = yyyyMm.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }

  /** Escape a string for safe HTML text-node insertion */
  function escapeHTML(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }

  /** Debounce: delay calling fn until `wait` ms of silence */
  function debounce(fn, wait = 250) {
    let t = null;
    return function debounced(...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  /** Read a File/Blob as a base64 data URL (browser-only, returns a Promise) */
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /** Generate a short, non-cryptographic unique-ish ID for optimistic UI keys */
  function tempId() {
    return 'tmp_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  /** Get initials for an avatar, e.g. "Budi Santoso" -> "BS" */
  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /** Clamp a number between min and max */
  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  /** Check a PIN is exactly `length` digits (default 6). Format-only check — the real
   *  authorization check always happens server-side, this just gates the submit button. */
  function isValidPinFormat(pin, length = 6) {
    return new RegExp(`^\\d{${length}}$`).test(String(pin ?? ''));
  }

  /**
   * Animate a number counting up (or down) inside `el`, formatted through `formatFn`
   * on every frame. Pure rAF + text updates — no layout thrashing, cheap even on
   * low-end devices. Safe to call repeatedly; each call cancels the previous run.
   */
  function animateNumber(el, endValue, { duration = 700, formatFn = String, startValue = 0 } = {}) {
    if (!el) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = formatFn(endValue);
      return;
    }

    cancelAnimationFrame(el._countRaf);
    const from = Number(startValue) || 0;
    const to = Number(endValue) || 0;
    const startTime = performance.now();

    function tick(now) {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const current = from + (to - from) * eased;
      el.textContent = formatFn(Math.round(current));
      if (t < 1) {
        el._countRaf = requestAnimationFrame(tick);
      } else {
        el.textContent = formatFn(to);
      }
    }

    el._countRaf = requestAnimationFrame(tick);
  }

  return {
    formatCurrency,
    formatDate,
    todayISO,
    toISODate,
    daysInMonth,
    escapeHTML,
    debounce,
    fileToBase64,
    tempId,
    initials,
    clamp,
    isValidPinFormat,
    animateNumber
  };
});
