import { describe, it, expect } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { encryptPrivateKey } from "@/lib/keystore/encryptPrivateKey";
import { decryptPrivateKey } from "@/lib/keystore/decryptPrivateKey";
import { isSupabaseConfigured, supabase } from "@/lib/auth/session";

/**
 * Unit Test Modul Keamanan Penyimpanan & Auth
 * Tanggung Jawab: Anggota B
 *
 * 3 Unit Test Wajib Sesuai PROJECT_CONTEXT.md Bagian 4:
 *   1. test_privatekey_terenkripsi_di_database
 *   2. test_dekripsi_gagal_dengan_passphrase_salah
 *   3. test_login_gagal_dengan_kredensial_salah
 *
 * PRASYARAT MENJALANKAN TEST INI:
 *   1. Isi .env.local dengan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 *      dan SUPABASE_SERVICE_ROLE_KEY.
 *   2. Jalankan lib/db/schema.sql di Supabase SQL Editor (tabel public.users,
 *      trigger handle_new_user, dan view public_signers wajib sudah ada).
 *   3. Butuh koneksi internet.
 *
 * Test 1 memakai service role key agar bisa melewati RLS. Service role hanya
 * dipakai DI DALAM FILE TEST INI, tidak pernah diekspor dari lib/, supaya
 * tidak pernah ikut ter-bundle ke sisi client.
 *
 * Semua data yang dibuat test ini (akun + ciphertext) SELALU dihapus lagi
 * di blok finally, sehingga database tidak tertinggal data uji.
 */

