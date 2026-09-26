/**
 * Modul QR-Code & Integrasi Dokumen — Generate QR-Code
 * Tanggung Jawab: Anggota C
 *
 * TODO: Dikerjakan oleh Anggota C
 * - Generate QR-Code dari payload metadata + signature menggunakan library `qrcode`
 * - Output format: base64 Data URL atau Buffer
 * - Kontrak: generateQrPayload(data: QrPayloadData): Promise<string>
 */

export interface QrPayloadData {
  signature: string;
  publicKey: string;
  signerName: string;
  role: string;
  date: string;
  institution: string;
}

export async function generateQrPayload(data: QrPayloadData): Promise<string> {
  // TODO: Implementasi oleh Anggota C
  throw new Error("Belum diimplementasikan — dikerjakan oleh Anggota C");
}
