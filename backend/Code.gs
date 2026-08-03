/**
 * Finance App — Google Apps Script Backend
 * Sheets used (auto-created if missing):
 *   - Transactions : general kas ledger (income/expense)
 *   - Anggota      : members who owe daily iuran
 *   - Iuran        : one row per member per date they PAID
 *   - Config       : optional login credentials (row 2: username, password)
 *
 * Paying iuran auto-creates a linked Transactions row (income, category "Iuran"),
 * and un-paying it removes that linked row, so the kas balance always stays correct
 * without double bookkeeping.
 */

const SHEET_TX = 'Transactions';
const SHEET_MEMBERS = 'Anggota';
const SHEET_IURAN = 'Iuran';
const CONFIG_SHEET = 'Config';
const DRIVE_FOLDER_NAME = 'FinanceApp_Photos';
const DEFAULT_RESET_PIN = '014715';

const TX_HEADERS = ['ID', 'Tanggal', 'Nama', 'Jenis', 'Kategori', 'Nominal', 'Catatan', 'URL Foto', 'Created At'];
const MEMBER_HEADERS = ['ID', 'Nama', 'NoHP', 'IuranDefault', 'Status', 'Created At'];
const IURAN_HEADERS = ['ID', 'Tanggal', 'MemberID', 'MemberNama', 'Nominal', 'Catatan', 'TransactionID', 'Created At'];

/* ========== ENTRY POINTS ========== */

function doGet(e) {
  return jsonResponse({ status: 'ok', message: 'Finance API is running' });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    switch (action) {
      // --- Auth ---
      case 'login':
        return jsonResponse(handleLogin(data.username, data.password));

      // --- Transactions (kas umum) ---
      case 'getTransactions':
        return jsonResponse(handleGetTransactions());
      case 'addTransaction':
        return jsonResponse(handleAddTransaction(data.transaction));
      case 'updateTransaction':
        return jsonResponse(handleUpdateTransaction(data.transaction));
      case 'deleteTransaction':
        return jsonResponse(handleDeleteTransaction(data.id));

      // --- Members (anggota) ---
      case 'getMembers':
        return jsonResponse(handleGetMembers());
      case 'addMember':
        return jsonResponse(handleAddMember(data.member));
      case 'updateMember':
        return jsonResponse(handleUpdateMember(data.member));
      case 'deleteMember':
        return jsonResponse(handleDeleteMember(data.id));

      // --- Iuran (daily dues) ---
      case 'getIuran':
        return jsonResponse(handleGetIuran(data.startDate, data.endDate));
      case 'setIuranPaid':
        return jsonResponse(handleSetIuranPaid(data.entry));
      case 'setIuranUnpaid':
        return jsonResponse(handleSetIuranUnpaid(data.memberId, data.date));

      // --- Danger zone ---
      case 'resetAllData':
        return jsonResponse(handleResetAllData(data.pin));

      default:
        return jsonResponse({ error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

/* ========== AUTH ========== */

function handleLogin(username, password) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const config = ss.getSheetByName(CONFIG_SHEET);

  let validUser = 'sang maha';
  let validPass = 'anjay12345';

  if (config) {
    const values = config.getDataRange().getValues();
    if (values.length >= 2) {
      validUser = String(values[1][0]).trim();
      validPass = String(values[1][1]).trim();
    }
  }

  const passwordMatches = validPass.startsWith('sha256:')
    ? ('sha256:' + sha256Hex(password) === validPass)
    : (password === validPass);

  if (username === validUser && passwordMatches) {
    return { success: true, username };
  }
  return { success: false, message: 'Username atau password salah' };
}

/** SHA-256 hash of a string, as lowercase hex. Used for optional hashed-password login. */
function sha256Hex(str) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8);
  return bytes.map(b => {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

/**
 * Run this ONCE manually from the Apps Script editor (select this function, click Run)
 * to generate a hash for your chosen password, then paste "sha256:<the hash>" into
 * Config!B2 instead of a plaintext password. Check the execution log (View > Logs) for output.
 */
function generatePasswordHash() {
  const plaintextPassword = 'GANTI_DENGAN_PASSWORD_ANDA';
  Logger.log('sha256:' + sha256Hex(plaintextPassword));
}

/* ========== DANGER ZONE: FULL RESET ========== */

/** Read the reset PIN from Config!C2 (plain or "sha256:<hash>"), or fall back to the default. */
function getConfiguredResetPin() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const config = ss.getSheetByName(CONFIG_SHEET);
  if (config) {
    const values = config.getDataRange().getValues();
    if (values.length >= 2 && values[1][2]) {
      return String(values[1][2]).trim();
    }
  }
  return DEFAULT_RESET_PIN;
}

/**
 * Wipe all transactions, members, and iuran records back to a clean slate.
 * Requires a correct PIN (checked server-side — this cannot be bypassed by
 * skipping the frontend and calling the API directly). The Config sheet
 * (login credentials + this very PIN) is left untouched on purpose.
 */
function handleResetAllData(pin) {
  const configuredPin = getConfiguredResetPin();
  const pinMatches = configuredPin.startsWith('sha256:')
    ? ('sha256:' + sha256Hex(String(pin || '')) === configuredPin)
    : (String(pin || '') === configuredPin);

  if (!pinMatches) {
    return { success: false, error: 'PIN salah' };
  }

  clearSheetData(SHEET_TX, TX_HEADERS);
  clearSheetData(SHEET_MEMBERS, MEMBER_HEADERS);
  clearSheetData(SHEET_IURAN, IURAN_HEADERS);

  const deletedPhotos = clearPhotosFolder();

  return { success: true, message: 'Semua data berhasil dihapus', deletedPhotos };
}

/** Delete every data row in a sheet, keeping only the header row intact. */
function clearSheetData(name, headers) {
  const sheet = getSheet(name, headers);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
}

/** Trash every file in the app's photo folder. Returns how many were removed. */
function clearPhotosFolder() {
  const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  if (!folders.hasNext()) return 0;
  const folder = folders.next();
  const files = folder.getFiles();
  let count = 0;
  while (files.hasNext()) {
    files.next().setTrashed(true);
    count++;
  }
  return count;
}

/* ========== TRANSACTIONS ========== */

function handleGetTransactions() {
  const sheet = getSheet(SHEET_TX, TX_HEADERS);
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return { transactions: [] };

  const transactions = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue;
    transactions.push({
      id: String(row[0]),
      date: formatDate(row[1]),
      name: row[2],
      type: row[3],
      category: row[4],
      amount: Number(row[5]) || 0,
      note: row[6] || '',
      photoUrl: row[7] || '',
      createdAt: row[8] ? new Date(row[8]).toISOString() : ''
    });
  }
  return { transactions };
}

function handleAddTransaction(tx) {
  const sheet = getSheet(SHEET_TX, TX_HEADERS);
  const id = Utilities.getUuid();
  const now = new Date();

  let photoUrl = '';
  if (tx.photoBase64) {
    photoUrl = savePhotoToDrive(tx.photoBase64, id);
  }

  sheet.appendRow([
    id,
    tx.date || now,
    tx.name || '',
    tx.type || 'expense',
    tx.category || '',
    Number(tx.amount) || 0,
    tx.note || '',
    photoUrl,
    now
  ]);

  return { success: true, id };
}

function handleUpdateTransaction(tx) {
  const sheet = getSheet(SHEET_TX, TX_HEADERS);
  const data = sheet.getDataRange().getValues();
  const id = String(tx.id);

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      let photoUrl = data[i][7] || '';
      if (tx.photoBase64) {
        photoUrl = savePhotoToDrive(tx.photoBase64, id);
      }

      sheet.getRange(i + 1, 2, 1, 7).setValues([[
        tx.date || data[i][1],
        tx.name || data[i][2],
        tx.type || data[i][3],
        tx.category || data[i][4],
        Number(tx.amount) || data[i][5],
        tx.note !== undefined ? tx.note : data[i][6],
        photoUrl
      ]]);
      return { success: true };
    }
  }
  return { error: 'Transaksi tidak ditemukan' };
}

