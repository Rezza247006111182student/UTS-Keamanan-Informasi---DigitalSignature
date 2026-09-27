# DESIGN GUIDE — Aplikasi Digital Signature

> **UNTUK AI CODING AGENT & SELURUH ANGGOTA**: File ini adalah acuan visual
> bersama. Siapa pun yang membangun halaman/komponen (Anggota A, B, atau C)
> WAJIB memakai token warna, tipografi, dan pola komponen di file ini —
> jangan menentukan warna/font sendiri di luar yang tercantum di sini.
> Kalau ada kebutuhan token baru yang belum ada, tambahkan ke Bagian 2
> dan beri tahu 2 anggota lain, jangan menambahkan warna/style baru
> secara sepihak di komponen masing-masing.

---

## 1. Konsep & Arah Visual

**Konsep**: dokumen resmi bermeterai digital — bukan tampilan "SaaS startup" generik. Nuansa yang dibangun: presisi, keterpercayaan (*trust*), dan formalitas ala dokumen legal/sertifikat, tapi tetap bersih dan modern (bukan retro/klasik berlebihan).

**Kenapa arah ini, bukan gaya SaaS pada umumnya**: aplikasi ini soal *membuktikan keaslian dokumen* — kesan visualnya harus terasa seperti "meterai/stempel resmi", bukan seperti aplikasi produktivitas biasa. Ini juga otomatis membedakan dari tampilan default AI-generated yang generik (kartu serba bulat dengan shadow abu-abu, warna krem+terracotta, atau hitam+aksen neon).

**Prinsip inti:**
- Latar bersih menyerupai kertas dokumen, bukan gelap/dashboard SaaS.
- Aksen warna emas/kuningan dipakai **terbatas** — hanya untuk elemen "meterai" (QR-Code, badge status, tombol utama), bukan disebar ke semua elemen.
- Status verifikasi (valid/tidak valid) adalah elemen paling penting secara visual — harus tegas & tidak ambigu (hijau vs merah, dengan ikon jelas, bukan cuma teks kecil).
- Tidak ada border-radius besar/kartu serba bulat ala SaaS — pakai garis tegas (hairline border) yang mengesankan dokumen/kertas resmi, bukan bentuk "app modern" biasa.

---

## 2. Design Tokens

### Warna

| Token | Hex | Peran |
|---|---|---|
| `--color-paper` | `#FAF8F2` | Warna latar utama (kesan kertas dokumen) |
| `--color-ink` | `#1B2430` | Warna teks utama & elemen gelap (kesan tinta) |
| `--color-ink-muted` | `#5B6472` | Teks sekunder/keterangan |
| `--color-seal` | `#B08D2F` | Aksen emas — HANYA untuk elemen "meterai": QR-Code frame, tombol utama (sign/verify), badge penting |
| `--color-seal-dark` | `#8A6E22` | Hover/active state dari `--color-seal` |
| `--color-valid` | `#2F6B4F` | Status **berhasil/valid** (verifikasi sukses) |
| `--color-valid-bg` | `#E7F1EB` | Background badge/alert untuk status valid |
| `--color-invalid` | `#A23B32` | Status **gagal/tidak valid** (dokumen berubah, kunci salah, dsb) |
| `--color-invalid-bg` | `#F6E8E6` | Background badge/alert untuk status invalid |
| `--color-border` | `#D8D2C4` | Garis pembatas/hairline border (bukan shadow) |

**Aturan pemakaian:**
- `--color-seal` jangan dipakai untuk teks biasa/link — khusus elemen yang memang "penting & jarang" (supaya tetap terasa seperti aksen, bukan warna dominan).
- `--color-valid` dan `--color-invalid` HANYA untuk status hasil verifikasi — jangan dipakai untuk elemen dekoratif lain, supaya user langsung asosiasikan warna ini dengan hasil keamanan.
- Tidak ada mode gelap (dark mode) untuk versi awal — cukup satu tema terang yang konsisten, supaya tidak menambah kompleksitas di waktu terbatas.

