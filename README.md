# Finance App — Kas & Iuran Harian

Aplikasi kas + pencatatan **iuran harian** (per-anggota) dengan tema **Neo Brutalism**.

**Stack:** HTML5 · CSS3 · Vanilla JS (ES6, tanpa framework) · Google Apps Script · Google Sheets

Tidak ada framework, tidak ada build step, siap dijalankan langsung dengan membuka file HTML di browser (atau di-host di GitHub Pages / Netlify / Vercel).

---

## Apa yang baru di versi ini

Versi sebelumnya cuma pencatatan transaksi umum (pemasukan/pengeluaran). Versi ini menambahkan **modul iuran harian** — dibangun khusus buat kasus "tiap anggota bayar sekian rupiah tiap hari, siapa yang udah bayar hari ini, siapa yang nunggak" (RT/RW, arisan, koperasi, kas kelas, dll):

- **Anggota** — data siapa saja yang wajib iuran, nominal default per hari, status aktif/nonaktif.
- **Iuran harian** — tandai lunas/belum per anggota per tanggal, nominal bisa disesuaikan per entri, satu tap buat toggle status.
- **Auto-sync ke kas** — begitu iuran ditandai lunas, otomatis muncul sebagai transaksi pemasukan kategori "Iuran" di buku kas. Kalau dibatalkan, transaksinya ikut kehapus. Jadi saldo kas selalu akurat tanpa dobel catat.
- **Rekap bulanan** — matrix anggota × tanggal (lunas/belum tiap hari), plus daftar "paling sering nunggak" bulan berjalan.
- **Export CSV** — baik riwayat transaksi maupun rekap iuran bulanan.
- **Reset Semua Data** — halaman Pengaturan (ikon ⚙️ di header) punya "Zona Berbahaya": hapus semua transaksi, anggota, dan catatan iuran (plus foto di Drive) sekaligus, dijaga PIN 6 digit yang **divalidasi di server** (bukan cuma di frontend, jadi gak bisa dilewatin dengan manggil API langsung).
- Halaman dipecah jadi 4: **Beranda** (ringkasan), **Iuran** (kelola harian + rekap), **Riwayat** (transaksi umum), **Anggota** (kelola anggota) — biar tiap halaman fokus, bukan satu dashboard yang isinya numpuk semua.
- Perbaikan kecil tapi penting: sesi login sekarang kedaluwarsa (12 jam), request ke backend punya timeout (20 detik, gak nge-hang selamanya kalau Apps Script lelet), opsi password ter-hash (SHA-256) di sheet Config, dan fokus keyboard yang kelihatan untuk aksesibilitas.

Tema neobrutalism (border hitam tebal, shadow offset, radius 18px, aksen lime `#C6FF00`) **dipertahankan persis** — cuma diperluas ke komponen baru (avatar, toggle, progress bar, matrix, badge) biar konsisten.

---

## Struktur Project

```
finance-app/
├── index.html            → Halaman login
├── dashboard.html         → Beranda: saldo, ringkasan, iuran hari ini
├── iuran.html              → Kelola iuran harian + rekap bulanan
├── riwayat.html            → Riwayat transaksi kas (search, filter, export)
├── anggota.html            → CRUD anggota iuran
├── pengaturan.html         → Info app + Zona Berbahaya (reset semua data)
├── css/style.css           → Neo Brutalism theme (diperluas)
├── js/
│   ├── utils.js             → Helper murni (format uang/tanggal, escape HTML, dll) — DIUJI
│   ├── calc.js               → Logika kalkulasi murni (rekap kas, rekap iuran) — DIUJI
│   ├── api.js                 → Fetch ke Google Apps Script (+timeout)
│   ├── auth.js                 → Session localStorage (+expiry 12 jam)
│   ├── common.js                → Chrome bersama tiap halaman (nav aktif, toast, loading)
│   ├── app.js                    → Logic login
│   ├── dashboard.js               → Logic Beranda
│   ├── iuran.js                     → Logic halaman Iuran
│   ├── riwayat.js                    → Logic halaman Riwayat
│   ├── anggota.js                     → Logic halaman Anggota
│   └── pengaturan.js                   → Logic halaman Pengaturan (PIN gate)
├── backend/Code.gs          → Backend Google Apps Script lengkap (siap paste)
├── tests/                     → Unit test (Node built-in test runner, tanpa dependency)
│   ├── utils.test.js
│   └── calc.test.js
├── package.json                → `npm test` buat jalanin unit test
├── assets/                       → (kosong, siap dipakai)
└── README.md
```

---

## Cara Setup (Langkah demi Langkah)

