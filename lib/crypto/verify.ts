import crypto from "node:crypto";

/**
 * Modul Kriptografi Inti — Signature Verification
 * Tanggung Jawab: Anggota A
 *
 * Memverifikasi keabsahan signature terhadap hash dokumen menggunakan public key (Ed25519).
 * Mengembalikan true jika tanda tangan sah dan cocok, atau false jika tidak cocok / kunci salah / data rusak.
 *
 * Kontrak: verifySignature(hash: string, signature: string, publicKey: string): boolean
 *
 * @param hash Ringkasan hash dokumen (SHA-256)
 * @param signature Signature dalam format base64 string
 * @param publicKey Public key penandatangan berformat PEM string (SPKI)
 * @returns boolean true jika valid, false jika tidak valid
 */
export function verifySignature(
  hash: string,
  signature: string,
  publicKey: string
): boolean {
  if (!hash || !signature || !publicKey) {
    return false;
  }

  try {
    const data = Buffer.from(hash, "utf-8");
    const sigBuffer = Buffer.from(signature, "base64");

    return crypto.verify(null, data, publicKey, sigBuffer);
  } catch {
    // Tangani kemungkinan error parsing kunci yang tidak valid, format PEM rusak, dsb.
    return false;
  }
}