function handleDeleteTransaction(id) {
  const sheet = getSheet(SHEET_TX, TX_HEADERS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'Transaksi tidak ditemukan' };
}

/* ========== MEMBERS (ANGGOTA) ========== */

function handleGetMembers() {
  const sheet = getSheet(SHEET_MEMBERS, MEMBER_HEADERS);
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return { members: [] };

  const members = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue;
    members.push({
      id: String(row[0]),
      name: row[1],
      phone: row[2] || '',
      defaultAmount: Number(row[3]) || 0,
      status: row[4] || 'aktif',
      createdAt: row[5] ? new Date(row[5]).toISOString() : ''
    });
  }
  return { members };
}

function handleAddMember(m) {
  if (!m || !m.name || !String(m.name).trim()) {
    return { error: 'Nama anggota wajib diisi' };
  }
  const sheet = getSheet(SHEET_MEMBERS, MEMBER_HEADERS);
  const id = Utilities.getUuid();
  const now = new Date();

  sheet.appendRow([
    id,
    String(m.name).trim(),
    m.phone || '',
    Number(m.defaultAmount) || 0,
    m.status || 'aktif',
    now
  ]);

  return { success: true, id };
}

function handleUpdateMember(m) {
  const sheet = getSheet(SHEET_MEMBERS, MEMBER_HEADERS);
  const data = sheet.getDataRange().getValues();
  const id = String(m.id);

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      sheet.getRange(i + 1, 2, 1, 4).setValues([[
        m.name !== undefined ? m.name : data[i][1],
        m.phone !== undefined ? m.phone : data[i][2],
        m.defaultAmount !== undefined ? Number(m.defaultAmount) : data[i][3],
        m.status !== undefined ? m.status : data[i][4]
      ]]);

      // Keep denormalized MemberNama in Iuran rows in sync if the name changed
      if (m.name !== undefined) {
        syncMemberNameInIuran(id, m.name);
      }
      return { success: true };
    }
  }
  return { error: 'Anggota tidak ditemukan' };
}