### Tipografi

| Peran | Font | Alasan |
|---|---|---|
| Judul/heading (h1, h2, nama dokumen, hasil verifikasi) | **Source Serif 4** (Google Fonts) | Kesan dokumen resmi/legal, beda dari font sans generik SaaS |
| Body text, label, tombol, form | **IBM Plex Sans** (Google Fonts) | Netral, sangat mudah dibaca di form & data teknis, kontras jelas dengan serif di judul |
| Data teknis (hash, signature, kode) | **IBM Plex Mono** (Google Fonts) | Khusus untuk menampilkan hash/signature/public key supaya jelas ini "data mentah", beda dari teks biasa |

**Skala ukuran (rem, basis 16px):**
```
h1: 2.25rem / weight 600 / line-height 1.2   (Source Serif 4)
h2: 1.5rem  / weight 600 / line-height 1.3   (Source Serif 4)
h3: 1.125rem/ weight 600 / line-height 1.4   (IBM Plex Sans)
body: 1rem  / weight 400 / line-height 1.6   (IBM Plex Sans)
small: 0.875rem / weight 400                 (IBM Plex Sans)
mono: 0.875rem / weight 400                  (IBM Plex Mono)
```

**Larangan tipografi (hindari tell generik AI-generated):**
- Jangan pakai ALL CAPS untuk label kecil (mis. "STATUS DOKUMEN") — pakai sentence case biasa.
- Jangan tambahkan "eyebrow label" tracked-out di atas tiap heading kalau tidak perlu secara informasi.
- Jangan tambahkan tanda panah "→" di akhir teks tombol/link secara default.

### Spacing, Border, & Shadow

- Skala spacing: kelipatan 4px (4, 8, 12, 16, 24, 32, 48, 64).
- Border-radius: **4px saja** untuk semua elemen (input, tombol, panel) — kecil dan tegas, bukan `rounded-2xl` ala kartu SaaS.
- Jangan pakai `box-shadow` lembut abu-abu sebagai default dekorasi kartu. Pemisah antar-elemen pakai `border: 1px solid var(--color-border)` (hairline), bukan shadow. Shadow hanya boleh dipakai untuk elemen yang benar-benar mengambang di atas konten lain (modal, dropdown).

---

## 3. Kode Token Siap Pakai

Tambahkan ke `app/globals.css` (dikerjakan sekali oleh siapa pun yang setup project di Langkah 1, sebelum anggota lain mulai bikin UI):

```css
:root {
  --color-paper: #FAF8F2;
  --color-ink: #1B2430;
  --color-ink-muted: #5B6472;
  --color-seal: #B08D2F;
  --color-seal-dark: #8A6E22;
  --color-valid: #2F6B4F;
  --color-valid-bg: #E7F1EB;
  --color-invalid: #A23B32;
  --color-invalid-bg: #F6E8E6;
  --color-border: #D8D2C4;
  --radius: 4px;
}

body {
  background-color: var(--color-paper);
  color: var(--color-ink);
  font-family: 'IBM Plex Sans', sans-serif;
}

h1, h2 {
  font-family: 'Source Serif 4', serif;
}

.font-mono-data {
  font-family: 'IBM Plex Mono', monospace;
}
```

Tambahkan ke `tailwind.config.ts` supaya semua anggota bisa pakai lewat class Tailwind (`bg-paper`, `text-ink`, `text-seal`, dst) alih-alih menulis hex manual di komponen masing-masing:

