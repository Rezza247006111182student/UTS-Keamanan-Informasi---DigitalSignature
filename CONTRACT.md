# KONTRAK ANTAR-MODUL (Interface Antar-Anggota)

> **PERHATIAN UNTUK SELURUH ANGGOTA & AI CODING AGENT**:
> File ini adalah salinan resmi Bagian 5 dari `PROJECT_CONTEXT.md`.
> Kontrak interface di bawah ini disepakati bersama dan **TIDAK BOLEH diubah sepihak**.
> Jika salah satu fungsi perlu diubah parameternya atau tipe kembaliannya,
> diskusikan bertiga (Anggota A, B, dan C) terlebih dahulu sebelum mengubahnya.

---

## 1. Definisi Fungsi Antar-Modul

```typescript
// Disediakan oleh Anggota A (Modul Kriptografi Inti), dipakai oleh B dan C
function generateKeyPair(): { publicKey: string; privateKey: string }
function signDocumentHash(hash: string, privateKey: string): string // return: signature base64
function verifySignature(hash: string, signature: string, publicKey: string): boolean

// Disediakan oleh Anggota B (Modul Keamanan Penyimpanan & Auth), dipakai oleh A (tidak langsung) dan C
function encryptPrivateKey(rawPrivateKey: string, passphrase: string): string // return: ciphertext base64
function decryptPrivateKey(ciphertext: string, passphrase: string): string // return: raw private key, HANYA dipakai sementara di memori
function getCurrentUser(): { id: string; publicKey: string } | null

// Disediakan oleh Anggota C (Modul QR-Code & Integrasi Dokumen), dipakai oleh A dan B (tidak langsung)
function generateQrPayload(data: { signature: string; publicKey: string; signerName: string; role: string; date: string; institution: string }): string // return: QR image (base64/buffer)
function parseQrPayload(qrImage: Buffer): { signature: string; publicKey: string; signerName: string; role: string; date: string; institution: string }
```

---

## 2. Format Data yang Disepakati Bersama

- **Signature**: Selalu dalam format **base64 string**.
- **Public & Private Key**: Dalam format **PEM string** (hasil default dari modul built-in `node:crypto`).
- **Payload QR-Code**: Berupa **JSON string** sebelum di-encode menjadi gambar QR.

---

## 3. Matriks Ketergantungan Modul

| Modul | Menyediakan | Menggunakan dari Modul Lain |
|---|---|---|
| **Modul A (Anggota A)** | `generateKeyPair`, `signDocumentHash`, `verifySignature`, hashing SHA-256 | Memanggil interface auth/storage jika diperlukan saat integrasi API |
| **Modul B (Anggota B)** | `encryptPrivateKey`, `decryptPrivateKey`, `getCurrentUser`, skema DB | Menerima public key dan key pair dari Modul A saat registrasi/keygen |
| **Modul C (Anggota C)** | `generateQrPayload`, `parseQrPayload`, PDF embed, UI Pages | Memanggil fungsi sign/verify dari Modul A, memanggil auth/session dari Modul B |
