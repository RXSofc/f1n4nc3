/**
 * iuran.js — Daily dues (iuran) tracking: mark members paid/unpaid for a date,
 * see a monthly paid/unpaid matrix, and spot who's most behind.
 */

const Iuran = (() => {
  let members = [];
  let dayEntries = [];      // iuran rows for the selected date
  let monthEntries = [];    // iuran rows for the whole selected month
  let selectedDate = Utils.todayISO();
  let currentMonth = selectedDate.slice(0, 7); // YYYY-MM
  let pendingMemberId = null; // member currently being marked paid via modal
  let busyMemberId = null;    // member row currently mid-request (disables its toggle)

  let els = {};

  function init() {
    Common.init();
    cacheDOM();
    bindEvents();
    els.dateInput.value = selectedDate;
    loadAll();
  }

  function cacheDOM() {
    els = {
      dateInput: document.getElementById('iuran-date'),
      btnPrevDay: document.getElementById('btn-prev-day'),
      btnNextDay: document.getElementById('btn-next-day'),
      btnToday: document.getElementById('btn-today'),
      dayCount: document.getElementById('day-count'),
      dayTotal: document.getElementById('day-total'),
      dayProgress: document.getElementById('day-progress'),
      btnMarkAll: document.getElementById('btn-mark-all'),
      memberList: document.getElementById('member-list'),
      matrixTable: document.getElementById('matrix-table'),
      arrearsList: document.getElementById('arrears-list'),
      btnExportMonth: document.getElementById('btn-export-month'),
      // modal
      overlay: document.getElementById('modal-overlay'),
      modalTitle: document.getElementById('modal-title'),
      form: document.getElementById('iuran-form'),
      formMember: document.getElementById('iuran-form-member'),
      amount: document.getElementById('iuran-amount'),
      note: document.getElementById('iuran-note'),
      btnSave: document.getElementById('btn-save-iuran')
    };
  }

  function bindEvents() {
    els.dateInput.addEventListener('change', () => {
      selectedDate = els.dateInput.value || Utils.todayISO();
      onDateChanged();
    });
    els.btnPrevDay.addEventListener('click', () => shiftDate(-1));
    els.btnNextDay.addEventListener('click', () => shiftDate(1));
    els.btnToday.addEventListener('click', () => {
      selectedDate = Utils.todayISO();
      els.dateInput.value = selectedDate;
      onDateChanged();
    });
    els.btnMarkAll.addEventListener('click', markAllPaid);
    els.btnExportMonth.addEventListener('click', exportMonthCSV);

    document.getElementById('modal-close')?.addEventListener('click', closeModal);
    els.overlay.addEventListener('click', (e) => { if (e.target === els.overlay) closeModal(); });
    els.form.addEventListener('submit', handleConfirmPaid);
  }

  function shiftDate(deltaDays) {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + deltaDays);
    selectedDate = Utils.toISODate(d);
    els.dateInput.value = selectedDate;
    onDateChanged();
  }

  function onDateChanged() {
    const newMonth = selectedDate.slice(0, 7);
    if (newMonth !== currentMonth) {
      currentMonth = newMonth;
      loadAll(); // month changed, need fresh month data too
    } else {
      loadDayOnly();
    }
  }

  async function loadAll() {
    Common.showLoading(true);
    try {
      const monthStart = currentMonth + '-01';
      const monthEnd = `${currentMonth}-${String(Utils.daysInMonth(currentMonth)).padStart(2, '0')}`;

      const [memberRes, monthRes] = await Promise.all([
        API.getMembers(),
        API.getIuran(monthStart, monthEnd)
      ]);
      members = memberRes.members || [];
      monthEntries = monthRes.iuran || [];
      dayEntries = monthEntries.filter(e => e.date === selectedDate);
      renderAll();
    } catch (err) {
      Common.showToast(err.message || 'Gagal memuat data', 'error');
      console.error(err);
    } finally {
      Common.showLoading(false);
    }
  }

  async function loadDayOnly() {
    // Selected date still falls in the already-loaded month, so just refilter.
    dayEntries = monthEntries.filter(e => e.date === selectedDate);
    renderAll();
  }

  async function refreshMonthData() {
    const monthStart = currentMonth + '-01';
    const monthEnd = `${currentMonth}-${String(Utils.daysInMonth(currentMonth)).padStart(2, '0')}`;
    const res = await API.getIuran(monthStart, monthEnd);
    monthEntries = res.iuran || [];
    dayEntries = monthEntries.filter(e => e.date === selectedDate);
  }

  function renderAll() {
    renderDaySummary();
    renderMemberList();
    renderMatrix();
    renderArrears();
  }

  /* ---------- Day view ---------- */
  function renderDaySummary() {
    const entries = dayEntries.map(e => ({ memberId: e.memberId, amount: e.amount }));
    const s = Calc.summarizeIuranForDate(members, entries);
    els.dayCount.textContent = `${s.paidCount} / ${s.totalActive} lunas`;
    els.dayTotal.textContent = Utils.formatCurrency(s.totalCollected);
    const pct = Math.round(s.completionRate * 100);
    els.dayProgress.style.width = pct + '%';
    els.dayProgress.className = 'progress-fill' + (pct === 100 ? '' : pct >= 50 ? ' warn' : ' danger');
    els.btnMarkAll.disabled = s.unpaidCount === 0;
    els.btnMarkAll.textContent = s.unpaidCount === 0 ? 'Semua Sudah Lunas' : `Tandai Semua Lunas (${s.unpaidCount})`;
  }

  function renderMemberList() {
    const activeMembers = members.filter(m => m.status !== 'nonaktif');
    if (!activeMembers.length) {
      els.memberList.innerHTML = `<div class="empty-state"><p>Belum ada anggota aktif.</p>
        <button class="btn btn-primary btn-sm" onclick="window.location.href='anggota.html'">+ Tambah Anggota</button>
      </div>`;
      return;
    }

    const paidMap = new Map(dayEntries.map(e => [String(e.memberId), e]));

    els.memberList.innerHTML = activeMembers.map(m => {
      const entry = paidMap.get(String(m.id));
      const isPaid = !!entry;
      const sub = isPaid
        ? `Lunas · ${Utils.formatCurrency(entry.amount)}`
        : `Belum bayar · biasanya ${Utils.formatCurrency(m.defaultAmount)}`;
      const busy = busyMemberId === m.id;
      return `
        <div class="member-row ${isPaid ? 'is-paid' : ''}" data-id="${m.id}">
          <div class="avatar ${isPaid ? '' : 'muted'}">${Utils.escapeHTML(Utils.initials(m.name))}</div>
          <div class="member-info">
            <div class="member-name">${Utils.escapeHTML(m.name)}</div>
            <div class="member-sub">${sub}</div>
          </div>
          <button class="toggle ${isPaid ? 'on' : ''}" data-id="${m.id}" ${busy ? 'disabled' : ''} aria-label="Tandai ${Utils.escapeHTML(m.name)} ${isPaid ? 'belum bayar' : 'lunas'}"></button>
        </div>
      `;
    }).join('');

    els.memberList.querySelectorAll('.toggle').forEach(btn => {
      btn.addEventListener('click', () => handleToggle(btn.dataset.id));
    });
  }

  async function handleToggle(memberId) {
    const member = members.find(m => String(m.id) === String(memberId));
    if (!member) return;
    const entry = dayEntries.find(e => String(e.memberId) === String(memberId));

    if (entry) {
      // Currently paid -> unmark (no modal needed, it's reversible in one tap)
      busyMemberId = memberId;
      renderMemberList();
      try {
        await API.setIuranUnpaid(memberId, selectedDate);
        await refreshMonthData();
        Common.showToast(`${member.name} ditandai belum bayar`, '');
        renderAll();
      } catch (err) {
        Common.showToast(err.message || 'Gagal mengubah status', 'error');
      } finally {
        busyMemberId = null;
      }
    } else {
      // Currently unpaid -> open modal to confirm nominal before marking paid
      pendingMemberId = memberId;
      els.formMember.textContent = member.name;
      els.amount.value = member.defaultAmount || 0;
      els.note.value = '';
      els.modalTitle.textContent = `Tandai Lunas — ${selectedDate}`;
      els.overlay.classList.add('show');
    }
  }

  async function handleConfirmPaid(e) {
    e.preventDefault();
    if (!pendingMemberId) return;
    const member = members.find(m => String(m.id) === String(pendingMemberId));
    const btn = els.btnSave;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
      await API.setIuranPaid({
        memberId: pendingMemberId,
        memberName: member?.name,
        date: selectedDate,
        amount: Number(els.amount.value) || 0,
        note: els.note.value.trim()
      });
      await refreshMonthData();
      Common.showToast(`${member?.name || 'Anggota'} ditandai lunas`, 'success');
      closeModal();
      renderAll();
    } catch (err) {
      Common.showToast(err.message || 'Gagal menyimpan', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Simpan';
    }
  }

  async function markAllPaid() {
    const activeMembers = members.filter(m => m.status !== 'nonaktif');
    const paidIds = new Set(dayEntries.map(e => String(e.memberId)));
    const unpaid = activeMembers.filter(m => !paidIds.has(String(m.id)));
    if (!unpaid.length) return;

    if (!confirm(`Tandai lunas untuk ${unpaid.length} anggota yang belum bayar pada ${selectedDate}, masing-masing sesuai iuran default?`)) return;

    Common.showLoading(true);
    let ok = 0;
    let fail = 0;
    for (const m of unpaid) {
      try {
        await API.setIuranPaid({
          memberId: m.id,
          memberName: m.name,
          date: selectedDate,
          amount: Number(m.defaultAmount) || 0,
          note: ''
        });
        ok++;
      } catch (err) {
        fail++;
        console.error(`Gagal menandai ${m.name}:`, err);
      }
    }
    await refreshMonthData();
    renderAll();
    Common.showLoading(false);
    Common.showToast(fail ? `${ok} berhasil, ${fail} gagal` : `${ok} anggota ditandai lunas`, fail ? 'error' : 'success');
  }

  function closeModal() {
    els.overlay.classList.remove('show');
    pendingMemberId = null;
  }

  /* ---------- Monthly matrix ---------- */
  function renderMatrix() {
    const daysCount = Utils.daysInMonth(currentMonth);
    const entries = monthEntries.map(e => ({ memberId: e.memberId, date: e.date, amount: e.amount }));
    const matrix = Calc.buildMonthlyMatrix(members, entries, currentMonth, daysCount);
    const today = Utils.todayISO();

    const thead = els.matrixTable.querySelector('thead');
    const tbody = els.matrixTable.querySelector('tbody');

    let headHTML = '<tr><th class="member-cell">Anggota</th>';
    for (let d = 1; d <= daysCount; d++) headHTML += `<th>${d}</th>`;
    headHTML += '</tr>';
    thead.innerHTML = headHTML;

    if (!matrix.length) {
      tbody.innerHTML = `<tr><td class="member-cell" colspan="${daysCount + 1}">Belum ada anggota aktif.</td></tr>`;
      return;
    }

    tbody.innerHTML = matrix.map(row => {
      const cells = row.days.map(d => {
        const isToday = d.date === today;
        const cls = ['matrix-dot', d.paid ? 'paid' : 'unpaid', isToday ? 'today' : ''].filter(Boolean).join(' ');
        const title = d.paid ? `${Utils.formatDate(d.date)}: Lunas (${Utils.formatCurrency(d.amount)})` : `${Utils.formatDate(d.date)}: Belum bayar`;
        return `<td title="${title}"><span class="${cls}"></span></td>`;
      }).join('');
      return `<tr><td class="member-cell">${Utils.escapeHTML(row.member.name)}<br><span class="member-sub">${row.totalPaid}/${row.totalDays} · ${Utils.formatCurrency(row.totalAmount)}</span></td>${cells}</tr>`;
    }).join('');
  }

  /* ---------- Arrears ---------- */
  function renderArrears() {
    const daysCount = Utils.daysInMonth(currentMonth);
    const entries = monthEntries.map(e => ({ memberId: e.memberId, date: e.date, amount: e.amount }));
    const matrix = Calc.buildMonthlyMatrix(members, entries, currentMonth, daysCount);
    const ranked = Calc.rankMembersByArrears(matrix).filter(r => (r.totalDays - r.totalPaid) > 0).slice(0, 5);

    els.arrearsList.innerHTML = ranked.length
      ? ranked.map(r => `
          <div class="arrears-item">
            <span>${Utils.escapeHTML(r.member.name)}</span>
            <span class="count">${r.totalDays - r.totalPaid} hari belum bayar</span>
          </div>
        `).join('')
      : `<div class="empty-state"><p>Semua anggota lancar bulan ini 👏</p></div>`;
  }

  /* ---------- Export ---------- */
  function exportMonthCSV() {
    const daysCount = Utils.daysInMonth(currentMonth);
    const entries = monthEntries.map(e => ({ memberId: e.memberId, date: e.date, amount: e.amount }));
    const matrix = Calc.buildMonthlyMatrix(members, entries, currentMonth, daysCount);

    if (!matrix.length) {
      Common.showToast('Tidak ada data untuk diekspor', 'error');
      return;
    }

    const dayHeaders = matrix[0].days.map(d => d.day);
    const headers = ['Nama', ...dayHeaders.map(d => `Tgl${d}`), 'TotalHariBayar', 'TotalHari', 'TotalNominal'];
    const rows = matrix.map(r => [
      `"${r.member.name.replace(/"/g, '""')}"`,
      ...r.days.map(d => (d.paid ? 'V' : '')),
      r.totalPaid,
      r.totalDays,
      r.totalAmount
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rekap_iuran_${currentMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    Common.showToast('Rekap bulanan berhasil diunduh', 'success');
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => Iuran.init());