```ts
theme: {
  extend: {
    colors: {
      paper: '#FAF8F2',
      ink: { DEFAULT: '#1B2430', muted: '#5B6472' },
      seal: { DEFAULT: '#B08D2F', dark: '#8A6E22' },
      valid: { DEFAULT: '#2F6B4F', bg: '#E7F1EB' },
      invalid: { DEFAULT: '#A23B32', bg: '#F6E8E6' },
      border: '#D8D2C4',
    },
    borderRadius: {
      DEFAULT: '4px',
    },
    fontFamily: {
      serif: ['Source Serif 4', 'serif'],
      sans: ['IBM Plex Sans', 'sans-serif'],
      mono: ['IBM Plex Mono', 'monospace'],
    },
  },
}
```

Jangan lupa import font-nya (Google Fonts) di `app/layout.tsx` pakai `next/font/google`.

---

## 4. Pola Komponen (dipakai konsisten di semua halaman)

### Tombol
- **Primer** (mis. "Tanda tangani dokumen", "Verifikasi"): background `seal`, teks putih, border-radius 4px, tanpa shadow.
- **Sekunder** (mis. "Batal", "Kembali"): border 1px `border`, background transparan, teks `ink`.
- Teks tombol: kata kerja aktif & jelas — "Tanda tangani dokumen" bukan "Submit", "Verifikasi sekarang" bukan "Proses".

### Badge status hasil verifikasi
Ini elemen paling penting di seluruh aplikasi — dipakai oleh Anggota C di halaman verify:
- **Valid**: background `valid-bg`, teks `valid`, ikon centang, teks jelas: "Dokumen asli dan belum diubah"
- **Tidak valid**: background `invalid-bg`, teks `invalid`, ikon silang, teks jelas menyebutkan **alasan spesifik** (bukan cuma "Gagal") — contoh: "Dokumen telah diubah sejak ditandatangani" atau "Kunci publik tidak cocok"

### Panel/Card
- Border 1px `border`, radius 4px, background putih/paper, TANPA shadow.
- Dipakai untuk: form sign, hasil verifikasi, item riwayat dokumen di dashboard.

### Tampilan QR-Code
- QR-Code selalu dibingkai dengan border tipis warna `seal` (mengesankan "meterai") — dipakai konsisten oleh Anggota C di semua tempat QR muncul (halaman sign, dashboard, hasil embed PDF).

### Halaman kosong/error (empty state)
- Contoh: dashboard belum ada dokumen — tulis instruksi jelas apa yang harus dilakukan ("Belum ada dokumen ditandatangani. Unggah dokumen pertamamu untuk mulai."), bukan pesan datar seperti "No data".

---

## 5. Struktur Halaman (konsistensi layout antar anggota)

- Header aplikasi (logo/nama app + navigasi + status login) — dibuat SEKALI oleh Anggota C sebagai layout bersama (`app/layout.tsx`), dipakai semua halaman termasuk milik A dan B. Jangan masing-masing bikin header sendiri di halamannya.
- Lebar konten maksimal: `max-w-2xl` untuk form (sign, login, register), `max-w-4xl` untuk dashboard/riwayat — supaya line-length teks tetap nyaman dibaca, tidak melebar penuh layar.
- Alignment: rata kiri untuk form & teks, bukan center — kesan formulir dokumen resmi biasanya rata kiri, bukan terpusat seperti landing page marketing.

---

## 6. Checklist Konsistensi Sebelum Integrasi

- [ ] Semua warna dipakai lewat token (`bg-seal`, `text-ink`, dst), tidak ada hex manual baru di komponen
- [ ] Semua heading pakai `font-serif`, semua body/form pakai `font-sans`, semua hash/signature pakai `font-mono`
- [ ] Semua tombol primer konsisten warna `seal`, tombol sekunder konsisten outline
- [ ] Badge valid/invalid dipakai sama persis di semua tempat verifikasi muncul (bukan beda gaya antara halaman verify milik C dan mungkin ditampilkan ulang di dashboard)
- [ ] Tidak ada halaman yang pakai border-radius besar/shadow lembut yang beda sendiri dari yang lain
- [ ] Header/navigasi sama di semua halaman (dari layout bersama, bukan dibuat ulang tiap halaman)
