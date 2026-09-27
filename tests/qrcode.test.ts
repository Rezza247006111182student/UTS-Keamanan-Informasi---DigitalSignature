import { describe, it, expect } from "vitest";
import { generateQrPayload, dataUrlToBuffer, QrPayloadData } from "../lib/qrcode/generateQr";
import { parseQrPayload } from "../lib/qrcode/parseQr";
import { generateKeyPair } from "../lib/crypto/keygen";
import { signDocumentHash } from "../lib/crypto/sign";
import { verifySignature } from "../lib/crypto/verify";
import { hashDocument } from "../lib/crypto/hash";

/**
 * Unit Test Modul QR-Code & Integrasi Dokumen
 * Tanggung Jawab: Anggota C
 *
 * 3 Unit Test Wajib:
 * 1. test_verify_gagal_jika_dokumen_diubah_1_byte
 * 2. test_verify_gagal_jika_qr_dipalsukan
 * 3. test_qr_berisi_metadata_lengkap
 *
 * Test 1 & 2 menggunakan fungsi Modul A (generateKeyPair, signDocumentHash,
 * verifySignature, hashDocument) sebagai dependensi nyata — bukan mock.
 * Ini memastikan integrasi antara Modul A dan Modul C benar-benar berfungsi.
 */

// ─── Fixture bersama ──────────────────────────────────────────────────────────

// Simulasi isi dokumen PDF sebagai Buffer sederhana (tidak perlu PDF sungguhan
// untuk menguji integritas hash — yang penting adalah byte-level tamper detection)
const DOKUMEN_ASLI = Buffer.from(
  "Ini adalah isi dokumen resmi yang akan ditandatangani secara digital."
);

