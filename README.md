# NaturalSign — Aplikasi Digital Signature Dokumen PDF (UTS Keamanan Informasi)

Aplikasi tanda tangan digital (*digital signature*) untuk dokumen PDF berbasis algoritma kriptografi asimetris dengan penyematan meterai digital melalui QR-Code dan fitur multi-signer. Proyek ini dikembangkan untuk memenuhi tugas Ujian Tengah Semester (UTS) mata kuliah Keamanan Informasi.

---

## Anggota Kelompok

| Peran | Nama | NPM | Modul Tanggung Jawab |
|---|---|---|---|
| **Anggota A** | M. Gibran Fajar | 247006111181 | Modul Kriptografi Inti (`/lib/crypto`, `/app/api/keygen`, `/app/api/sign`, `/app/api/verify`, `/tests/crypto.test.ts`) |
| **Anggota B** | Muhammad Rezza | 247006111182 | Modul Keamanan Penyimpanan & Auth (`/lib/keystore`, `/lib/auth`, `/app/api/auth`, `/app/login`, `/app/register`, `/lib/db/schema.sql`, `/tests/keystore.test.ts`) |
| **Anggota C** | Sammi Zaki Fadillah | 247006111187 | Modul QR-Code & Integrasi Dokumen (`/lib/qrcode`, `/lib/pdf`, `/app/dashboard`, `/app/sign`, `/app/verify`, `/app/api/documents`, `/tests/qrcode.test.ts`, `/benchmark`) |

---

## Algoritma Kriptografi

| Kebutuhan | Algoritma | Keterangan |
|---|---|---|
| Tanda tangan digital | **Ed25519** | Elliptic curve digital signature — kunci 32 byte, signature 64 byte, sangat cepat & aman |
| Hashing dokumen | **SHA-256** | Hash dokumen PDF sebelum ditandatangani |
| Enkripsi private key | **AES-256-GCM** | Authenticated encryption — menjamin kerahasiaan sekaligus integritas data |
| Derivasi kunci dari passphrase | **scrypt** (N=16384, r=8, p=1) | KDF modern, tahan serangan brute-force & GPU |
| Randomisasi (salt, IV, nonce) | **CSPRNG** (`node:crypto`) | Tidak pernah memakai `Math.random()` |

> **Catatan penting**: private key **tidak pernah disimpan plaintext**. Yang tersimpan di database hanya ciphertext AES-256-GCM yang hanya bisa dibuka dengan passphrase milik user. Passphrase tidak pernah dikirim, disimpan, atau di-log di server.

---

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, TypeScript)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) (mengikuti token desain pada `DESIGN_GUIDE.md`)
- **Backend**: Next.js Route Handlers (`/app/api/...`)
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL + Supabase Auth + Supabase Storage)
- **Kriptografi**: `node:crypto` (built-in Node.js — Ed25519 keygen/sign/verify, SHA-256, AES-256-GCM, scrypt)
- **QR-Code Generation**: `qrcode`
- **QR-Code Reader / Scanner**: `jsqr`
- **PDF Manipulation**: `pdf-lib`
- **Unit Testing**: `vitest`
- **Benchmark Export**: `exceljs` (ExcelJS) + `jszip` — ekspor hasil pengujian ke CSV/XLSX lengkap dengan grafik native Excel (menggantikan `xlsx`/SheetJS yang tidak mendukung penyisipan grafik native)

---

## Struktur Folder Project

