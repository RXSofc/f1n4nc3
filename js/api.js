/**
 * api.js — Communication layer with Google Apps Script
 * All requests go through the deployed Web App URL.
 */

const API = (() => {
  // ============================================================
  // GOOGLE APPS SCRIPT WEB APP URL
  // DONT RECODE THIS !!!!!
  // ============================================================
  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyXpjy4I5MMm6li2nC6n-8FAo6a4ZEEvrkIm28o0ARxL-GzYge9cdC6THXl1iscTceF/exec';

  const REQUEST_TIMEOUT_MS = 20000;

  async function request(action, payload = {}) {
    if (!SCRIPT_URL) {
      throw new Error('Google Apps Script URL belum diatur.');
    }

    const body = JSON.stringify({ action, ...payload });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res;
    try {
      res = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body,
        redirect: 'follow',
        signal: controller.signal
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Server tidak merespons. Cek koneksi internet kamu.');
      }
      throw new Error('Tidak dapat terhubung ke server.');
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new Error(`Network error: ${res.status}`);
    }

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error('Respons server tidak valid.');
    }

    if (data.error) {
      throw new Error(data.error);
    }

    return data;
  }

  // --- Auth ---
  const login = (username, password) => request('login', { username, password });

  // --- Transactions ---
  const getTransactions = () => request('getTransactions');
  const addTransaction = (tx) => request('addTransaction', { transaction: tx });
  const updateTransaction = (tx) => request('updateTransaction', { transaction: tx });
  const deleteTransaction = (id) => request('deleteTransaction', { id });

  // --- Members (anggota) ---
  const getMembers = () => request('getMembers');
  const addMember = (member) => request('addMember', { member });
  const updateMember = (member) => request('updateMember', { member });
  const deleteMember = (id) => request('deleteMember', { id });

  // --- Iuran (daily dues) ---
  const getIuran = (startDate, endDate) => request('getIuran', { startDate, endDate });
  const setIuranPaid = (entry) => request('setIuranPaid', { entry });
  const setIuranUnpaid = (memberId, date) => request('setIuranUnpaid', { memberId, date });

  // --- Danger zone ---
  const resetAllData = (pin) => request('resetAllData', { pin });

  return {
    login,
    getTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    getMembers,
    addMember,
    updateMember,
    deleteMember,
    getIuran,
    setIuranPaid,
    setIuranUnpaid,
    resetAllData
  };
})();
