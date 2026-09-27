/**
 * Modul QR-Code & Integrasi Dokumen — Generate QR-Code
 * Tanggung Jawab: Anggota C
 *
 * Mengubah payload metadata + signature menjadi gambar QR-Code (base64 PNG).
 * Payload di-encode sebagai JSON string sebelum di-encode ke QR,
 * sesuai format data yang disepakati di CONTRACT.md.
 */

import QRCode from "qrcode";

export interface QrPayloadData {
  signature: string;    // base64 string — hasil dari signDocumentHash (Modul A)
  publicKey: string;    // PEM string — kunci publik penandatangan
  signerName: string;   // nama lengkap penandatangan
  role: string;         // jabatan/peran penandatangan
  date: string;         // tanggal tanda tangan (ISO 8601, contoh: "2024-01-15")
  institution: string;  // nama institusi/organisasi penandatangan
}

/**
 * Generate QR-Code dari data metadata + signature.
 *
 * @param data - objek berisi signature + metadata penandatangan
 * @returns Promise<string> — Data URL PNG base64 (format: "data:image/png;base64,...")
 *
 * Dipanggil dari: app/sign/page.tsx, app/api/documents/route.ts
 * Dipakai juga oleh: embedQrToPdf (lewat konversi buffer)
 */
export async function generateQrPayload(data: QrPayloadData): Promise<string> {
  // Validasi: semua field wajib harus terisi
  const requiredFields: (keyof QrPayloadData)[] = [
    "signature",
    "publicKey",
    "signerName",
    "role",
    "date",
    "institution",
  ];

  for (const field of requiredFields) {
    if (!data[field] || typeof data[field] !== "string" || data[field].trim() === "") {
      throw new Error(`generateQrPayload: field "${field}" wajib diisi dan tidak boleh kosong`);
    }
  }

  // Encode payload sebagai JSON string (format disepakati di CONTRACT.md)
  const jsonPayload = JSON.stringify(data);

  // Generate QR-Code sebagai base64 Data URL PNG
  // Error correction level "M" (15%) — keseimbangan antara keterbacaan dan ketahanan
  const dataUrl = await QRCode.toDataURL(jsonPayload, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 256,
    color: {
      dark: "#1B2430",   // --color-ink: warna modul QR (sesuai DESIGN_GUIDE token)
      light: "#FAF8F2",  // --color-paper: latar belakang QR
    },
  });

  return dataUrl;
}

/**
 * Konversi Data URL base64 PNG menjadi Buffer mentah (Uint8Array).
 * Dipakai oleh embedQrToPdf yang membutuhkan bytes PNG, bukan Data URL.
 *
 * @param dataUrl - Data URL hasil generateQrPayload
 * @returns Uint8Array bytes PNG
 */
export function dataUrlToBuffer(dataUrl: string): Uint8Array {
  // Format Data URL: "data:image/png;base64,<base64data>"
  const base64Data = dataUrl.split(",")[1];
  if (!base64Data) {
    throw new Error("dataUrlToBuffer: input bukan Data URL yang valid");
  }
  const binaryString = Buffer.from(base64Data, "base64");
  return new Uint8Array(binaryString);
}
