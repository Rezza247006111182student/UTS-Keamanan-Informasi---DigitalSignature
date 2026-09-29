# PROJECT CONTEXT — Aplikasi Digital Signature (UTS Keamanan Informasi)

> **UNTUK AI CODING AGENT**: Baca seluruh file ini sebelum menulis kode apa pun.
> Ini adalah tugas kelompok beranggotakan 3 orang, dan **setiap anggota
> mengerjakan modul yang berbeda secara terpisah**. Aturan paling penting:
> **JANGAN mengerjakan atau mengubah kode di luar modul yang menjadi
> tanggung jawab anggota yang sedang meminta bantuanmu saat ini.**
> Di awal setiap sesi baru, tanyakan ke user: *"Kamu sedang mengerjakan
> sebagai Anggota A, B, atau C?"* jika belum jelas dari konteks, lalu
> batasi seluruh bantuanmu hanya ke modul milik anggota itu (lihat
> Bagian 4).

---

## 1. RINGKASAN PROJECT

- **Mata kuliah**: Keamanan Informasi — UTS
- **Topik**: Topik 4 (D) — Aplikasi Digital Signature
- **Fungsi inti aplikasi**:
  1. User bisa membuat pasangan kunci (keygen)
  2. User bisa menandatangani dokumen PDF secara digital (sign)
  3. Tanda tangan disematkan ke dokumen lewat QR-Code
  4. Siapa pun bisa memverifikasi keaslian & keutuhan dokumen lewat scan QR-Code (verify)
- **Fitur pengayaan yang dipilih**: **Multi-signer** (satu dokumen bisa ditandatangani lebih dari satu orang, verifikasi mengecek semua tanda tangan)
- **Algoritma tanda tangan**: pilih **SATU** dari RSA-PSS (2048-bit) / ECDSA (P-256) / Ed25519, dipakai konsisten di seluruh sistem. *(isi di sini algoritma final yang dipilih: Ed25519)*
- **Jumlah anggota kelompok**: 3 orang (Anggota A, B, C — lihat Bagian 4)
- **Konsep dasar yang WAJIB dipegang teguh**:
  - Digital signature **BUKAN enkripsi** — dokumen tetap terbuka/terbaca, yang dijamin adalah *integritas* (belum diubah) dan *autentikasi* (siapa penandatangannya).
  - Private key dipakai untuk **membuat** signature, hanya boleh dipegang penandatangan.
  - Public key dipakai untuk **memverifikasi** signature, boleh disebar bebas.
  - Private key **TIDAK PERNAH** disimpan plaintext — selalu terenkripsi dengan passphrase milik user (turunan lewat scrypt/PBKDF2/Argon2 → AES).
  - User **TIDAK PERNAH** melihat/copy isi private key mentahnya. Yang user input adalah passphrase; dekripsi terjadi sementara di server saat proses sign, lalu dibuang dari memori.

---

## 2. TECH STACK (WAJIB DIIKUTI, JANGAN GANTI TANPA PERSETUJUAN TIM)

| Kebutuhan | Teknologi |
|---|---|
| Framework utama | Next.js (React) — App Router, sekaligus untuk frontend & backend (API Routes / Route Handlers) |
| Styling | Tailwind CSS |
| Backend logic | Route Handlers Next.js (`/app/api/...`) — **tidak pakai Express terpisah** |
| Database & Auth | Supabase (Postgres + Supabase Auth + Supabase Storage untuk file dokumen) |
| Kriptografi (keygen/sign/verify/enkripsi) | `node:crypto` (built-in Node.js) — TIDAK perlu install library kripto eksternal |
| Generate QR-Code | `qrcode` (npm) |
| Baca/scan QR-Code | `jsqr` (npm) |
| Manipulasi PDF (embed QR ke halaman) | `pdf-lib` (npm) |
| Unit testing | `vitest` |
| Ekspor data pengujian ke Excel | `exceljs` (ExcelJS) + `jszip` — ekspor XLSX beserta grafik native Excel. *Disetujui tim pada fase finalisasi sebagai pengganti `xlsx` (SheetJS), karena SheetJS tidak dapat menyisipkan grafik native ke dalam file Excel.* |
| Deployment | Vercel (Next.js) + Supabase (sudah hosted) |

