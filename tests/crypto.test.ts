import { describe, it, expect } from "vitest";
import { generateKeyPair } from "../lib/crypto/keygen";
import { hashDocument } from "../lib/crypto/hash";
import { signDocumentHash } from "../lib/crypto/sign";
import { verifySignature } from "../lib/crypto/verify";
import { encryptPrivateKey } from "../lib/keystore/encryptPrivateKey";
import { decryptPrivateKey } from "../lib/keystore/decryptPrivateKey";
import { POST as signRoute } from "../app/api/sign/route";
import { POST as keygenRoute } from "../app/api/keygen/route";
import { POST as verifyRoute } from "../app/api/verify/route";
import { generateQrPayload } from "../lib/qrcode/generateQr";
import { parseQrPayload } from "../lib/qrcode/parseQr";
import { NextRequest } from "next/server";



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

describe("Integrasi Modul A (Kriptografi Inti) & Modul B (Keystore)", () => {
  const TEST_PASSPHRASE = "RahasiaPassphraseNaturalSign2026!";

  it("test_integrasi_siklus_penuh_keygen_enkripsi_dekripsi_sign_verify", () => {
    // 1. Modul A: Bangkitkan pasangan kunci Ed25519
    const keyPair = generateKeyPair();
    expect(keyPair.publicKey).toContain("-----BEGIN PUBLIC KEY-----");
    expect(keyPair.privateKey).toContain("-----BEGIN PRIVATE KEY-----");

    // 2. Modul B: Enkripsi private key dengan passphrase user (AES-256-GCM via Scrypt)
    const encryptedKey = encryptPrivateKey(keyPair.privateKey, TEST_PASSPHRASE);
    expect(typeof encryptedKey).toBe("string");
    expect(encryptedKey).not.toContain(keyPair.privateKey); // Tidak boleh memuat plaintext

    // 3. Modul A: Hash dokumen asli (SHA-256)
    const docBuffer = Buffer.from("Dokumen Kesepakatan Bersama Integrasi Modul A & B");
    const docHash = hashDocument(docBuffer);
    expect(docHash).toHaveLength(64);

    // 4. Modul B: Dekripsi ciphertext sesaat sebelum menandatangani
    const decryptedKey = decryptPrivateKey(encryptedKey, TEST_PASSPHRASE);
    expect(decryptedKey).toBe(keyPair.privateKey);

    // 5. Modul A: Tandatangani hash dengan private key hasil dekripsi
    const signature = signDocumentHash(docHash, decryptedKey);
    expect(typeof signature).toBe("string");
    expect(signature.length).toBeGreaterThan(0);

    // 6. Modul A: Verifikasi keabsahan signature dengan public key
    const isValid = verifySignature(docHash, signature, keyPair.publicKey);
    expect(isValid).toBe(true);
  });

  it("test_integrasi_dekripsi_dan_signing_gagal_bila_passphrase_salah", () => {
    const keyPair = generateKeyPair();
    const encryptedKey = encryptPrivateKey(keyPair.privateKey, TEST_PASSPHRASE);
    const docHash = hashDocument(Buffer.from("Dokumen Uji Keamanan"));

    // Percobaan dekripsi dengan passphrase keliru harus melempar error
    expect(() => {
      decryptPrivateKey(encryptedKey, "PassphraseKeliruTotal123!");
    }).toThrow("Passphrase salah atau kunci privat telah dimanipulasi");

    // Menandatangani dengan kunci yang salah/rusak harus gagal
    expect(() => {
      signDocumentHash(docHash, "bukan-kunci-ed25519-valid");
    }).toThrow();
  });

  it("test_integrasi_api_keygen_dengan_passphrase_menghasilkan_encrypted_private_key", async () => {
    const req = new NextRequest("http://localhost:3000/api/keygen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase: TEST_PASSPHRASE }),
    });

    const response = await keygenRoute(req);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.publicKey).toContain("-----BEGIN PUBLIC KEY-----");
    expect(json.privateKey).toContain("-----BEGIN PRIVATE KEY-----");
    expect(json.encryptedPrivateKey).toBeDefined();

    // Verifikasi bahwa encryptedPrivateKey dari API keygen valid dan bisa didekripsi dengan passphrase
    const decrypted = decryptPrivateKey(json.encryptedPrivateKey, TEST_PASSPHRASE);
    expect(decrypted).toBe(json.privateKey);
  });

  it("test_integrasi_api_sign_dengan_encrypted_private_key_dan_passphrase", async () => {
    const keyPair = generateKeyPair();
    const encryptedKey = encryptPrivateKey(keyPair.privateKey, TEST_PASSPHRASE);
    const docHash = hashDocument(Buffer.from("Dokumen Uji Lewat Endpoint /api/sign"));

    const req = new NextRequest("http://localhost:3000/api/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hash: docHash,
        encryptedPrivateKey: encryptedKey,
        passphrase: TEST_PASSPHRASE,
      }),
    });

    const response = await signRoute(req);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.signature).toBeDefined();
    expect(json.hash).toBe(docHash);

    // Pastikan tanda tangan yang dihasilkan API diverifikasi sukses dengan public key
    const isSignatureValid = verifySignature(docHash, json.signature, keyPair.publicKey);
    expect(isSignatureValid).toBe(true);
  });

  it("test_integrasi_api_sign_menolak_jika_passphrase_salah", async () => {
    const keyPair = generateKeyPair();
    const encryptedKey = encryptPrivateKey(keyPair.privateKey, TEST_PASSPHRASE);
    const docHash = hashDocument(Buffer.from("Dokumen Uji Passphrase Salah API"));

    const req = new NextRequest("http://localhost:3000/api/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hash: docHash,
        encryptedPrivateKey: encryptedKey,
        passphrase: "SalahPassword123!",
      }),
    });

    const response = await signRoute(req);
    expect(response.status).toBe(401);

    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toBeDefined();
  });
});

