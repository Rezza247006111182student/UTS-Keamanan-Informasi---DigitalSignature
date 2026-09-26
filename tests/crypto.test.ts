import { describe, it, expect } from "vitest";
import { generateKeyPair } from "../lib/crypto/keygen";
import { hashDocument } from "../lib/crypto/hash";
import { signDocumentHash } from "../lib/crypto/sign";
import { verifySignature } from "../lib/crypto/verify";

/**
 * Unit Test Modul Kriptografi Inti
 * Tanggung Jawab: Anggota A
 *
 * 3 Unit Test Wajib:
 * 1. test_keygen_menghasilkan_pasangan_kunci_valid
 * 2. test_sign_verify_dokumen_asli_berhasil
 * 3. test_verify_gagal_dengan_kunci_salah
 */

describe("Modul Kriptografi Inti (Anggota A)", () => {
  it("test_keygen_menghasilkan_pasangan_kunci_valid", () => {
    const keyPair1 = generateKeyPair();

    expect(keyPair1).toBeDefined();
    expect(typeof keyPair1.publicKey).toBe("string");
    expect(typeof keyPair1.privateKey).toBe("string");

    // Format PEM check
    expect(keyPair1.publicKey).toContain("-----BEGIN PUBLIC KEY-----");
    expect(keyPair1.publicKey).toContain("-----END PUBLIC KEY-----");
    expect(keyPair1.privateKey).toContain("-----BEGIN PRIVATE KEY-----");
    expect(keyPair1.privateKey).toContain("-----END PRIVATE KEY-----");

    // CSPRNG uniqueness check (setiap pemanggilan menghasilkan pasangan kunci unik)
    const keyPair2 = generateKeyPair();
    expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
    expect(keyPair1.privateKey).not.toBe(keyPair2.privateKey);
  });

  it("test_sign_verify_dokumen_asli_berhasil", () => {
    const keyPair = generateKeyPair();
    const documentBuffer = Buffer.from(
      "Dokumen Resmi Surat Keputusan UTS Keamanan Informasi NaturalSign 2026"
    );

    // 1. Hitung hash dokumen
    const hash = hashDocument(documentBuffer);
    expect(hash).toHaveLength(64); // 64 karakter hex string (SHA-256)
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);

    // 2. Tandatangani hash dengan private key
    const signature = signDocumentHash(hash, keyPair.privateKey);
    expect(typeof signature).toBe("string");
    expect(signature.length).toBeGreaterThan(0);

    // 3. Verifikasi tanda tangan dengan public key yang cocok
    const isValid = verifySignature(hash, signature, keyPair.publicKey);
    expect(isValid).toBe(true);
  });

  it("test_verify_gagal_dengan_kunci_salah", () => {
    const keyPairA = generateKeyPair();
    const keyPairB = generateKeyPair(); // Kunci pihak lain

    const documentBuffer = Buffer.from("Dokumen Asli Anggota A");
    const hash = hashDocument(documentBuffer);

    // Dokumen ditandatangani oleh A
    const signatureA = signDocumentHash(hash, keyPairA.privateKey);

    // Diverifikasi menggunakan public key milik B -> WAJIB GAGAL (false)
    const isValid = verifySignature(hash, signatureA, keyPairB.publicKey);
    expect(isValid).toBe(false);
  });

  it("test_verify_gagal_jika_dokumen_diubah", () => {
    const keyPair = generateKeyPair();
    const originalDoc = Buffer.from("Dokumen Asli Sebelum Tampering");
    const originalHash = hashDocument(originalDoc);

    const signature = signDocumentHash(originalHash, keyPair.privateKey);

    // Dokumen diubah 1 karakter
    const tamperedDoc = Buffer.from("Dokumen Asli Sebelum Tampering!");
    const tamperedHash = hashDocument(tamperedDoc);

    const isValid = verifySignature(tamperedHash, signature, keyPair.publicKey);
    expect(isValid).toBe(false);
  });

  it("test_verify_gagal_jika_signature_korup_atau_malformed", () => {
    const keyPair = generateKeyPair();
    const hash = hashDocument(Buffer.from("Dokumen Uji"));

    expect(verifySignature(hash, "signature-palsu-acak", keyPair.publicKey)).toBe(false);
    expect(verifySignature(hash, "", keyPair.publicKey)).toBe(false);
    expect(verifySignature(hash, "ZmFrZXNpZ25hdHVyZQ==", "invalid-public-key")).toBe(false);
  });
});

