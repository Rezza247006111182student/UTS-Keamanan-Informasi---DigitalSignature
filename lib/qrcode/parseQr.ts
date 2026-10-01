/**
 * Modul QR-Code & Integrasi Dokumen — Parse / Scan QR-Code
 * Tanggung Jawab: Anggota C
 *
 * Membaca gambar QR-Code (PNG buffer) dan mengekstrak kembali
 * payload metadata + signature yang di-encode oleh generateQrPayload.
 *
 * Alur:
 *   PNG buffer → decode pixel (pngjs) → scan QR (jsqr) → parse JSON → QrPayloadData
 */

import jsQR from "jsqr";
import { PNG } from "pngjs";
import { QrPayloadData } from "./generateQr";

/**
 * Parse SATU gambar QR-Code dan kembalikan SEMUA payload di dalamnya.
 *
 * Konten QR bisa berupa satu objek payload (dokumen 1 tanda tangan)
 * atau array payload (dokumen multi-signer yang ditandatangani berurutan).
 *
 * @param qrImageBuffer - buffer PNG dari gambar QR-Code
 * @returns QrPayloadData[] — semua payload valid yang terbaca, urutan sesuai QR
 * @throws Error jika QR tidak terbaca atau payload JSON tidak valid/tidak lengkap
 *
 * Dipanggil dari: app/api/documents/verify/route.ts, app/api/verify/route.ts, tests/
 */
export function parseQrPayloads(qrImageBuffer: Buffer): QrPayloadData[] {
  // Langkah 1: decode PNG buffer menjadi raw RGBA pixel data
  let png: PNG;
  try {
    png = PNG.sync.read(qrImageBuffer);
  } catch {
    throw new Error("parseQrPayload: gagal membaca buffer PNG — pastikan input adalah gambar PNG yang valid");
  }

  const { width, height, data } = png;

  // Langkah 2: scan pixel data dengan jsqr untuk mengekstrak konten QR
  // jsqr butuh: Uint8ClampedArray RGBA, width, height
  const clampedData = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
  const qrResult = jsQR(clampedData, width, height);

  if (!qrResult) {
    throw new Error("parseQrPayload: QR-Code tidak ditemukan atau tidak terbaca dalam gambar");
  }

  // Langkah 3: parse JSON string payload
  let parsed: unknown;
  try {
    parsed = JSON.parse(qrResult.data);
  } catch {
    throw new Error("parseQrPayload: konten QR bukan JSON yang valid — QR mungkin dipalsukan atau rusak");
  }

  // Normalisasi: objek tunggal → array (kompatibel format lama dan baru)
  const dataArray = Array.isArray(parsed) ? parsed : [parsed];
  if (dataArray.length === 0) {
    throw new Error("parseQrPayload: konten QR berupa array kosong — payload tidak valid");
  }

  // Langkah 4: validasi semua field wajib ada dan bertipe string untuk SETIAP payload
  const requiredFields: (keyof QrPayloadData)[] = [
    "signature",
    "publicKey",
    "signerName",
    "role",
    "date",
    "institution",
  ];

  const result: QrPayloadData[] = [];
  for (const item of dataArray) {
    const obj = item as Record<string, unknown>;

    for (const field of requiredFields) {
      if (typeof obj[field] !== "string" || (obj[field] as string).trim() === "") {
        throw new Error(
          `parseQrPayload: field "${field}" tidak ada atau kosong — payload QR tidak lengkap atau dipalsukan`
        );
      }
    }

    result.push({
      signature:    obj.signature    as string,
      publicKey:    obj.publicKey    as string,
      signerName:   obj.signerName   as string,
      role:         obj.role         as string,
      date:         obj.date         as string,
      institution:  obj.institution  as string,
      documentHash: typeof obj.documentHash === "string" ? obj.documentHash : undefined,
    });
  }

  return result;
}

/**
 * Versi tunggal (kompatibel pemanggil lama): kembalikan payload PERTAMA.
 * @deprecated Gunakan parseQrPayloads agar seluruh penandatangan multi-signer terbaca.
 */
export function parseQrPayload(qrImageBuffer: Buffer): QrPayloadData {
  return parseQrPayloads(qrImageBuffer)[0];
}