describe("Integrasi Modul A (Kriptografi Inti) & Modul C (QR-Code & Verifikasi)", () => {
  it("test_verify_gagal_jika_dokumen_diubah_1_byte", () => {
    const keyPair = generateKeyPair();

    // 1. Dokumen asli
    const originalDoc = Buffer.from("Dokumen Resmi Kelulusan Mahasiswa NaturalSign 2026");
    const originalHash = hashDocument(originalDoc);

    // 2. Tandatangani hash asli
    const signature = signDocumentHash(originalHash, keyPair.privateKey);

    // 3. Verifikasi dokumen asli harus SUKSES (true)
    expect(verifySignature(originalHash, signature, keyPair.publicKey)).toBe(true);

    // 4. Ubah persis 1 byte pada isi dokumen
    const tamperedDoc = Buffer.from(originalDoc);
    tamperedDoc[10] ^= 0x01; // flip 1 bit pada byte ke-10
    expect(tamperedDoc.equals(originalDoc)).toBe(false);

    // 5. Hash ulang dokumen yang diubah (efek avalanche SHA-256)
    const tamperedHash = hashDocument(tamperedDoc);
    expect(tamperedHash).not.toBe(originalHash);

    // 6. Verifikasi harus GAGAL (false)
    const isValid = verifySignature(tamperedHash, signature, keyPair.publicKey);
    expect(isValid).toBe(false);
  });

  it("test_verify_gagal_jika_qr_dipalsukan", async () => {
    const keyPair = generateKeyPair();
    const docHash = hashDocument(Buffer.from("Dokumen Ijazah Asli"));
    const validSignature = signDocumentHash(docHash, keyPair.privateKey);

    // QR asli dibuat dengan signature sah
    const validQrDataUrl = await generateQrPayload({
      signature: validSignature,
      publicKey: keyPair.publicKey,
      signerName: "Prof. Dr. Ir. Sutrisno",
      role: "Rektor",
      date: "2026-09-27",
      institution: "Universitas Teknologi",
    });

    const base64Data = validQrDataUrl.split(",")[1];
    const validQrBuffer = Buffer.from(base64Data, "base64");
    const parsedValid = parseQrPayload(validQrBuffer);
    expect(verifySignature(docHash, parsedValid.signature, parsedValid.publicKey)).toBe(true);

    // Pemalsuan QR: Penyerang memanipulasi signature di payload QR
    const fakeSignature = Buffer.from("signature-palsu-rekayasa-penyerang").toString("base64");
    const fakeQrDataUrl = await generateQrPayload({
      signature: fakeSignature,
      publicKey: keyPair.publicKey,
      signerName: "Prof. Dr. Ir. Sutrisno",
      role: "Rektor",
      date: "2026-09-27",
      institution: "Universitas Teknologi",
    });

    const fakeBase64 = fakeQrDataUrl.split(",")[1];
    const fakeQrBuffer = Buffer.from(fakeBase64, "base64");
    const parsedFake = parseQrPayload(fakeQrBuffer);

    // Verifikasi hash asli terhadap signature QR palsu WAJIB GAGAL (false)
    const isFakeValid = verifySignature(docHash, parsedFake.signature, parsedFake.publicKey);
    expect(isFakeValid).toBe(false);
  });

  it("test_integrasi_api_verify_json_menghasilkan_status_valid_dan_invalid", async () => {
    const keyPair = generateKeyPair();
    const docHash = hashDocument(Buffer.from("Dokumen Uji API Verify"));
    const signature = signDocumentHash(docHash, keyPair.privateKey);

    // 1. Request valid ke POST /api/verify
    const validReq = new NextRequest("http://localhost:3000/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hash: docHash,
        signature,
        publicKey: keyPair.publicKey,
        signerName: "Budi Santoso",
        role: "Direktur",
        institution: "PT Digital Aman",
      }),
    });

    const validRes = await verifyRoute(validReq);
    expect(validRes.status).toBe(200);
    const validJson = await validRes.json();
    expect(validJson.valid).toBe(true);
    expect(validJson.signers).toHaveLength(1);
    expect(validJson.signers[0].signerName).toBe("Budi Santoso");

    // 2. Request invalid (hash dokumen tidak cocok)
    const invalidHash = hashDocument(Buffer.from("Dokumen Lain Yang Berbeda"));
    const invalidReq = new NextRequest("http://localhost:3000/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hash: invalidHash,
        signature,
        publicKey: keyPair.publicKey,
      }),
    });

    const invalidRes = await verifyRoute(invalidReq);
    expect(invalidRes.status).toBe(200);
    const invalidJson = await invalidRes.json();
    expect(invalidJson.valid).toBe(false);
    expect(invalidJson.reason).toBeDefined();
  });
});



