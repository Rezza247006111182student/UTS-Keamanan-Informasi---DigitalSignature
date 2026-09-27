import crypto from "node:crypto";

/**
 * Modul Kriptografi Inti — Document Hashing
 * Tanggung Jawab: Anggota A
 *
 * Hash dokumen (PDF atau buffer data biner) menggunakan algoritma SHA-256.
 * Menghasilkan digest dalam format hex string (64 karakter lowercase)
 * sesuai dengan skema kolom `document_hash` di database.
 *
 * @param data Buffer atau Uint8Array dari dokumen/file
 * @returns SHA-256 digest dalam format 64-karakter hex string
 */
export function hashDocument(data: Buffer | Uint8Array): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

