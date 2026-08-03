/**
 * anggota.js — Members (anggota) CRUD: add, edit, delete, search, filter by status.
 */

const Anggota = (() => {
  let members = [];
  let searchQuery = '';
  let currentFilter = 'all'; // all | aktif | nonaktif
  let editingId = null;

  let els = {};

  function init() {
    Common.init();
    cacheDOM();
    bindEvents();
    loadMembers();
  }

  function cacheDOM() {
    els = {
      list: document.getElementById('member-list'),
      searchInput: document.getElementById('search-input'),
      filterChips: document.querySelectorAll('.chip[data-filter]'),
      overlay: document.getElementById('modal-overlay'),
      modalTitle: document.getElementById('modal-title'),
      form: document.getElementById('member-form'),
      name: document.getElementById('member-name'),
      phone: document.getElementById('member-phone'),
      amount: document.getElementById('member-amount'),
      status: document.getElementById('member-status'),
      btnSave: document.getElementById('btn-save-member'),
      btnDelete: document.getElementById('btn-delete-member')
    };
  }

  function bindEvents() {
    document.getElementById('btn-add-member')?.addEventListener('click', () => openModal());
    document.getElementById('modal-close')?.addEventListener('click', closeModal);
    els.overlay.addEventListener('click', (e) => { if (e.target === els.overlay) closeModal(); });
    els.form.addEventListener('submit', handleSubmit);
    els.btnDelete.addEventListener('click', handleDelete);

    els.searchInput?.addEventListener('input', Utils.debounce((e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      render();
    }, 200));

    els.filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        els.filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentFilter = chip.dataset.filter;
        render();
      });
    });
  }

  async function loadMembers() {
    Common.showLoading(true);
    try {
      const res = await API.getMembers();
      members = res.members || [];
      members.sort((a, b) => a.name.localeCompare(b.name, 'id'));
      render();
    } catch (err) {
      Common.showToast(err.message || 'Gagal memuat anggota', 'error');
      console.error(err);
    } finally {
      Common.showLoading(false);
    }
  }

  function render() {
    let list = [...members];
    if (currentFilter !== 'all') list = list.filter(m => (m.status || 'aktif') === currentFilter);
    if (searchQuery) list = list.filter(m => m.name.toLowerCase().includes(searchQuery));

    if (!list.length) {
      els.list.innerHTML = `<div class="empty-state"><p>Belum ada anggota yang cocok.</p>
        <button class="btn btn-primary btn-sm" onclick="document.getElementById('btn-add-member').click()">+ Tambah Anggota</button>
      </div>`;
      return;
    }

    els.list.innerHTML = list.map(m => `
      <div class="member-row" data-id="${m.id}" tabindex="0" style="cursor:pointer;">
        <div class="avatar">${Utils.escapeHTML(Utils.initials(m.name))}</div>
        <div class="member-info">
          <div class="member-name">${Utils.escapeHTML(m.name)}</div>
          <div class="member-sub">${Utils.formatCurrency(m.defaultAmount)} / hari${m.phone ? ' · ' + Utils.escapeHTML(m.phone) : ''}</div>
        </div>
        <span class="status-pill ${m.status || 'aktif'}">${m.status || 'aktif'}</span>
      </div>
    `).join('');

    els.list.querySelectorAll('.member-row').forEach(el => {
      el.addEventListener('click', () => openModal(el.dataset.id));
    });
  }

  /* ---------- Modal ---------- */
  function openModal(id = null) {
    editingId = id;
    els.form.reset();
    els.btnDelete.style.display = 'none';

    if (id) {
      const m = members.find(x => x.id === id);
      if (!m) return;
      els.modalTitle.textContent = 'Edit Anggota';
      els.name.value = m.name;
      els.phone.value = m.phone || '';
      els.amount.value = m.defaultAmount;
      els.status.value = m.status || 'aktif';
      els.btnDelete.style.display = 'block';
    } else {
      els.modalTitle.textContent = 'Tambah Anggota';
      els.status.value = 'aktif';
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
      const data = {
        id: editingId || undefined,
        name: els.name.value.trim(),
        phone: els.phone.value.trim(),
        defaultAmount: Number(els.amount.value),
        status: els.status.value
      };

      if (editingId) {
        await API.updateMember(data);
        Common.showToast('Anggota diperbarui', 'success');
      } else {
        await API.addMember(data);
        Common.showToast('Anggota ditambahkan', 'success');
      }

      closeModal();
      await loadMembers();
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
    if (!confirm('Hapus anggota ini? Riwayat iuran yang sudah tercatat tidak akan ikut terhapus.')) return;

    Common.showLoading(true);
    try {
      await API.deleteMember(editingId);
      Common.showToast('Anggota dihapus', 'success');
      closeModal();
      await loadMembers();
    } catch (err) {
      Common.showToast(err.message || 'Gagal menghapus', 'error');
    } finally {
      Common.showLoading(false);
    }
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => Anggota.init());
