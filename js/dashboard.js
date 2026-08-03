/**
 * dashboard.js — Beranda (home) page: balance overview, today's iuran progress,
 * recent activity, and the quick "+ Transaksi" modal for general kas entries.
 */

const Dashboard = (() => {
  let transactions = [];
  let members = [];
  let todayIuran = [];
  let editingId = null;

  let els = {};

  function init() {
    Common.init();
    cacheDOM();
    bindEvents();
    loadAll();
  }

  function cacheDOM() {
    els = {
      balance: document.getElementById('balance'),
      totalIncome: document.getElementById('total-income'),
      totalExpense: document.getElementById('total-expense'),
      txCount: document.getElementById('tx-count'),
      memberCount: document.getElementById('member-count'),
      recentList: document.getElementById('recent-list'),
      iuranTodayCount: document.getElementById('iuran-today-count'),
      iuranTodayTotal: document.getElementById('iuran-today-total'),
      iuranTodayProgress: document.getElementById('iuran-today-progress'),
      // Modal
      overlay: document.getElementById('modal-overlay'),
      modalTitle: document.getElementById('modal-title'),
      form: document.getElementById('tx-form'),
      txName: document.getElementById('tx-name'),
      txDate: document.getElementById('tx-date'),
      txAmount: document.getElementById('tx-amount'),
      txType: document.getElementById('tx-type'),
      txCategory: document.getElementById('tx-category'),
      txNote: document.getElementById('tx-note'),
      txPhoto: document.getElementById('tx-photo'),
      photoPreview: document.getElementById('photo-preview'),
      photoImg: document.getElementById('photo-img'),
      btnSave: document.getElementById('btn-save'),
      btnDelete: document.getElementById('btn-delete')
    };
  }

  function bindEvents() {
    document.getElementById('btn-add-tx')?.addEventListener('click', () => openModal());
    document.getElementById('modal-close')?.addEventListener('click', closeModal);
    els.overlay?.addEventListener('click', (e) => { if (e.target === els.overlay) closeModal(); });
    els.form?.addEventListener('submit', handleSubmit);
    els.btnDelete?.addEventListener('click', handleDelete);
    els.txPhoto?.addEventListener('change', handlePhotoChange);
  }

  async function loadAll() {
    Common.showLoading(true);
    try {
      const [txRes, memberRes, iuranRes] = await Promise.all([
        API.getTransactions(),
        API.getMembers(),
        API.getIuran(Utils.todayISO(), Utils.todayISO())
      ]);
      transactions = (txRes.transactions || []);
      transactions.sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.createdAt) - new Date(a.createdAt));
      members = memberRes.members || [];
      todayIuran = iuranRes.iuran || [];
      renderAll();
    } catch (err) {
      Common.showToast(err.message || 'Gagal memuat data', 'error');
      console.error(err);
    } finally {
      Common.showLoading(false);
    }
  }

  function renderAll() {
    renderSummary();
    renderIuranToday();
    renderRecent();
  }

  function renderSummary() {
    const s = Calc.summarizeTransactions(transactions);
    els.balance.textContent = Utils.formatCurrency(s.balance);
    els.totalIncome.textContent = Utils.formatCurrency(s.income);
    els.totalExpense.textContent = Utils.formatCurrency(s.expense);
    els.txCount.textContent = s.count;
    els.memberCount.textContent = members.filter(m => m.status !== 'nonaktif').length;
  }

  function renderIuranToday() {
    const s = Calc.summarizeIuranForDate(members, todayIuran);
    els.iuranTodayCount.textContent = `${s.paidCount} / ${s.totalActive} lunas`;
    els.iuranTodayTotal.textContent = `${Utils.formatCurrency(s.totalCollected)} terkumpul`;
    const pct = Math.round(s.completionRate * 100);
    els.iuranTodayProgress.style.width = pct + '%';
    els.iuranTodayProgress.className = 'progress-fill' + (pct === 100 ? '' : pct >= 50 ? ' warn' : ' danger');
  }

  function renderRecent() {
    const recent = transactions.slice(0, 6);
    els.recentList.innerHTML = recent.length
      ? recent.map(txItemHTML).join('')
      : `<div class="empty-state"><p>Belum ada transaksi. Yuk mulai catat!</p>
          <button class="btn btn-primary btn-sm" onclick="document.getElementById('btn-add-tx').click()">+ Tambah Transaksi</button>
        </div>`;

    els.recentList.querySelectorAll('.tx-item').forEach(el => {
      el.addEventListener('click', () => openModal(el.dataset.id));
    });
  }

  function txItemHTML(tx) {
    const sign = tx.type === 'income' ? '+' : '-';
    const icon = tx.type === 'income' ? '↓' : '↑';
    return `
      <div class="tx-item" data-id="${tx.id}" tabindex="0">
        <div class="tx-icon ${tx.type}">${icon}</div>
        <div class="tx-info">
          <div class="tx-name">${Utils.escapeHTML(tx.name)}</div>
          <div class="tx-meta">${Utils.formatDate(tx.date)} · ${Utils.escapeHTML(tx.category)}</div>
        </div>
        <div class="tx-amount ${tx.type}">${sign}${Utils.formatCurrency(tx.amount)}</div>
      </div>
    `;
  }

  /* ---------- Modal ---------- */
  function openModal(id = null) {
    editingId = id;
    els.form.reset();
    els.photoPreview.classList.remove('show');
    els.photoImg.src = '';
    els.btnDelete.style.display = 'none';

    if (id) {
      const tx = transactions.find(t => t.id === id);
      if (!tx) return;
      els.modalTitle.textContent = 'Edit Transaksi';
      els.txName.value = tx.name;
      els.txDate.value = tx.date;
      els.txAmount.value = tx.amount;
      els.txType.value = tx.type;
      els.txCategory.value = tx.category;
      els.txNote.value = tx.note || '';
      if (tx.photoUrl) {
        els.photoImg.src = tx.photoUrl;
        els.photoPreview.classList.add('show');
      }
      els.btnDelete.style.display = 'block';
    } else {
      els.modalTitle.textContent = 'Tambah Transaksi';
      els.txDate.value = Utils.todayISO();
    }

    els.overlay.classList.add('show');
  }

  function closeModal() {
    els.overlay.classList.remove('show');
    editingId = null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const btn = els.btnSave;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
      const photoFile = els.txPhoto.files[0];
      let photoBase64 = null;
      if (photoFile) photoBase64 = await Utils.fileToBase64(photoFile);

      const txData = {
        id: editingId || undefined,
        name: els.txName.value.trim(),
        date: els.txDate.value,
        amount: Number(els.txAmount.value),
        type: els.txType.value,
        category: els.txCategory.value,
        note: els.txNote.value.trim(),
        photoBase64
      };

      if (editingId) {
        await API.updateTransaction(txData);
        Common.showToast('Transaksi diperbarui', 'success');
      } else {
        await API.addTransaction(txData);
        Common.showToast('Transaksi ditambahkan', 'success');
      }

      closeModal();
      await loadAll();
    } catch (err) {
      Common.showToast(err.message || 'Gagal menyimpan', 'error');
      console.error(err);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Simpan';
    }
  }

  async function handleDelete() {
    if (!editingId) return;
    if (!confirm('Hapus transaksi ini? Kalau ini transaksi hasil iuran, hapus dari halaman Iuran saja biar rekapnya tetap sinkron.')) return;

    Common.showLoading(true);
    try {
      await API.deleteTransaction(editingId);
      Common.showToast('Transaksi dihapus', 'success');
      closeModal();
      await loadAll();
    } catch (err) {
      Common.showToast(err.message || 'Gagal menghapus', 'error');
    } finally {
      Common.showLoading(false);
    }
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) { els.photoPreview.classList.remove('show'); return; }
    els.photoImg.src = URL.createObjectURL(file);
    els.photoPreview.classList.add('show');
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => Dashboard.init());