function handleDeleteMember(id) {
  const sheet = getSheet(SHEET_MEMBERS, MEMBER_HEADERS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'Anggota tidak ditemukan' };
}

function syncMemberNameInIuran(memberId, newName) {
  const sheet = getSheet(SHEET_IURAN, IURAN_HEADERS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][2]) === String(memberId)) {
      sheet.getRange(i + 1, 4).setValue(newName);
    }
  }
}

/* ========== IURAN (DAILY DUES) ========== */

function handleGetIuran(startDate, endDate) {
  const sheet = getSheet(SHEET_IURAN, IURAN_HEADERS);
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return { iuran: [] };

  const iuran = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue;
    const dateStr = formatDate(row[1]);
    if (startDate && dateStr < startDate) continue;
    if (endDate && dateStr > endDate) continue;
    iuran.push({
      id: String(row[0]),
      date: dateStr,
      memberId: String(row[2]),
      memberName: row[3] || '',
      amount: Number(row[4]) || 0,
      note: row[5] || '',
      transactionId: row[6] || '',
      createdAt: row[7] ? new Date(row[7]).toISOString() : ''
    });
  }
  return { iuran };
}

/** Mark a member as paid for a date. Idempotent: updates amount/note if already paid. */
function handleSetIuranPaid(entry) {
  if (!entry || !entry.memberId || !entry.date) {
    return { error: 'memberId dan date wajib diisi' };
  }
  const sheet = getSheet(SHEET_IURAN, IURAN_HEADERS);
  const data = sheet.getDataRange().getValues();

  const memberId = String(entry.memberId);
  const date = String(entry.date);
  const amount = Number(entry.amount) || 0;
  const note = entry.note || '';
  const now = new Date();

  // Already exists for this member+date? Update in place instead of duplicating.
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][2]) === memberId && formatDate(data[i][1]) === date) {
      sheet.getRange(i + 1, 5, 1, 2).setValues([[amount, note]]);
      const txId = data[i][6];
      if (txId) {
        updateLinkedTransactionAmount(txId, amount, note);
      }
      return { success: true, id: String(data[i][0]), updated: true };
    }
  }

  const id = Utilities.getUuid();
  const memberName = entry.memberName || lookupMemberName(memberId);

  // Auto-create the linked kas transaction so balances stay correct.
  const txSheet = getSheet(SHEET_TX, TX_HEADERS);
  const txId = Utilities.getUuid();
  txSheet.appendRow([
    txId, date, `Iuran - ${memberName}`, 'income', 'Iuran', amount,
    note || `Iuran harian ${memberName}`, '', now
  ]);

  sheet.appendRow([id, date, memberId, memberName, amount, note, txId, now]);

  return { success: true, id, transactionId: txId };
}

/** Unmark a member as paid for a date. Removes both the Iuran row and its linked transaction. */
function handleSetIuranUnpaid(memberId, date) {
  const sheet = getSheet(SHEET_IURAN, IURAN_HEADERS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][2]) === String(memberId) && formatDate(data[i][1]) === String(date)) {
      const txId = data[i][6];
      sheet.deleteRow(i + 1);
      if (txId) {
        deleteTransactionById(txId);
      }
      return { success: true };
    }
  }
  return { error: 'Data iuran tidak ditemukan' };
}

function lookupMemberName(memberId) {
  const sheet = getSheet(SHEET_MEMBERS, MEMBER_HEADERS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(memberId)) return data[i][1];
  }
  return 'Anggota';
}

function updateLinkedTransactionAmount(txId, amount, note) {
  const sheet = getSheet(SHEET_TX, TX_HEADERS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(txId)) {
      sheet.getRange(i + 1, 6).setValue(amount);
      if (note) sheet.getRange(i + 1, 7).setValue(note);
      return;
    }
  }
}

function deleteTransactionById(txId) {
  const sheet = getSheet(SHEET_TX, TX_HEADERS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(txId)) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

/* ========== HELPERS ========== */

function getSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function savePhotoToDrive(dataUrl, id) {
  try {
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)[1];
    const raw = Utilities.base64Decode(parts[1]);
    const blob = Utilities.newBlob(raw, mime, id + '.jpg');

    let folder;
    const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(DRIVE_FOLDER_NAME);
    }

    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (err) {
    console.error('Photo upload failed:', err);
    return '';
  }
}

function formatDate(val) {
  if (!val) return '';
  if (typeof val === 'string') return val.slice(0, 10);
  try {
    return Utilities.formatDate(new Date(val), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  } catch (e) {
    return String(val);
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