describe("Modul QR-Code & Integrasi Dokumen (Anggota C)", () => {

  // ─────────────────────────────────────────────────────────────────────────
  // Test 1: Verifikasi HARUS gagal jika dokumen diubah 1 byte setelah sign
  // ─────────────────────────────────────────────────────────────────────────

  it("test_verify_gagal_jika_dokumen_diubah_1_byte", async () => {
    // Step 1: Bangkitkan pasangan kunci (Ed25519) via Modul A
    const { publicKey, privateKey } = generateKeyPair();

    // Step 2: Hash dokumen ASLI → sign → generate QR payload
    const hashAsli = hashDocument(DOKUMEN_ASLI);
    const signature = signDocumentHash(hashAsli, privateKey);

    const qrDataUrl = await generateQrPayload({
      signature,
      publicKey,
      signerName: "Anggota C",
      role: "Penguji",
      date: "2024-01-15",
      institution: "Universitas Test",
    });

    // Step 3: Pastikan signature valid untuk dokumen ASLI (sanity check)
    const hashValid = hashDocument(DOKUMEN_ASLI);
    const sebelumDiubah = verifySignature(hashValid, signature, publicKey);
    expect(sebelumDiubah, "Signature harus valid sebelum dokumen diubah").toBe(true);

    // Step 4: Ubah 1 byte di dokumen (simulasi tamper)
    const dokumenDiubah = Buffer.from(DOKUMEN_ASLI);
    dokumenDiubah[0] = dokumenDiubah[0] ^ 0x01; // flip 1 bit di byte pertama

    // Step 5: Hash dokumen yang sudah diubah → verifikasi HARUS gagal
    const hashDiubah = hashDocument(dokumenDiubah);

    // Hash harus berbeda setelah dokumen diubah (avalanche effect SHA-256)
    expect(hashDiubah, "Hash dokumen yang diubah harus berbeda dari hash asli").not.toBe(hashAsli);

    // Verifikasi dengan hash baru → harus false karena hash tidak cocok dengan signature
    const sesudahDiubah = verifySignature(hashDiubah, signature, publicKey);
    expect(
      sesudahDiubah,
      "Verifikasi HARUS gagal jika dokumen diubah 1 byte — hash tidak cocok dengan signature"
    ).toBe(false);

    // Step 6: Parse QR membuktikan signature di QR tidak berubah
    const base64Data = qrDataUrl.split(",")[1];
    const pngBuffer = Buffer.from(base64Data, "base64");
    const parsed = parseQrPayload(pngBuffer);

    // Signature di QR masih sama persis dengan yang di-sign dari hash asli
    expect(parsed.signature).toBe(signature);

    // Tapi kalau kita coba verify parsed signature dengan hash dokumen yang diubah → gagal
    const verifyParsedTampered = verifySignature(hashDiubah, parsed.signature, parsed.publicKey);
    expect(
      verifyParsedTampered,
      "Signature dari QR juga harus gagal diverifikasi terhadap dokumen yang diubah"
    ).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 2: Verifikasi HARUS gagal jika QR dipalsukan
  // ─────────────────────────────────────────────────────────────────────────

  it("test_verify_gagal_jika_qr_dipalsukan", async () => {
    // Step 1: Sign dokumen asli dengan kunci yang sah
    const { publicKey: publicKeyAsli, privateKey: privateKeyAsli } = generateKeyPair();
    const hashAsli = hashDocument(DOKUMEN_ASLI);
    const signatureAsli = signDocumentHash(hashAsli, privateKeyAsli);

    // Step 2: Penyerang membuat kunci baru sendiri (kunci palsu)
    const { publicKey: publicKeyPalsu, privateKey: privateKeyPalsu } = generateKeyPair();

    // Step 3: Penyerang menandatangani data YANG SAMA dengan kunci palsu
    const signaturePalsu = signDocumentHash(hashAsli, privateKeyPalsu);

    // Step 4: Penyerang generate QR dengan signature palsu + publicKey palsu
    const qrPalsuDataUrl = await generateQrPayload({
      signature: signaturePalsu,
      publicKey: publicKeyPalsu,         // kunci publik palsu
      signerName: "Budi Asli (Palsu)",   // mengklaim nama orang lain
      role: "Direktur",
      date: "2024-01-15",
      institution: "Institusi Asli",
    });

    // Step 5: Parse QR palsu → payload berhasil di-parse (strukturnya valid)
    const base64Data = qrPalsuDataUrl.split(",")[1];
    const pngBuffer = Buffer.from(base64Data, "base64");
    const parsedPalsu = parseQrPayload(pngBuffer);

    // Step 6: Coba verifikasi signature palsu terhadap public key ASLI
    // Ini adalah kasus: "ada yang mengirim QR dengan kunci berbeda"
    const verifyPalsuVsKunciAsli = verifySignature(
      hashAsli,
      parsedPalsu.signature,   // signature dibuat dengan kunci palsu
      publicKeyAsli            // tapi diverifikasi dengan kunci asli → HARUS gagal
    );
    expect(
      verifyPalsuVsKunciAsli,
      "Signature palsu HARUS gagal saat diverifikasi dengan kunci publik asli"
    ).toBe(false);

    // Step 7: Bahkan dengan publicKey di QR palsu, signature tidak cocok untuk dokumen asli
    // karena penyerang tidak punya private key asli
    const verifyPalsuVsKunciPalsu = verifySignature(
      hashAsli,
      signatureAsli,           // signature ASLI
      parsedPalsu.publicKey    // diverifikasi dengan publicKey dari QR palsu → mismatch key
    );
    expect(
      verifyPalsuVsKunciPalsu,
      "Signature asli HARUS gagal saat diverifikasi dengan kunci publik palsu (bukan pasangannya)"
    ).toBe(false);

    // Step 8: Konfirmasi — signature asli valid HANYA dengan kunci asli
    const verifyAsliVsKunciAsli = verifySignature(hashAsli, signatureAsli, publicKeyAsli);
    expect(
      verifyAsliVsKunciAsli,
      "Hanya signature asli + kunci asli yang boleh valid"
    ).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 3: QR harus berisi semua metadata yang lengkap
  // ─────────────────────────────────────────────────────────────────────────

  it("test_qr_berisi_metadata_lengkap", async () => {
    // Data dummy yang mewakili payload QR valid sesuai kontrak CONTRACT.md
    const dummyPayload: QrPayloadData = {
      signature:   "c2lnbmF0dXJlZHVtbXliYXNlNjQ=",
      publicKey:   "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAdummy\n-----END PUBLIC KEY-----",
      signerName:  "Budi Santoso",
      role:        "Dosen Pembimbing",
      date:        "2024-01-15",
      institution: "Universitas Teknologi Surabaya",
    };

    // Generate QR dari payload dummy
    const dataUrl = await generateQrPayload(dummyPayload);
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);

    // Parse QR kembali → harus menghasilkan objek lengkap
    const base64Data = dataUrl.split(",")[1];
    const pngBuffer = Buffer.from(base64Data, "base64");
    const parsed = parseQrPayload(pngBuffer);

    // Verifikasi semua 6 field wajib ada dan nilainya sama persis dengan input
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
