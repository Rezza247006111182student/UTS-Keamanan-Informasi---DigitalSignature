import { describe, it, expect } from "vitest";
import { encryptPrivateKey } from "../lib/keystore/encryptPrivateKey";
import { decryptPrivateKey } from "../lib/keystore/decryptPrivateKey";
import { supabase } from "../lib/auth/session";

/**
 * Unit Test Modul Keamanan Penyimpanan & Auth
 * Tanggung Jawab: Anggota B
 *
 * 3 Unit Test Wajib Sesuai PROJECT_CONTEXT.md Bagian 4:
 * 1. test_privatekey_terenkripsi_di_database
 * 2. test_dekripsi_gagal_dengan_passphrase_salah
 * 3. test_login_gagal_dengan_kredensial_salah
 */

const DUMMY_RAW_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgX7j6yK3m2f9X8m1v
N4r5t8L0s2d4w6y8u0i2o4p6a8yhRANCAASt4y3v2m1n0o9p8q7r6s5t4u3v2w1x
0y9z8a7b6c5d4e3f2g1h0i9j8k7l6m5n
-----END PRIVATE KEY-----`;

const VALID_PASSPHRASE = "KunciRahasiaNaturalSign2026!";
const INVALID_PASSPHRASE = "PasswordYangSalah123!";

describe("Modul Keamanan Penyimpanan & Auth (Anggota B)", () => {
  // Test 1: Menjamin private key terenkripsi dan tidak ada plaintext kunci mentah
  it("test_privatekey_terenkripsi_di_database", () => {
    const ciphertext = encryptPrivateKey(DUMMY_RAW_PRIVATE_KEY, VALID_PASSPHRASE);

    // 1. Ciphertext tidak boleh kosong dan bertipe string
    expect(ciphertext).toBeDefined();
    expect(typeof ciphertext).toBe("string");

    // 2. Ciphertext TIDAK PERNAH sama dengan private key mentah
    expect(ciphertext).not.toBe(DUMMY_RAW_PRIVATE_KEY);

    // 3. Ciphertext tidak boleh memuat kata kunci pembuka PEM mentah
    expect(ciphertext).not.toContain("BEGIN PRIVATE KEY");
    expect(ciphertext).not.toContain("END PRIVATE KEY");

    // 4. Kunci yang didekripsi dengan passphrase yang benar harus cocok sempurna
    const decrypted = decryptPrivateKey(ciphertext, VALID_PASSPHRASE);
    expect(decrypted).toBe(DUMMY_RAW_PRIVATE_KEY);
  });

  // Test 2: Menjamin dekripsi gagal jika passphrase tidak sesuai
  it("test_dekripsi_gagal_dengan_passphrase_salah", () => {
    const ciphertext = encryptPrivateKey(DUMMY_RAW_PRIVATE_KEY, VALID_PASSPHRASE);

    // Harus melempar error saat passphrase salah
    expect(() => {
      decryptPrivateKey(ciphertext, INVALID_PASSPHRASE);
    }).toThrowError(/Passphrase salah/);
  });

  // Test 3: Menjamin autentikasi menolak kredensial yang salah
  it("test_login_gagal_dengan_kredensial_salah", async () => {
    // Uji login dengan kredensial fiktif ke Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email: "pengguna_palsu_tidak_terdaftar@domain.test",
      password: "PasswordSalahKredensialFiktif999!",
    });

    // Harus gagal dan mengembalikan objek error
    expect(error).not.toBeNull();
    expect(data.session).toBeNull();
    expect(data.user).toBeNull();
  });
});
