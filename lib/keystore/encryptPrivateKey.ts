import crypto from "node:crypto";

/**
 * Modul Keamanan Penyimpanan & Auth — Enkripsi Private Key
 * Tanggung Jawab: Anggota B
 *
 * Mengenkripsi raw private key (format PEM) menggunakan passphrase pengguna.
 * Menggunakan KDF Scrypt untuk key derivation dan algoritma authenticated
 * encryption AES-256-GCM.
 *
 * Kontrak Antar-Modul (CONTRACT.md):
 * encryptPrivateKey(rawPrivateKey: string, passphrase: string): string
 * Return: ciphertext base64 (memuat metadata, salt, iv, tag, dan data terenkripsi)
 */

export interface EncryptedKeyPackage {
  version: number;
  algorithm: "aes-256-gcm";
  kdf: "scrypt";
  salt: string; // base64
  iv: string;   // base64
  tag: string;  // base64
  data: string; // base64
}

export function encryptPrivateKey(
  rawPrivateKey: string,
  passphrase: string
): string {
  if (!rawPrivateKey || typeof rawPrivateKey !== "string") {
    throw new Error("Private key mentah (rawPrivateKey) wajib diisi");
  }
  if (!passphrase || typeof passphrase !== "string") {
    throw new Error("Passphrase wajib diisi untuk mengenkripsi private key");
  }

  // 1. Bangkitkan Salt dan IV acak menggunakan CSPRNG
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12); // Ukuran standar IV untuk AES-GCM

  // 2. Turunkan kunci simetris 256-bit (32 bytes) dari passphrase via Scrypt
  const derivedKey = crypto.scryptSync(passphrase, salt, 32, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 32 * 1024 * 1024,
  });

  // 3. Enkripsi private key dengan AES-256-GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", derivedKey, iv);
  const encryptedBuffer = Buffer.concat([
    cipher.update(rawPrivateKey, "utf8"),
    cipher.final(),
  ]);

  // 4. Ambil Authentication Tag (16 bytes) untuk menjamin integritas data
  const authTag = cipher.getAuthTag();

  // 5. Kemas paket data terenkripsi ke dalam format JSON yang di-encode ke base64
  const keyPackage: EncryptedKeyPackage = {
    version: 1,
    algorithm: "aes-256-gcm",
    kdf: "scrypt",
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: authTag.toString("base64"),
    data: encryptedBuffer.toString("base64"),
  };

  return Buffer.from(JSON.stringify(keyPackage), "utf8").toString("base64");
}
