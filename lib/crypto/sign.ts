import crypto from "node:crypto";

/**
 * Modul Kriptografi Inti — Digital Signature
 * Tanggung Jawab: Anggota A
 *
 * Menandatangani hash dokumen menggunakan private key (Ed25519).
 * Format output: Base64 string
 * Kontrak: signDocumentHash(hash: string, privateKey: string): string
 *
 * @param hash Ringkasan hash dokumen (misalnya hasil SHA-256 dari hashDocument)
 * @param privateKey Private key berformat PEM string (PKCS#8)
 * @returns Digital signature dalam format base64 string
 */
export function signDocumentHash(hash: string, privateKey: string): string {
  if (!hash || typeof hash !== "string") {
    throw new Error("Hash dokumen tidak valid atau kosong");
  }
  if (!privateKey || typeof privateKey !== "string") {
    throw new Error("Private key tidak valid atau kosong");
  }

  const data = Buffer.from(hash, "utf-8");
  // Untuk Ed25519 pada node:crypto, parameter algoritma digest adalah null karena Ed25519 menangani hashing internal
  const signature = crypto.sign(null, data, privateKey);
  return signature.toString("base64");
}