**Larangan teknis (berlaku untuk SEMUA modul, cek ulang sebelum commit):**
- Jangan hardcode key, password, API key, atau connection string apa pun langsung di kode. Semua lewat `.env` (dan `.env` WAJIB ada di `.gitignore`).
- Jangan pakai algoritma usang (MD5, SHA-1, DES, RC4, mode ECB) sebagai bagian dari fitur keamanan utama. Boleh dipakai HANYA sebagai contoh pembanding di kode/laporan, dengan komentar jelas bahwa itu contoh algoritma lemah.
- Jangan pakai `Math.random()` untuk apa pun yang berkaitan dengan kunci/salt/IV/nonce — selalu pakai CSPRNG (`crypto.randomBytes`, `crypto.randomUUID`, dsb).

---

## 3. STRUKTUR FOLDER PROJECT

```
/app
  /api
    /keygen/route.ts        <- Modul A
    /sign/route.ts          <- Modul A
    /verify/route.ts        <- Modul A
    /auth/...                <- Modul B (atau pakai Supabase Auth langsung dari client)
    /documents/route.ts     <- Modul C
  /dashboard/page.tsx       <- Modul C
  /sign/page.tsx            <- Modul C (UI, panggil API Modul A)
  /verify/page.tsx          <- Modul C (UI, panggil API Modul A)
  /login/page.tsx           <- Modul B
  /register/page.tsx        <- Modul B
/lib
  /crypto
    keygen.ts               <- Modul A
    sign.ts                 <- Modul A
    verify.ts               <- Modul A
    hash.ts                 <- Modul A
  /keystore
    encryptPrivateKey.ts    <- Modul B
    decryptPrivateKey.ts    <- Modul B
  /auth
    session.ts              <- Modul B
  /qrcode
    generateQr.ts           <- Modul C
    parseQr.ts              <- Modul C
  /pdf
    embedQrToPdf.ts         <- Modul C
  /db
    schema.sql              <- Modul B (skema awal) + Modul B (tambahan skema multi-signer)
/tests
  crypto.test.ts            <- Modul A (3 unit test)
  keystore.test.ts          <- Modul B (3 unit test)
  qrcode.test.ts            <- Modul C (3 unit test)
/benchmark
  runBenchmark.ts           <- Modul C (ekspor hasil ke CSV/XLSX)
.env.example
.gitignore
README.md
CONTRACT.md                  <- lihat Bagian 5
```

> Catatan untuk AI agent: kalau kamu diminta bantu oleh Anggota A, **hanya
> sentuh file di dalam `/lib/crypto`, `/app/api/keygen`, `/app/api/sign`,
> `/app/api/verify`, dan `/tests/crypto.test.ts`**. Pola yang sama berlaku
> untuk B dan C sesuai tabel Bagian 4. Kalau kode kamu perlu memanggil
> fungsi dari modul lain, panggil lewat **kontrak fungsi** di Bagian 5 —
> jangan menulis ulang atau mengubah isi modul tersebut.

---

## 4. PEMBAGIAN TUGAS PER ANGGOTA (BATASAN KETAT — WAJIB DIPATUHI)

### ANGGOTA A — Modul Kriptografi Inti
**Fitur yang dikerjakan:**
- Keygen: bangkitkan pasangan kunci (algoritma sesuai Bagian 1)
- Hash dokumen (SHA-256)
- Fungsi sign: tandatangani hash dengan private key
- Fungsi verify dasar: cek signature valid/tidak dengan public key

**File yang BOLEH disentuh:** `/lib/crypto/*`, `/app/api/keygen/*`, `/app/api/sign/*`, `/app/api/verify/*`, `/tests/crypto.test.ts`

**Unit test wajib (3):**
1. `test_keygen_menghasilkan_pasangan_kunci_valid`
2. `test_sign_verify_dokumen_asli_berhasil`
3. `test_verify_gagal_dengan_kunci_salah`

