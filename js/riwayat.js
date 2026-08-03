/**
 * riwayat.js — Full transaction history: search, filter, export, edit/delete.
 */

const Riwayat = (() => {
  let transactions = [];
  let currentFilter = 'all'; // all | income | expense | Iuran (category)
  let searchQuery = '';
  let editingId = null;

  let els = {};

  function init() {
    Common.init();
    cacheDOM();
    bindEvents();
    loadTransactions();
  }

  function cacheDOM() {
    els = {
      historyList: document.getElementById('history-list'),
      searchInput: document.getElementById('search-input'),
      filterChips: document.querySelectorAll('.chip[data-filter]'),
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
    document.getElementById('modal-close')?.addEventListener('click', closeModal);
    els.overlay?.addEventListener('click', (e) => { if (e.target === els.overlay) closeModal(); });
    els.form?.addEventListener('submit', handleSubmit);
    els.btnDelete?.addEventListener('click', handleDelete);
    els.txPhoto?.addEventListener('change', handlePhotoChange);

    els.searchInput?.addEventListener('input', Utils.debounce((e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderHistory();
    }, 200));

    els.filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        els.filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentFilter = chip.dataset.filter;
        renderHistory();
      });
    });

    document.getElementById('btn-export')?.addEventListener('click', exportToCSV);
  }

  async function loadTransactions() {
    Common.showLoading(true);
    try {
      const res = await API.getTransactions();
      transactions = (res.transactions || []);
      transactions.sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.createdAt) - new Date(a.createdAt));
      renderHistory();
    } catch (err) {
      Common.showToast(err.message || 'Gagal memuat data', 'error');
      console.error(err);
    } finally {
      Common.showLoading(false);
    }
  }

  function renderHistory() {
    let list = [...transactions];

    if (currentFilter === 'income' || currentFilter === 'expense') {
      list = list.filter(t => t.type === currentFilter);
    } else if (currentFilter !== 'all') {
      list = list.filter(t => t.category === currentFilter);
    }

    if (searchQuery) {
      list = list.filter(t =>
        t.name.toLowerCase().includes(searchQuery) ||
        t.category.toLowerCase().includes(searchQuery) ||
        (t.note && t.note.toLowerCase().includes(searchQuery))
      );
    }

    els.historyList.innerHTML = list.length
      ? list.map(txItemHTML).join('')
      : `<div class="empty-state"><p>Tidak ada transaksi yang cocok.</p></div>`;

    els.historyList.querySelectorAll('.tx-item').forEach(el => {
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
  function openModal(id) {
    editingId = id;
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    els.form.reset();
    els.photoPreview.classList.remove('show');
    els.photoImg.src = '';

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

    if (tx.category === 'Iuran') {
      Common.showToast('Ini transaksi hasil iuran. Ubah statusnya dari halaman Iuran biar rekap tetap sinkron.', '');
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
        id: editingId,
        name: els.txName.value.trim(),
        date: els.txDate.value,
        amount: Number(els.txAmount.value),
        type: els.txType.value,
        category: els.txCategory.value,
        note: els.txNote.value.trim(),
        photoBase64
      };

      await API.updateTransaction(txData);
      Common.showToast('Transaksi diperbarui', 'success');
      closeModal();
      await loadTransactions();
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
    if (!confirm('Hapus transaksi ini?')) return;

    Common.showLoading(true);
    try {
      await API.deleteTransaction(editingId);
      Common.showToast('Transaksi dihapus', 'success');
      closeModal();
      await loadTransactions();
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

  /* ---------- Export CSV ---------- */
  function exportToCSV() {
    if (!transactions.length) {
      Common.showToast('Tidak ada data untuk diekspor', 'error');
      return;
    }

    const headers = ['ID', 'Tanggal', 'Nama', 'Jenis', 'Kategori', 'Nominal', 'Catatan', 'URL Foto', 'Created At'];
    const rows = transactions.map(t => [
      t.id, t.date,
      `"${(t.name || '').replace(/"/g, '""')}"`,
      t.type,
      `"${(t.category || '').replace(/"/g, '""')}"`,
      t.amount,
      `"${(t.note || '').replace(/"/g, '""')}"`,
      t.photoUrl || '',
      t.createdAt
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transaksi_${Utils.todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    Common.showToast('File berhasil diunduh', 'success');
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => Riwayat.init());
