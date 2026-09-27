import crypto from "node:crypto";
import { EncryptedKeyPackage } from "./encryptPrivateKey";

/**
 * Modul Keamanan Penyimpanan & Auth — Dekripsi Private Key
 * Tanggung Jawab: Anggota B
 *
 * Mendekripsi ciphertext base64 kembali menjadi raw private key (format PEM)
 * hanya dengan passphrase yang benar.
 *
 * Kunci privat hasil dekripsi HANYA boleh berada sesaat di memori server
 * selama proses penandatanganan berlangsung, kemudian langsung dibuang.
 *
 * Kontrak Antar-Modul (CONTRACT.md):
 * decryptPrivateKey(ciphertext: string, passphrase: string): string
 * Return: raw private key (PEM string)
 */

export function decryptPrivateKey(
  ciphertext: string,
  passphrase: string
): string {
  if (!ciphertext || typeof ciphertext !== "string") {
    throw new Error("Ciphertext terenkripsi wajib diisi");
  }
  if (!passphrase || typeof passphrase !== "string") {
    throw new Error("Passphrase wajib diisi untuk membuka private key");
  }

  let keyPackage: EncryptedKeyPackage;

  try {
    const jsonString = Buffer.from(ciphertext, "base64").toString("utf8");
    keyPackage = JSON.parse(jsonString) as EncryptedKeyPackage;
  } catch {
    throw new Error("Format ciphertext tidak valid atau rusak");
  }

  if (
    !keyPackage.salt ||
    !keyPackage.iv ||
    !keyPackage.tag ||
    !keyPackage.data ||
    keyPackage.algorithm !== "aes-256-gcm"
  ) {
    throw new Error("Paket ciphertext tidak lengkap atau algoritma tidak dikenali");
  }

  const salt = Buffer.from(keyPackage.salt, "base64");
  const iv = Buffer.from(keyPackage.iv, "base64");
  const authTag = Buffer.from(keyPackage.tag, "base64");
  const encryptedData = Buffer.from(keyPackage.data, "base64");

  // 1. Turunkan kembali kunci simetris 256-bit dari passphrase & salt via Scrypt
  const derivedKey = crypto.scryptSync(passphrase, salt, 32, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 32 * 1024 * 1024,
  });

  // 2. Dekripsi dengan AES-256-GCM
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", derivedKey, iv);
    decipher.setAuthTag(authTag);

    const decryptedBuffer = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(), // Akan melempar error otomatis jika passphrase salah atau tag tidak cocok
    ]);

    return decryptedBuffer.toString("utf8");
  } catch {
    throw new Error("Passphrase salah atau kunci privat telah dimanipulasi");
  }
}
