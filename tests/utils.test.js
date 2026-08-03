const test = require('node:test');
const assert = require('node:assert/strict');
const Utils = require('../js/utils.js');

test('formatCurrency formats IDR without decimals', () => {
  assert.equal(Utils.formatCurrency(15000), 'Rp 15.000');
  assert.equal(Utils.formatCurrency(0), 'Rp 0');
  assert.equal(Utils.formatCurrency(1000000), 'Rp 1.000.000');
});

test('formatCurrency treats non-numeric input as 0', () => {
  assert.equal(Utils.formatCurrency(undefined), 'Rp 0');
  assert.equal(Utils.formatCurrency('abc'), 'Rp 0');
});

test('toISODate uses local date parts, not UTC (no off-by-one-day bug)', () => {
  // 23:30 local time should still report the SAME local calendar day,
  // which is exactly the bug you get if you naively use toISOString().
  const d = new Date(2026, 7, 3, 23, 30, 0); // Aug 3 2026, 23:30 local
  assert.equal(Utils.toISODate(d), '2026-08-03');
});

test('todayISO returns a well-formed YYYY-MM-DD string', () => {
  assert.match(Utils.todayISO(), /^\d{4}-\d{2}-\d{2}$/);
});

test('daysInMonth handles regular, 30-day, and leap-year February', () => {
  assert.equal(Utils.daysInMonth('2026-01'), 31);
  assert.equal(Utils.daysInMonth('2026-04'), 30);
  assert.equal(Utils.daysInMonth('2026-02'), 28); // 2026 not a leap year
  assert.equal(Utils.daysInMonth('2024-02'), 29); // 2024 is a leap year
});

test('escapeHTML neutralizes tags and quotes', () => {
  assert.equal(Utils.escapeHTML('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(Utils.escapeHTML(`O'Brien & "Sons"`), 'O&#39;Brien &amp; &quot;Sons&quot;');
});

test('escapeHTML handles null/undefined gracefully', () => {
  assert.equal(Utils.escapeHTML(null), '');
  assert.equal(Utils.escapeHTML(undefined), '');
});

test('initials derives sensible avatar initials', () => {
  assert.equal(Utils.initials('Budi Santoso'), 'BS');
  assert.equal(Utils.initials('Budi'), 'BU');
  assert.equal(Utils.initials('  '), '?');
  assert.equal(Utils.initials(''), '?');
  assert.equal(Utils.initials('Siti Nur Aminah'), 'SA'); // first + last, ignores middle
});

test('clamp bounds a value between min and max', () => {
  assert.equal(Utils.clamp(5, 0, 10), 5);
  assert.equal(Utils.clamp(-5, 0, 10), 0);
  assert.equal(Utils.clamp(50, 0, 10), 10);
});

test('debounce only invokes the wrapped function once after the wait window', () => {
  return new Promise((resolve) => {
    let calls = 0;
    const fn = Utils.debounce(() => { calls++; }, 20);
    fn(); fn(); fn();
    setTimeout(() => {
      assert.equal(calls, 1);
      resolve();
    }, 50);
  });
});

test('tempId returns unique-ish string ids', () => {
  const a = Utils.tempId();
  const b = Utils.tempId();
  assert.notEqual(a, b);
  assert.match(a, /^tmp_/);
});

test('isValidPinFormat accepts exactly 6 digits by default', () => {
  assert.equal(Utils.isValidPinFormat('014715'), true);
  assert.equal(Utils.isValidPinFormat('000000'), true);
});

test('isValidPinFormat rejects wrong length, non-digits, and empty input', () => {
  assert.equal(Utils.isValidPinFormat('12345'), false);   // too short
  assert.equal(Utils.isValidPinFormat('1234567'), false); // too long
  assert.equal(Utils.isValidPinFormat('12a456'), false);  // non-digit
  assert.equal(Utils.isValidPinFormat(''), false);
  assert.equal(Utils.isValidPinFormat(undefined), false);
  assert.equal(Utils.isValidPinFormat(null), false);
});

test('isValidPinFormat respects a custom length', () => {
  assert.equal(Utils.isValidPinFormat('1234', 4), true);
  assert.equal(Utils.isValidPinFormat('123', 4), false);
});
