# NaturalSign — Aplikasi Digital Signature Dokumen PDF (UTS Keamanan Informasi)

Aplikasi tanda tangan digital (*digital signature*) untuk dokumen PDF berbasis algoritma kriptografi asimetris dengan penyematan meterai digital melalui QR-Code dan fitur multi-signer. Proyek ini dikembangkan untuk memenuhi tugas Ujian Tengah Semester (UTS) mata kuliah Keamanan Informasi.

---

## Anggota Kelompok

| Peran | Nama | NPM | Modul Tanggung Jawab |
|---|---|---|---|
| **Anggota A** | *(Nama Anggota A)* | *(NPM Anggota A)* | Modul Kriptografi Inti (`/lib/crypto`, `/app/api/keygen`, `/app/api/sign`, `/app/api/verify`, `/tests/crypto.test.ts`) |
| **Anggota B** | *(Nama Anggota B)* | *(NPM Anggota B)* | Modul Keamanan Penyimpanan & Auth (`/lib/keystore`, `/lib/auth`, `/app/api/auth`, `/app/login`, `/app/register`, `/lib/db/schema.sql`, `/tests/keystore.test.ts`) |
| **Anggota C** | *(Nama Anggota C)* | *(NPM Anggota C)* | Modul QR-Code & Integrasi Dokumen (`/lib/qrcode`, `/lib/pdf`, `/app/dashboard`, `/app/sign`, `/app/verify`, `/app/api/documents`, `/tests/qrcode.test.ts`, `/benchmark`) |

---

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, TypeScript)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) (mengikuti token desain pada `DESIGN_GUIDE.md`)
- **Backend**: Next.js Route Handlers (`/app/api/...`)
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL + Supabase Auth + Supabase Storage)
- **Kriptografi**: `node:crypto` (Built-in Node.js CSPRNG, Hashing SHA-256, Asymmetric Keygen/Sign/Verify)
- **QR-Code Generation**: `qrcode`
- **QR-Code Reader / Scanner**: `jsqr`
- **PDF Manipulation**: `pdf-lib`
- **Unit Testing**: `vitest`
- **Benchmark Export**: `xlsx` (SheetJS)

---

## Struktur Folder Project

```
├── app/
│   ├── api/
│   │   ├── auth/          # Modul B: Route autentikasi
│   │   ├── documents/     # Modul C: Route dokumen & upload
│   │   ├── keygen/        # Modul A: Route bangkitkan keypair
│   │   ├── sign/          # Modul A: Route tanda tangan digital
│   │   └── verify/        # Modul A: Route verifikasi signature
│   ├── dashboard/         # Modul C: Halaman riwayat dokumen
│   ├── login/             # Modul B: Halaman masuk
│   ├── register/          # Modul B: Halaman pendaftaran
│   ├── sign/              # Modul C: Halaman form tanda tangan dokumen
│   ├── verify/            # Modul C: Halaman form verifikasi dokumen & QR
│   ├── globals.css        # Styling global & token warna/tipografi
│   ├── layout.tsx         # Root layout bersama (header/navigasi)
│   └── page.tsx           # Halaman utama (beranda)
├── lib/
│   ├── auth/              # Modul B: Session & Supabase auth helper
│   ├── crypto/            # Modul A: Logic keygen, sign, verify, hash
│   ├── db/                # Modul B: DDL SQL skema database (schema.sql)
│   ├── keystore/          # Modul B: Enkripsi & dekripsi private key (AES + KDF)
│   ├── pdf/               # Modul C: Penyematan QR meterai ke file PDF
│   └── qrcode/            # Modul C: Generate & parse QR payload
├── tests/                 # Unit tests (Vitest)
│   ├── crypto.test.ts     # Modul A (3 pengujian wajib)
│   ├── keystore.test.ts   # Modul B (3 pengujian wajib)
│   └── qrcode.test.ts     # Modul C (3 pengujian wajib)
├── benchmark/             # Modul C: Script pengujian performa & ekspor XLSX
├── CONTRACT.md            # Kontrak interface antar-modul
├── .env.example           # Template environment variable
└── README.md              # Dokumentasi proyek
```

---

## Panduan Instalasi & Menjalankan Proyek

### 1. Prasyarat
- **Node.js**: versi 20.x atau lebih baru
- **npm**: versi 10.x atau lebih baru

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
Salin file `.env.example` menjadi `.env.local` atau `.env`:
```bash
cp .env.example .env.local
```
Buka file `.env.local` dan isi kredensial proyek Supabase Anda:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=documents
```

### 5. Setup Database Supabase
Jalankan skrip DDL SQL yang ada pada `lib/db/schema.sql` melalui SQL Editor di dashboard Supabase proyek Anda untuk membuat tabel `users`, `documents`, dan `document_signatures`.

### 6. Menjalankan Server Development
```bash
npm run dev
```
Buka peramban dan akses alamat [http://localhost:3000](http://localhost:3000).

### 7. Menjalankan Unit Test
```bash
npm run test
```

---

## Aturan Kolaborasi Tim

1. **Batas Modul**: Setiap anggota hanya bekerja pada file di dalam cakupan modul masing-masing (lihat pembagian tugas di atas).
2. **Kontrak Antar-Modul**: Rujuk file `CONTRACT.md` untuk memanggil fungsi dari modul lain. Jangan mengubah signature fungsi kontrak tanpa kesepakatan bertiga.
3. **Keamanan**:
   - Dilarang keras melakukan commit file `.env`, kunci privat mentah (`.pem`, `.key`), atau credential sensitif ke repository.
   - Semua fungsi acak/salt/IV wajib menggunakan CSPRNG (`node:crypto`).