### 1. Buat Google Sheet

Buka [sheets.google.com](https://sheets.google.com) → buat spreadsheet baru. **Tidak perlu bikin sheet manual** — backend otomatis membuat 4 sheet berikut saat pertama kali dipakai (`Transactions`, `Anggota`, `Iuran`, header masing-masing sudah otomatis diisi). Yang perlu kamu buat manual cuma sheet `Config` (opsional, untuk login).

Kalau mau bikin manual juga boleh, ini struktur masing-masing sheet:

**Transactions**

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| ID | Tanggal | Nama | Jenis | Kategori | Nominal | Catatan | URL Foto | Created At |

**Anggota**

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| ID | Nama | NoHP | IuranDefault | Status | Created At |

**Iuran** (satu baris = satu anggota lunas di satu tanggal)

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| ID | Tanggal | MemberID | MemberNama | Nominal | Catatan | TransactionID | Created At |

**Config** (opsional — kalau tidak dibuat, login default `admin` / `rahasia123`, PIN reset default `014715`)

- A1 = `username`, B1 = `password`, C1 = `resetPin`
- A2 = `admin`, B2 = `rahasia123`, C2 = `014715` ← ganti semuanya sesuai keinginan

**Untuk password/PIN yang lebih aman:** isi B2/C2 dengan `sha256:<hash>` alih-alih plaintext. Cara generate hash-nya ada di langkah 2 di bawah (fungsi yang sama dipakai untuk password maupun PIN).

### 2. Deploy Google Apps Script

1. Di Google Sheet yang sama: **Extensions → Apps Script**.
2. Hapus kode default, lalu paste seluruh isi file [`backend/Code.gs`](backend/Code.gs) dari folder ini.
3. *(Opsional, buat password/PIN ter-hash)* Ubah nilai `plaintextPassword` di fungsi `generatePasswordHash()` di bagian bawah file, lalu pilih fungsi itu di dropdown toolbar Apps Script dan klik **Run**. Buka **View → Logs**, salin string `sha256:...` yang muncul, tempel ke `Config!B2` (password) atau `Config!C2` (PIN reset) — fungsi yang sama dipakai untuk keduanya, tinggal ganti nilai yang di-hash.
4. Simpan project (Ctrl+S / Cmd+S).
5. Klik **Deploy → New deployment**.
6. Pilih type: **Web app**.
7. Settings:
   - Description: `Finance API`
   - Execute as: **Me**
   - Who has access: **Anyone**
8. Klik **Deploy**, lalu izinkan permission yang diminta.
9. **Salin Web App URL** (`https://script.google.com/macros/s/XXXX/exec`).

### 3. Hubungkan Frontend ke Backend

Buka `js/api.js`, ganti nilai `SCRIPT_URL` dengan URL yang kamu salin tadi.

### 4. Tambahkan Anggota

Buka `anggota.html` di browser (setelah login), tambahkan anggota yang wajib iuran beserta nominal default hariannya. Setelah itu halaman `iuran.html` otomatis menampilkan mereka untuk ditandai lunas/belum tiap hari.

### 5. Jalankan Aplikasi

Buka `index.html` di browser, atau host di GitHub Pages / Netlify / Vercel / server lokal.

---

## Fitur

| Fitur | Keterangan |
|---|---|
| Login | Validasi lewat Apps Script, session localStorage (kedaluwarsa 12 jam), dukungan password ter-hash |
| Beranda | Saldo kas, ringkasan pemasukan/pengeluaran, progres iuran hari ini, aktivitas terbaru |
| Iuran Harian | Tandai lunas/belum per anggota per tanggal, navigasi tanggal cepat, "Tandai Semua Lunas" |
| Rekap Bulanan | Matrix anggota × tanggal, daftar anggota paling sering nunggak, export CSV |
| Auto-sync Kas | Iuran lunas otomatis jadi transaksi pemasukan kategori "Iuran" — dan sebaliknya |
| Anggota | CRUD anggota: nama, no. HP, nominal iuran default, status aktif/nonaktif |
| Riwayat & Kas Umum | Tambah/edit/hapus transaksi bebas (bukan cuma iuran), foto bukti, catatan |
| Search & Filter | Cari + filter pemasukan/pengeluaran/kategori Iuran |
| Upload Foto | Disimpan ke Google Drive, URL disimpan di Sheet |
| Export | CSV riwayat transaksi & CSV rekap iuran bulanan |
| Reset Semua Data | Zona Berbahaya di halaman Pengaturan, dikunci PIN 6 digit yang divalidasi di server |

---

## Backend: Google Apps Script

Kode lengkap ada di [`backend/Code.gs`](backend/Code.gs) — tinggal copy-paste ke Apps Script editor (lihat langkah setup di atas). Isinya meng-cover semua action berikut lewat satu endpoint `doPost`:

- `login`
- `getTransactions`, `addTransaction`, `updateTransaction`, `deleteTransaction`
- `getMembers`, `addMember`, `updateMember`, `deleteMember`
- `getIuran`, `setIuranPaid`, `setIuranUnpaid`
- `resetAllData` (dikunci PIN — lihat bagian Keamanan di bawah)

`setIuranPaid` idempotent — dipanggil dua kali untuk anggota+tanggal yang sama akan meng-update entri yang sudah ada, bukan bikin duplikat. `setIuranUnpaid` menghapus baris iuran **dan** transaksi kas yang ter-link, jadi saldo tidak pernah nyasar.

---

## Testing

Logika murni (kalkulasi rekap, format uang/tanggal, dsb) dipisah dari DOM ke `js/utils.js` dan `js/calc.js`, supaya bisa diuji tanpa browser:

```bash
npm test
```

Menjalankan 22 unit test (Node built-in test runner, tanpa dependency tambahan) yang meng-cover:
- Format mata uang & tanggal, termasuk edge case (input bukan angka, zona waktu lokal vs UTC).
- `daysInMonth` termasuk tahun kabisat.
- Escape HTML (XSS-safety) untuk nama transaksi/anggota yang dirender ke DOM.
- Rekap transaksi (income/expense/balance).
- Rekap iuran per tanggal (siapa lunas, siapa belum, total terkumpul), termasuk kasus tanpa anggota aktif (hindari divide-by-zero).
- Matrix bulanan (siapa bayar tanggal berapa) dan ranking "paling sering nunggak".
- Validasi format PIN reset (6 digit, hanya angka) untuk kondisi normal maupun edge case (kosong, kepanjangan, huruf).

Backend Apps Script tidak bisa dijalankan lewat `npm test` (butuh runtime Google), tapi seluruh file `.gs` disyntax-check dengan `node --check` sebelum dikirim, dan setiap HTML divalidasi dengan validator W3C (`html5validator`) — nol error struktural pada seluruh halaman.

---

## Catatan Penting

- **Keamanan**: Karena `Who has access = Anyone`, siapa pun yang punya URL Web App bisa memanggil API. Untuk personal/komunitas kecil ini cukup, tapi **jangan bagikan URL ke publik**. Pakai password/PIN ter-hash (`sha256:...` di Config) alih-alih plaintext untuk perlindungan tambahan — meski begini pun ini bukan sistem auth tingkat produksi (tidak ada rate-limiting, tidak ada token per-sesi di sisi server). Untuk kas komunitas dengan nilai besar, pertimbangkan solusi dengan auth yang lebih serius.
- **PIN Reset Data**: Default-nya `014715` kalau kolom `Config!C2` kosong/tidak ada. **Sangat disarankan ganti** — siapa pun yang tahu PIN default bisa menghapus semua data kas kamu. PIN divalidasi di server (`Code.gs`), bukan cuma di JavaScript frontend, jadi tidak bisa dilewatin dengan baca source code lalu manggil API langsung.
- **Foto**: Disimpan di folder `FinanceApp_Photos` di Google Drive milik akun yang deploy script. URL-nya bersifat public (anyone with link). Foto ikut terhapus saat reset data.
- **Offline**: Aplikasi membutuhkan koneksi internet karena data ada di Google Sheets.
- **Kuota Apps Script**: Wajar untuk pemakaian personal/komunitas kecil (puluhan-ratusan anggota). Untuk skala sangat besar (ribuan entri iuran per bulan), pertimbangkan migrasi ke database sungguhan.

---

## Kustomisasi Cepat

| Yang ingin diubah | File / Tempat |
|---|---|
| Warna aksen | `css/style.css` → `--accent` |
| Username & password | Sheet `Config` (plaintext atau `sha256:...`) |
| PIN reset data | Sheet `Config` kolom C (plaintext atau `sha256:...`), default `014715` |
| Daftar kategori transaksi | `dashboard.html` & `riwayat.html` → `<select id="tx-category">` |
| URL backend | `js/api.js` → `SCRIPT_URL` |
| Durasi sesi login | `js/auth.js` → `SESSION_TTL_MS` |
| Timeout request API | `js/api.js` → `REQUEST_TIMEOUT_MS` |

---

Dibuat dengan pure HTML/CSS/JS — ringan, cepat, mudah dikembangkan.