```
├── app/
│   ├── api/
│   │   ├── auth/          # Modul B: register, login, logout, setup-key, provision-key
│   │   ├── documents/     # Modul C: simpan metadata, verify multi-signer, update-path, update-payload
│   │   ├── keygen/        # Modul A: bangkitkan keypair Ed25519
│   │   ├── sign/          # Modul A: tanda tangan digital (hash → sign)
│   │   └── verify/        # Modul A: verifikasi signature
│   ├── dashboard/         # Modul C: riwayat dokumen user & fitur unduh PDF dari Supabase Storage
│   ├── login/             # Modul B: halaman masuk (+ backfill key untuk user lama)
│   ├── register/          # Modul B: halaman daftar + langsung generate keypair
│   ├── sign/              # Modul C: form unggah, embed QR berlapis (append), & tanda tangan dokumen
│   ├── verify/            # Modul C: form verifikasi dokumen & auto-convert gambar non-PNG via Canvas API
│   ├── globals.css        # Token warna, tipografi, dan styling global
│   ├── layout.tsx         # Root layout bersama (header navigasi)
│   └── page.tsx           # Halaman beranda
├── lib/
│   ├── auth/              # Modul B: Supabase client, session, AuthHeader, RequireAuth
│   ├── crypto/            # Modul A: keygen (Ed25519), sign, verify, hash (SHA-256)
│   ├── db/                # Modul B: schema.sql (DDL) + signatures.ts (helper multi-signer)
│   ├── keystore/          # Modul B: encryptPrivateKey, decryptPrivateKey (AES-256-GCM + scrypt)
│   ├── pdf/               # Modul C: embed QR ke halaman PDF
│   └── qrcode/            # Modul C: generate & parse payload QR
├── tests/
│   ├── crypto.test.ts     # Modul A — 3 unit test wajib
│   ├── keystore.test.ts   # Modul B — 3 unit test wajib
│   └── qrcode.test.ts     # Modul C — 3 unit test wajib
├── benchmark/             # Modul C: script performa (30x sign/verify) + ekspor XLSX
├── CONTRACT.md            # Kontrak interface antar-modul (jangan ubah sepihak)
├── .env.example           # Template environment variable
└── README.md
```

---

## Skema Database

Skema lengkap ada di [`lib/db/schema.sql`](lib/db/schema.sql). Tiga tabel utama:

| Tabel | Fungsi |
|---|---|
| `public.users` | Profil pengguna, terhubung ke Supabase Auth. Menyimpan `public_key` (PEM) dan `encrypted_private_key` (ciphertext AES-256-GCM — **tidak pernah plaintext**) |
| `public.documents` | Metadata dokumen PDF: judul, path file di Supabase Storage (`file_path`), hash SHA-256 dokumen asli, dan status penandatanganan |
| `public.document_signatures` | Relasi multi-signer — satu dokumen bisa ditandatangani banyak orang. Menyimpan signature base64, snapshot nama/jabatan/institusi signer, dan JSON `qr_payload` utuh |

**Fitur keamanan database:**
- **Row Level Security (RLS)** aktif di semua tabel — user hanya bisa membaca & mengubah data miliknya sendiri; `encrypted_private_key` tidak pernah bisa dibaca user lain
- **View `public_signers`** — mengekspos `public_key` untuk keperluan verifikasi tanpa membocorkan `encrypted_private_key` (RLS per-baris tidak bisa memfilter per-kolom, view ini solusinya)
- **Trigger `handle_new_user()`** — otomatis membuat profil `public.users` setiap ada user baru di Supabase Auth (aman saat email confirmation aktif karena berjalan di luar RLS)
- **Trigger `set_updated_at()`** — memperbarui kolom `updated_at` secara otomatis

---

## Panduan Instalasi & Menjalankan Proyek

