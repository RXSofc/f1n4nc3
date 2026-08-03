const test = require('node:test');
const assert = require('node:assert/strict');
const Calc = require('../js/calc.js');

test('summarizeTransactions sums income/expense and computes balance', () => {
  const txs = [
    { type: 'income', amount: 100000 },
    { type: 'income', amount: 50000 },
    { type: 'expense', amount: 30000 }
  ];
  const s = Calc.summarizeTransactions(txs);
  assert.equal(s.income, 150000);
  assert.equal(s.expense, 30000);
  assert.equal(s.balance, 120000);
  assert.equal(s.count, 3);
});

test('summarizeTransactions handles an empty list', () => {
  const s = Calc.summarizeTransactions([]);
  assert.deepEqual(s, { income: 0, expense: 0, balance: 0, count: 0 });
});

test('summarizeIuranForDate splits members into paid/unpaid and totals collected amount', () => {
  const members = [
    { id: '1', name: 'Budi', status: 'aktif' },
    { id: '2', name: 'Ani', status: 'aktif' },
    { id: '3', name: 'Non-aktif Guy', status: 'nonaktif' } // must be excluded entirely
  ];
  const entries = [{ memberId: '1', amount: 5000 }];

  const s = Calc.summarizeIuranForDate(members, entries);
  assert.equal(s.totalActive, 2);
  assert.equal(s.paidCount, 1);
  assert.equal(s.unpaidCount, 1);
  assert.equal(s.totalCollected, 5000);
  assert.equal(s.paid[0].name, 'Budi');
  assert.equal(s.unpaid[0].name, 'Ani');
  assert.equal(s.completionRate, 0.5);
});

test('summarizeIuranForDate with zero active members does not divide by zero', () => {
  const s = Calc.summarizeIuranForDate([], []);
  assert.equal(s.totalActive, 0);
  assert.equal(s.completionRate, 0);
});

test('buildMonthlyMatrix marks every day paid/unpaid per member with correct totals', () => {
  const members = [{ id: '1', name: 'Budi', status: 'aktif' }];
  const entries = [
    { memberId: '1', date: '2026-08-01', amount: 5000 },
    { memberId: '1', date: '2026-08-03', amount: 5000 }
  ];
  const matrix = Calc.buildMonthlyMatrix(members, entries, '2026-08', 5);

  assert.equal(matrix.length, 1);
  const row = matrix[0];
  assert.equal(row.totalPaid, 2);
  assert.equal(row.totalAmount, 10000);
  assert.equal(row.days.length, 5);
  assert.equal(row.days[0].paid, true);  // day 1
  assert.equal(row.days[1].paid, false); // day 2
  assert.equal(row.days[2].paid, true);  // day 3
  assert.equal(row.days[2].date, '2026-08-03');
});

test('buildMonthlyMatrix excludes nonaktif members', () => {
  const members = [
    { id: '1', name: 'Active', status: 'aktif' },
    { id: '2', name: 'Inactive', status: 'nonaktif' }
  ];
  const matrix = Calc.buildMonthlyMatrix(members, [], '2026-08', 31);
  assert.equal(matrix.length, 1);
  assert.equal(matrix[0].member.name, 'Active');
});

test('rankMembersByArrears sorts the member most behind on payments first', () => {
  const matrix = [
    { member: { name: 'A' }, totalPaid: 5, totalDays: 10 },  // 5 unpaid days
    { member: { name: 'B' }, totalPaid: 9, totalDays: 10 },  // 1 unpaid day
    { member: { name: 'C' }, totalPaid: 1, totalDays: 10 }   // 9 unpaid days
  ];
  const ranked = Calc.rankMembersByArrears(matrix);
  assert.deepEqual(ranked.map(r => r.member.name), ['C', 'A', 'B']);
});

test('rankMembersByArrears does not mutate the input array', () => {
  const matrix = [
    { member: { name: 'A' }, totalPaid: 5, totalDays: 10 },
    { member: { name: 'B' }, totalPaid: 1, totalDays: 10 }
  ];
  const original = [...matrix];
  Calc.rankMembersByArrears(matrix);
  assert.deepEqual(matrix, original);
});
