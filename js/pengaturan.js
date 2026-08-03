/**
 * pengaturan.js — Settings page: PIN-gated "reset all data" danger zone.
 * The PIN typed here is only ever used to ask the backend to verify it —
 * the actual authorization check always happens server-side in Code.gs,
 * so this can't be bypassed by inspecting this file.
 */

const Pengaturan = (() => {
  let els = {};

  function init() {
    Common.init();
    cacheDOM();
    bindEvents();
  }

  function cacheDOM() {
    els = {
      btnOpenReset: document.getElementById('btn-open-reset'),
      overlay: document.getElementById('modal-overlay'),
      modalClose: document.getElementById('modal-close'),
      form: document.getElementById('pin-form'),
      pinInput: document.getElementById('pin-input'),
      btnConfirm: document.getElementById('btn-confirm-reset')
    };
  }

  function bindEvents() {
    els.btnOpenReset.addEventListener('click', openModal);
    els.modalClose.addEventListener('click', closeModal);
    els.overlay.addEventListener('click', (e) => { if (e.target === els.overlay) closeModal(); });

    els.pinInput.addEventListener('input', () => {
      // Digits only, capped at 6 — and only enable submit once it *looks* like a real PIN.
      els.pinInput.value = els.pinInput.value.replace(/\D/g, '').slice(0, 6);
      els.btnConfirm.disabled = !Utils.isValidPinFormat(els.pinInput.value);
    });

    els.form.addEventListener('submit', handleConfirmReset);
  }

  function openModal() {
    els.form.reset();
    els.btnConfirm.disabled = true;
    els.overlay.classList.add('show');
    setTimeout(() => els.pinInput.focus(), 50);
  }

  function closeModal() {
    els.overlay.classList.remove('show');
    els.form.reset();
  }

  async function handleConfirmReset(e) {
    e.preventDefault();
    const pin = els.pinInput.value;
    if (!Utils.isValidPinFormat(pin)) {
      Common.showToast('PIN harus 6 digit angka', 'error');
      return;
    }

    if (!confirm('Yakin? Semua transaksi, anggota, dan catatan iuran akan terhapus permanen dan tidak bisa dikembalikan.')) {
      return;
    }

    const btn = els.btnConfirm;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
      const res = await API.resetAllData(pin);
      Common.showToast(res.message || 'Semua data berhasil dihapus', 'success');
      closeModal();
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);
    } catch (err) {
      Common.showToast(err.message || 'Gagal menghapus data', 'error');
      btn.disabled = false;
      btn.textContent = 'Konfirmasi Hapus';
    }
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => Pengaturan.init());