### 1. Prasyarat
- **Node.js** versi 20.x atau lebih baru
- **npm** versi 10.x atau lebih baru
- Akun [Supabase](https://supabase.com/) (tier gratis cukup)

### 2. Clone Repository
```bash
git clone https://github.com/Rezza247006111182student/UTS-Keamanan-Informasi---DigitalSignature.git
cd UTS-Keamanan-Informasi---DigitalSignature
```

### 3. Install Dependency
```bash
npm install
```

### 4. Konfigurasi Environment Variables
Salin file `.env.example` menjadi `.env.local`:
```bash
cp .env.example .env.local
```
Isi kredensial Supabase di `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=documents
```
Nilai-nilai ini ada di **Supabase Dashboard → Project Settings → API**.

### 5. Setup Database Supabase
1. Buka **Supabase Dashboard → SQL Editor → New query**
2. Tempel seluruh isi file `lib/db/schema.sql`
3. Klik **Run**

Skrip ini membuat tabel `users`, `documents`, `document_signatures`, trigger `handle_new_user` & `set_updated_at`, view `public_signers`, dan seluruh policy RLS.

> Skrip ini **idempotent** — aman dijalankan berulang kali tanpa merusak data yang sudah ada.

### 6. Setup Supabase Storage
1. Buka **Supabase Dashboard → Storage → New bucket**
2. Buat bucket dengan nama persis: `documents`
3. Set bucket sebagai **Private** (bukan public)

Akses file dikontrol melalui RLS dan signed URL di sisi server — bukan URL publik langsung.

### 7. Menjalankan Server Development
```bash
npm run dev
```
Buka [http://localhost:3000](http://localhost:3000) di peramban.

### 8. Menjalankan Unit Test

**Semua modul sekaligus:**
```bash
npm run test
```

**Per modul:**
```bash
# Modul A — Kriptografi Inti (tidak butuh koneksi Supabase)
npx vitest run tests/crypto.test.ts

# Modul B — Keystore & Auth
# Butuh: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
npx vitest run tests/keystore.test.ts

# Modul C — QR-Code & Dokumen
npx vitest run tests/qrcode.test.ts
```

> **Catatan Modul B**: Test 1 (`test_privatekey_terenkripsi_di_database`) dan Test 3 (`test_login_gagal_dengan_kredensial_salah`) memerlukan koneksi internet ke Supabase dan `.env.local` yang sudah terisi lengkap. Test 1 memiliki timeout 30 detik karena melibatkan beberapa round-trip jaringan ke Supabase Auth & Postgres.

---

## Alur Penggunaan Aplikasi

### 1. Mendaftar & Membuat Kunci Digital
1. Buka halaman **Daftar** (`/register`)
2. Isi nama lengkap, email, institusi, jabatan, kata sandi akun, dan **passphrase kunci digital**
3. Klik **Daftar akun baru** — sistem otomatis membangkitkan pasangan kunci Ed25519 dan menyimpan private key terenkripsi (AES-256-GCM) di database
4. Passphrase **tidak pernah disimpan** — hanya dipakai sesaat di server untuk enkripsi lalu langsung dibuang dari memori

### 2. Menandatangani Dokumen
1. Masuk ke akun (`/login`) lalu buka **Tanda Tangani** (`/sign`)
2. Unggah file PDF dan masukkan passphrase kunci digital
3. Sistem menjalankan: hash dokumen (SHA-256) → dekripsi private key sementara → buat signature Ed25519 → embed QR meterai ke PDF → simpan ke database → buang private key dari memori
4. Unduh PDF bermeterai

### 3. Memverifikasi Dokumen
1. Buka **Verifikasi** (`/verify`) — **tidak perlu login**
2. Unggah PDF bermeterai atau scan QR-Code
3. Sistem membaca payload QR, mengambil public key penandatangan dari `public_signers`, dan memverifikasi signature Ed25519
4. Hasil ditampilkan tegas: **"Dokumen asli dan belum diubah"** atau **"Verifikasi gagal"** beserta alasan spesifik

---

## Aturan Kolaborasi Tim

1. **Batas Modul**: Setiap anggota hanya mengerjakan file dalam cakupan modulnya (lihat tabel di atas).
2. **Kontrak Antar-Modul**: Rujuk `CONTRACT.md` untuk memanggil fungsi dari modul lain. Jangan mengubah signature fungsi kontrak tanpa kesepakatan bertiga.
3. **Keamanan**:
   - Dilarang commit file `.env`, private key mentah (`.pem`, `.key`), atau credential sensitif ke repository.
   - Semua salt/IV/nonce wajib menggunakan CSPRNG (`node:crypto`) — dilarang `Math.random()`.
   - Private key tidak boleh dikembalikan ke sisi client atau disimpan plaintext di database.