**Tugas tambahan:** membantu integrasi Multi-signer di sisi logic sign berulang (bekerja sama dengan Anggota B di hari integrasi, lihat Bagian 7)

**DILARANG:** mengubah skema database, logic enkripsi private key, logic auth/login, logic QR-Code/PDF, atau tampilan dashboard. Kalau butuh menyimpan/mengambil data dari database, panggil fungsi yang disediakan Anggota B lewat kontrak di Bagian 5 — jangan menulis query database sendiri.

---

### ANGGOTA B — Modul Keamanan Penyimpanan & Auth
**Fitur yang dikerjakan:**
- Enkripsi & dekripsi private key (passphrase → scrypt/Argon2 → AES)
- Login, register, session management (via Supabase Auth)
- Skema database (tabel `users`, `documents`, dan tabel relasi untuk Multi-signer)

**File yang BOLEH disentuh:** `/lib/keystore/*`, `/lib/auth/*`, `/app/api/auth/*`, `/app/login/*`, `/app/register/*`, `/lib/db/schema.sql`, `/tests/keystore.test.ts`

**Unit test wajib (3):**
1. `test_privatekey_terenkripsi_di_database`
2. `test_dekripsi_gagal_dengan_passphrase_salah`
3. `test_login_gagal_dengan_kredensial_salah`

**Tugas tambahan:** merancang skema data & logic Multi-signer (tabel relasi dokumen-ke-banyak-signer, fungsi untuk menyimpan/mengambil banyak signature per dokumen)

**DILARANG:** mengubah logic keygen/sign/verify (itu milik A), mengubah logic QR-Code/PDF (itu milik C), atau membuat tampilan dashboard/halaman dokumen (itu milik C). Kalau butuh data hasil sign, panggil fungsi Anggota A lewat kontrak Bagian 5.

---

### ANGGOTA C — Modul QR-Code & Integrasi Dokumen
**Fitur yang dikerjakan:**
- Generate QR-Code berisi metadata + signature
- Parse/baca ulang QR-Code saat verifikasi
- Embed QR-Code ke dokumen PDF
- Dashboard & halaman riwayat dokumen
- Halaman UI untuk sign & verify (memanggil API milik Modul A)

**File yang BOLEH disentuh:** `/lib/qrcode/*`, `/lib/pdf/*`, `/app/dashboard/*`, `/app/sign/*`, `/app/verify/*`, `/app/api/documents/*`, `/tests/qrcode.test.ts`, `/benchmark/*`

**Unit test wajib (3):**
1. `test_verify_gagal_jika_dokumen_diubah_1_byte`
2. `test_verify_gagal_jika_qr_dipalsukan`
3. `test_qr_berisi_metadata_lengkap`

**Tugas tambahan:** script benchmark (ukur waktu sign/verify 30x + ukuran signature/kunci publik), ekspor hasil ke CSV/XLSX; deploy aplikasi ke Vercel di akhir project

**DILARANG:** mengubah logic kriptografi inti (itu milik A) atau logic enkripsi kunci/auth (itu milik B). QR-Code hanya boleh **memanggil** hasil sign dari A dan status login dari B, tidak boleh mengimplementasi ulang fungsi itu di dalam modul QR.

---

## 5. KONTRAK ANTAR-MODUL (interface yang harus disepakati & tidak boleh diubah sepihak)

> AI agent: kalau salah satu anggota minta mengubah salah satu signature
> fungsi di bawah ini, ingatkan bahwa perubahan ini akan berdampak ke
> modul anggota lain dan harus didiskusikan bertiga dulu sebelum diubah.

