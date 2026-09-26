import { describe, it, expect } from "vitest";
import { generateQrPayload, dataUrlToBuffer, QrPayloadData } from "../lib/qrcode/generateQr";
import { parseQrPayload } from "../lib/qrcode/parseQr";

/**
 * Unit Test Modul QR-Code & Integrasi Dokumen
 * Tanggung Jawab: Anggota C
 *
 * 3 Unit Test Wajib:
 * 1. test_verify_gagal_jika_dokumen_diubah_1_byte   — tunggu Modul A (signDocumentHash + verifySignature)
 * 2. test_verify_gagal_jika_qr_dipalsukan           — tunggu Modul A (verifySignature)
 * 3. test_qr_berisi_metadata_lengkap                — bisa dikerjakan sekarang (mandiri)
 */

// Data dummy yang mewakili payload QR valid sesuai kontrak CONTRACT.md
const dummyPayload: QrPayloadData = {
  signature:   "c2lnbmF0dXJlZHVtbXliYXNlNjQ=", // base64 string (dummy)
  publicKey:   "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAdummy\n-----END PUBLIC KEY-----",
  signerName:  "Budi Santoso",
  role:        "Dosen Pembimbing",
  date:        "2024-01-15",
  institution: "Universitas Teknologi Surabaya",
};

describe("Modul QR-Code & Integrasi Dokumen (Anggota C)", () => {
  // -------------------------------------------------------------------------
  // Test 1 & 2 — menunggu Modul A selesai (signDocumentHash + verifySignature)
  // -------------------------------------------------------------------------

  it.todo("test_verify_gagal_jika_dokumen_diubah_1_byte");
  // Rencana implementasi:
  // 1. Hash dokumen asli → sign dengan signDocumentHash (Modul A)
  // 2. Generate QR dari payload berisi signature
  // 3. Ubah 1 byte isi dokumen PDF
  // 4. Hash ulang dokumen yang sudah diubah
  // 5. verifySignature(hashBaru, signature, publicKey) → harus false

  it.todo("test_verify_gagal_jika_qr_dipalsukan");
  // Rencana implementasi:
  // 1. Sign dokumen asli → dapatkan signature valid
  // 2. Buat QR palsu dengan signature yang dimanipulasi
  // 3. parseQrPayload(qrPalsu) → ambil signature palsu
  // 4. verifySignature(hashAsli, signaturePalsu, publicKey) → harus false

  // -------------------------------------------------------------------------
  // Test 3 — mandiri, tidak butuh Modul A atau B
  // -------------------------------------------------------------------------

  it("test_qr_berisi_metadata_lengkap", async () => {
    // Langkah 1: generate QR dari payload dummy
    const dataUrl = await generateQrPayload(dummyPayload);

    // Pastikan output adalah Data URL PNG yang valid
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);

    // Langkah 2: konversi Data URL → PNG buffer
    const base64Data = dataUrl.split(",")[1];
    const pngBufferDirect = Buffer.from(base64Data, "base64");

    // Langkah 3: parse QR kembali → harus menghasilkan objek lengkap
    const parsed = parseQrPayload(pngBufferDirect as unknown as Buffer);

    // Verifikasi semua field wajib ada dan nilainya sama persis dengan input
    expect(parsed.signature).toBe(dummyPayload.signature);
    expect(parsed.publicKey).toBe(dummyPayload.publicKey);
    expect(parsed.signerName).toBe(dummyPayload.signerName);
    expect(parsed.role).toBe(dummyPayload.role);
    expect(parsed.date).toBe(dummyPayload.date);
    expect(parsed.institution).toBe(dummyPayload.institution);

    // Verifikasi tidak ada field yang undefined atau kosong
    const fields: (keyof QrPayloadData)[] = [
      "signature", "publicKey", "signerName", "role", "date", "institution",
    ];
    for (const field of fields) {
      expect(parsed[field], `field "${field}" harus ada`).toBeTruthy();
      expect(typeof parsed[field], `field "${field}" harus string`).toBe("string");
    }
  });
});
