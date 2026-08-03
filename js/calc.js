/**
 * calc.js — Pure calculation functions over transactions / members / iuran data.
 * No DOM access, no API calls — everything here takes plain data in and
 * returns plain data out, which is what makes it unit-testable.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = mod;
  }
  if (root) {
    root.Calc = mod;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /** Sum income / expense / balance over a list of transactions */
  function summarizeTransactions(transactions) {
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
      if (t.type === 'income') income += Number(t.amount) || 0;
      else if (t.type === 'expense') expense += Number(t.amount) || 0;
    }
    return { income, expense, balance: income - expense, count: transactions.length };
  }

  /**
   * Build the "who has paid today's iuran" picture.
   * @param {Array} members - [{id, name, status, defaultAmount}]
   * @param {Array} iuranEntries - iuran rows already filtered to one date [{memberId, amount}]
   */
  function summarizeIuranForDate(members, iuranEntries) {
    const activeMembers = members.filter(m => m.status !== 'nonaktif');
    const paidByMemberId = new Map(iuranEntries.map(e => [String(e.memberId), e]));

    const paid = [];
    const unpaid = [];
    let totalCollected = 0;

    for (const m of activeMembers) {
      const entry = paidByMemberId.get(String(m.id));
      if (entry) {
        paid.push(m);
        totalCollected += Number(entry.amount) || 0;
      } else {
        unpaid.push(m);
      }
    }

    return {
      totalActive: activeMembers.length,
      paidCount: paid.length,
      unpaidCount: unpaid.length,
      totalCollected,
      paid,
      unpaid,
      completionRate: activeMembers.length ? paid.length / activeMembers.length : 0
    };
  }

  /**
   * Build a full month's paid/unpaid matrix per member.
   * @param {Array} members
   * @param {Array} iuranEntries - all iuran rows for the month [{memberId, date, amount}]
   * @param {string} yyyyMm - e.g. "2026-08"
   * @param {number} daysInMonth
   */
  function buildMonthlyMatrix(members, iuranEntries, yyyyMm, daysInMonthCount) {
    const activeMembers = members.filter(m => m.status !== 'nonaktif');
    const byMember = new Map();
    for (const e of iuranEntries) {
      const key = String(e.memberId);
      if (!byMember.has(key)) byMember.set(key, new Map());
      byMember.get(key).set(e.date, e);
    }

    return activeMembers.map(m => {
      const entries = byMember.get(String(m.id)) || new Map();
      const days = [];
      let totalPaid = 0;
      let totalAmount = 0;
      for (let d = 1; d <= daysInMonthCount; d++) {
        const dateStr = `${yyyyMm}-${String(d).padStart(2, '0')}`;
        const entry = entries.get(dateStr);
        days.push({ day: d, date: dateStr, paid: !!entry, amount: entry ? Number(entry.amount) || 0 : 0 });
        if (entry) {
          totalPaid += 1;
          totalAmount += Number(entry.amount) || 0;
        }
      }
      return { member: m, days, totalPaid, totalAmount, totalDays: daysInMonthCount };
    });
  }

  /** Rank members by how many days behind on iuran within a month (most-behind first) */
  function rankMembersByArrears(monthlyMatrix) {
    return [...monthlyMatrix].sort((a, b) => (a.totalPaid - a.totalDays) - (b.totalPaid - b.totalDays));
  }

  return {
    summarizeTransactions,
    summarizeIuranForDate,
    buildMonthlyMatrix,
    rankMembersByArrears
  };
});