const DUMMY_RAW_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgX7j6yK3m2f9X8m1v
N4r5t8L0s2d4w6y8u0i2o4p6a8yhRANCAASt4y3v2m1n0o9p8q7r6s5t4u3v2w1x
0y9z8a7b6c5d4e3f2g1h0i9j8k7l6m5n
-----END PRIVATE KEY-----`;

const VALID_PASSPHRASE = "KunciRahasiaNaturalSign2026!";
const INVALID_PASSPHRASE = "PasswordYangSalah123!";

// Email & password khusus test. Angka acak dari CSPRNG dipakai agar tidak
// bentrok bila test dijalankan berulang kali / paralel.
const TEST_EMAIL = `anggota-b-test-${crypto.randomUUID().slice(0, 8)}@naturalsign.test`;
const TEST_PASSWORD = "PasswordUjiAngotaB2026!";

/** Kredensial Supabase dari environment. */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/**
 * Client service role untuk keperluan test. Sengaja tidak diekspor.
 * Mengembalikan null bila env belum lengkap.
 */
function createTestAdminClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return null;
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Menolak test dengan pesan yang jelas bila prasyarat belum terpenuhi.
 *
 * Sengaja TIDAK memakai skip: silent — 3 test di file ini adalah test wajib
 * penilaian, jadi test yang tidak benar-benar jalan harus terlihat jelas,
 * bukan lolos diam-diam.
 */
function ensurePrerequisite(
  label: string,
  isReady: boolean,
  hint: string
): void {
  if (!isReady) {
    throw new Error(
      `${label} tidak dapat dijalankan karena prasyarat belum terpenuhi. ${hint}`
    );
  }
}

describe("Modul Keamanan Penyimpanan & Auth (Anggota B)", () => {
  // ===========================================================================
  // Test 1: Menjamin private key tersimpan di database SELALU dalam bentuk
  // terenkripsi, tidak pernah plaintext.
  // ===========================================================================
  // Timeout 30 detik: test ini memanggil Supabase Auth + Postgres lewat
  // jaringan (createUser, 3x query users, deleteUser), sehingga batas default
  // 5 detik vitest terlalu ketat dan flaky. Bukan kegagalan logika.
  it("test_privatekey_terenkripsi_di_database", async () => {
    ensurePrerequisite(
      "test_privatekey_terenkripsi_di_database",
      isSupabaseConfigured && Boolean(SERVICE_ROLE_KEY),
      "Isi NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, dan SUPABASE_SERVICE_ROLE_KEY di .env.local, lalu pastikan lib/db/schema.sql sudah dijalankan di Supabase SQL Editor."
    );

    const admin = createTestAdminClient();
    if (!admin) {
      throw new Error("Gagal membuat service role client untuk pengujian.");
    }

    // 1. Buat user uji. Profil di tabel public.users dibuat otomatis oleh
    //    trigger handle_new_user() yang didefinisikan di lib/db/schema.sql.
    const { data: createdUser, error: createError } =
      await admin.auth.admin.createUser({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true,
      });

    if (createError || !createdUser?.user) {
      throw new Error(
        `Gagal membuat user uji di Supabase Auth: ${createError?.message ?? "user tidak dikembalikan"}`
      );
    }

    const userId = createdUser.user.id;

    try {
      // 2. Pastikan trigger benar-benar membuatkan profil.
      const { data: profile, error: profileError } = await admin
        .from("users")
        .select("id, email, encrypted_private_key")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) {
        throw new Error(
          `Gagal membaca profil user uji: ${profileError.message}. Pastikan lib/db/schema.sql sudah dijalankan.`
        );
      }
      if (!profile) {
        throw new Error(
          "Baris profil tidak terbentuk otomatis. Trigger handle_new_user() pada lib/db/schema.sql belum terpasang — jalankan ulang schema.sql di Supabase SQL Editor."
        );
      }

      // 3. Enkripsi private key, lalu simpan ciphertext-nya ke database.
      const ciphertext = encryptPrivateKey(DUMMY_RAW_PRIVATE_KEY, VALID_PASSPHRASE);

      const { error: updateError } = await admin
        .from("users")
        .update({
          encrypted_private_key: ciphertext,
          public_key: "-----BEGIN PUBLIC KEY-----\nUjiDummies\n-----END PUBLIC KEY-----",
        })
        .eq("id", userId);

      if (updateError) {
        throw new Error(`Gagal menyimpan ciphertext ke database: ${updateError.message}`);
      }

      // 4. Baca kembali nilai yang BENAR-BENAR tersimpan di database.
      const { data: stored, error: readError } = await admin
        .from("users")
        .select("encrypted_private_key")
        .eq("id", userId)
        .maybeSingle();

      if (readError || !stored) {
        throw new Error(
          `Gagal membaca kembali ciphertext dari database: ${readError?.message ?? "baris tidak ditemukan"}`
        );
      }

      const storedCiphertext = stored.encrypted_private_key as string;

      // 4a. Yang tersimpan harus berupa string dan bukan kosong.
      expect(typeof storedCiphertext).toBe("string");
      expect(storedCiphertext.length).toBeGreaterThan(0);

      // 4b. Yang tersimpan TIDAK BOLEH sama dengan private key mentah.
      expect(storedCiphertext).not.toBe(DUMMY_RAW_PRIVATE_KEY);

      // 4c. Yang tersimpan tidak boleh memuat penanda PEM private key.
      expect(storedCiphertext).not.toContain("BEGIN PRIVATE KEY");
      expect(storedCiphertext).not.toContain("END PRIVATE KEY");

      // 4d. Ciphertext harus berbentuk paket terenkripsi yang bisa diurai,
      //     bukan teks acak: di dalamnya ada metadata algoritma & salt.
      const keyPackage = JSON.parse(
        Buffer.from(storedCiphertext, "base64").toString("utf8")
      );
      expect(keyPackage.algorithm).toBe("aes-256-gcm");
      expect(keyPackage.kdf).toBe("scrypt");
      expect(typeof keyPackage.salt).toBe("string");
      expect(typeof keyPackage.iv).toBe("string");
      expect(typeof keyPackage.tag).toBe("string");

      // 4e. Isi paket yang terenkripsi juga tidak boleh memuat plaintext.
      const encryptedDataBytes = Buffer.from(keyPackage.data, "base64").toString("utf8");
      expect(encryptedDataBytes).not.toContain("BEGIN PRIVATE KEY");

      // 5. Nilai yang tersimpan di database masih bisa didekripsi dengan
      //    passphrase yang benar (bukti tidak terjadi kehilangan data).
      expect(decryptPrivateKey(storedCiphertext, VALID_PASSPHRASE)).toBe(
        DUMMY_RAW_PRIVATE_KEY
      );
    } finally {
      // 6. Bersihkan data uji. ON DELETE CASCADE di auth.users ikut menghapus
      //    baris public.users beserta ciphertext-nya.
      const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
      if (deleteError) {
        console.warn(
          `Gagal menghapus user uji ${TEST_EMAIL}: ${deleteError.message}`
        );
      }
    }
  }, 30000);

  // ===========================================================================
  // Test 2: Menjamin dekripsi gagal jika passphrase tidak sesuai.
  // ===========================================================================
  it("test_dekripsi_gagal_dengan_passphrase_salah", () => {
    const ciphertext = encryptPrivateKey(DUMMY_RAW_PRIVATE_KEY, VALID_PASSPHRASE);

    // Harus melempar error saat passphrase salah.
    expect(() => {
      decryptPrivateKey(ciphertext, INVALID_PASSPHRASE);
    }).toThrowError(/Passphrase salah/);
  });

  // ===========================================================================
  // Test 3: Menjamin autentikasi menolak kredensial yang salah.
  // ===========================================================================
  it("test_login_gagal_dengan_kredensial_salah", async () => {
    ensurePrerequisite(
      "test_login_gagal_dengan_kredensial_salah",
      isSupabaseConfigured && Boolean(supabase),
      "Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di .env.local."
    );

    // Login dengan kredensial fiktif ke Supabase.
    const { data, error } = await supabase!.auth.signInWithPassword({
      email: "pengguna_palsu_tidak_terdaftar@domain.test",
      password: "PasswordSalahKredensialFiktif999!",
    });

    // Harus gagal dan mengembalikan objek error.
    expect(error).not.toBeNull();
    expect(data.session).toBeNull();
    expect(data.user).toBeNull();

    // Penjaga: pastikan penolakan ini memang karena KREDENSIAL SALAH, bukan
    // karena anon key tidak valid atau konfigurasi rusak.
    //
    // Tanpa assertion ini, test ini akan tetap hijau-even kredensial-nya
    // benar-benar belum termuat sama sekali, karena Supabase tetap membalas
    // dengan error (berbeda jenis). Test wajib tidak boleh lolos karena
    // alasan keliru.
    expect(error!.status).toBe(400);
    expect(error!.message).toMatch(/invalid login credentials/i);
  }, 15000);
});