```typescript
// Disediakan oleh Anggota A, dipakai oleh B dan C
function generateKeyPair(): { publicKey: string; privateKey: string }
function signDocumentHash(hash: string, privateKey: string): string // return: signature base64
function verifySignature(hash: string, signature: string, publicKey: string): boolean

// Disediakan oleh Anggota B, dipakai oleh A (tidak langsung) dan C
function encryptPrivateKey(rawPrivateKey: string, passphrase: string): string // return: ciphertext base64
function decryptPrivateKey(ciphertext: string, passphrase: string): string // return: raw private key, HANYA dipakai sementara di memori
function getCurrentUser(): { id: string; publicKey: string } | null

// Disediakan oleh Anggota C, dipakai oleh A dan B (tidak langsung)
function generateQrPayload(data: { signature: string; publicKey: string; signerName: string; role: string; date: string; institution: string }): string // return: QR image (base64/buffer)
function parseQrPayload(qrImage: Buffer): { signature: string; publicKey: string; signerName: string; role: string; date: string; institution: string }
```

**Format data yang disepakati bertiga:**
- Signature selalu dalam format **base64 string**
- Public/private key dalam format **PEM string** (hasil default `node:crypto`)
- Payload QR-Code berupa **JSON string** sebelum di-encode jadi gambar QR

---

## 6. FITUR WAJIB, PENGUJIAN WAJIB, DAN KONSTRAIN (RINGKASAN)

Lihat detail lengkap di dokumen ketentuan tugas asli. Ringkasan cepat untuk referensi AI agent saat coding:

**Fitur wajib:** keygen, sign (atas hash SHA-256), verify (tolak dokumen berubah & kunci salah), QR-Code (metadata + signature), private key tersimpan terenkripsi.

**Pengujian wajib:** waktu sign/verify (rata-rata dari 30x), ukuran signature & public key, uji tamper (harus gagal), uji kunci salah (harus gagal), uji QR dipalsukan (harus gagal).

**Konstrain keamanan:** tanpa kunci hardcode/ter-commit, CSPRNG untuk semua randomisasi, tanpa algoritma usang sebagai fitur utama, minimal 5 unit test (di sini: 9 total, 3 per anggota), README lengkap.

---

## 7. TIMELINE 7 HARI (untuk referensi AI agent soal urutan pengerjaan yang wajar)

| Hari | Anggota A | Anggota B | Anggota C |
|---|---|---|---|
| 1 | Setup + keygen | Setup + skema DB | Setup + riset qrcode/jsqr/pdf-lib |
| 2 | Sign + verify dasar (data dummy) | Enkripsi/dekripsi key (data dummy) + UI login/register | Generate QR + embed PDF (data dummy) |
| 3 | Unit test A | Unit test B | Unit test C |
| 4 | **Integrasi**: keygen → enkripsi B, simpan ke DB nyata | (bareng A) | Lanjut alur baca QR → verify (masih dummy) |
| 5 | Bantu integrasi sign/verify asli ke QR | Mulai skema Multi-signer | **Integrasi**: QR ke sign/verify asli |
| 6 | Bantu logic Multi-signer | Selesaikan Multi-signer + integrasi dashboard-auth | Script benchmark + ekspor CSV/XLSX |
| 7 | Uji ulang skenario "harus gagal" bertiga | README bagian instalasi & skema DB | Deploy ke Vercel + rekam video demo |

---

## 8. CATATAN KHUSUS UNTUK AI CODING AGENT

- Tugas ini dinilai dari **riwayat commit tiap anggota** — jangan menulis kode untuk modul yang bukan tanggung jawab anggota yang sedang bicara denganmu saat ini, walaupun secara teknis kamu mampu dan diminta "sekalian saja".
- Kalau user (salah satu anggota) minta bantuan yang menyentuh modul anggota lain, **tanyakan dulu** apakah ini bagian dari sesi integrasi bersama (lihat Bagian 7) atau memang di luar lingkup — jangan asumsikan sendiri.
- Setiap anggota harus **paham** kode yang di-generate untukcnya (bukan cuma commit tanpa dibaca) — kalau diminta, jelaskan kode yang kamu buat dengan bahasa yang mudah dipahami, karena user akan ditanya langsung soal ini saat sidang.
- Jangan pernah menuliskan kunci privat, passphrase, atau credential asli ke dalam kode atau contoh — selalu pakai placeholder/environment variable.
