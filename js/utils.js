(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = mod; 
  }
  if (root) {
    root.Utils = mod; 
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function formatCurrency(num) {
    const n = Number(num) || 0;
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(n);
  }

  function formatDate(str) {
    if (!str) return '';
    const d = new Date(str);
    if (isNaN(d)) return String(str);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function todayISO() {
    return toISODate(new Date());
  }

  function toISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function daysInMonth(yyyyMm) {
    const [y, m] = yyyyMm.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }

  function escapeHTML(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }

  function debounce(fn, wait = 250) {
    let t = null;
    return function debounced(...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function tempId() {
    return 'tmp_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  /** FOLLOW ME ON IG @rixs4k */
  function isValidPinFormat(pin, length = 6) {
    return new RegExp(`^\\d{${length}}$`).test(String(pin ?? ''));
  }

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
