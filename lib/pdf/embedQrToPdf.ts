/**
 * Modul QR-Code & Integrasi Dokumen — Embed QR-Code ke PDF
 * Tanggung Jawab: Anggota C
 *
 * Menyematkan gambar QR-Code (PNG) ke dalam halaman PDF menggunakan pdf-lib.
 * QR dibingkai dengan border warna seal (#B08D2F) sesuai DESIGN_GUIDE.md Bagian 4
 * ("QR-Code selalu dibingkai dengan border tipis warna seal — mengesankan meterai").
 *
 * Posisi default: pojok kanan bawah halaman terakhir, dengan margin 24pt dari tepi.
 */

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

// Warna seal dari DESIGN_GUIDE.md design token --color-seal: #B08D2F
// Dikonversi ke nilai 0–1 untuk pdf-lib
const SEAL_COLOR = rgb(0xb0 / 255, 0x8d / 255, 0x2f / 255);

// Warna ink dari --color-ink: #1B2430 (untuk teks label di bawah QR)
const INK_COLOR = rgb(0x1b / 255, 0x24 / 255, 0x30 / 255);

export interface EmbedQrOptions {
  /** Index halaman tujuan (0-based). Default: halaman terakhir. */
  pageIndex?: number;
  /** Posisi X pojok kiri bawah QR (pt). Default: pojok kanan bawah dengan margin. */
  x?: number;
  /** Posisi Y pojok kiri bawah QR (pt). Default: pojok kanan bawah dengan margin. */
  y?: number;
  /** Lebar QR dalam pt. Default: 90. */
  width?: number;
  /** Tinggi QR dalam pt. Default: 90. */
  height?: number;
  /** Label teks kecil di bawah QR (mis. nama penandatangan). Opsional. */
  label?: string;
}

/**
 * Embed QR-Code PNG ke dalam dokumen PDF dan return PDF baru.
 *
 * @param pdfBytes     - bytes PDF asli (Uint8Array / Buffer)
 * @param qrPngBytes   - bytes PNG dari QR-Code (Uint8Array / Buffer)
 * @param options      - opsi posisi & ukuran, lihat EmbedQrOptions
 * @returns Promise<Uint8Array> — bytes PDF baru dengan QR tersematkan
 *
 * Dipanggil dari: app/api/documents/route.ts setelah proses sign selesai
 */
export async function embedQrToPdf(
  pdfBytes: Uint8Array,
  qrPngBytes: Uint8Array,
  options: EmbedQrOptions = {}
): Promise<Uint8Array> {
  // Muat dokumen PDF yang sudah ada
  const pdfDoc = await PDFDocument.load(pdfBytes);

  // Tentukan halaman tujuan
  const pages = pdfDoc.getPages();
  if (pages.length === 0) {
    throw new Error("embedQrToPdf: dokumen PDF tidak memiliki halaman");
  }

  const targetIndex =
    options.pageIndex !== undefined
      ? options.pageIndex
      : pages.length - 1; // default: halaman terakhir

  if (targetIndex < 0 || targetIndex >= pages.length) {
    throw new Error(
      `embedQrToPdf: pageIndex ${targetIndex} di luar jangkauan (PDF memiliki ${pages.length} halaman)`
    );
  }

  const page = pages[targetIndex];
  const { width: pageWidth, height: pageHeight } = page.getSize();

  // Ukuran QR
  const qrSize = options.width ?? 90;
  const qrHeight = options.height ?? qrSize;

  // Margin dari tepi halaman (24pt ≈ 8.5mm)
  const margin = 24;

  // Posisi pojok kiri bawah QR — default: pojok kanan bawah
  const qrX = options.x ?? pageWidth - qrSize - margin;
  const qrY = options.y ?? margin;

  // Embed gambar PNG ke dalam dokumen
  const qrImage = await pdfDoc.embedPng(qrPngBytes);

  // --- Gambar border seal di sekitar QR ---
  // Border adalah rectangle sedikit lebih besar dari QR (padding 4pt di tiap sisi)
  const borderPadding = 4;
  const borderThickness = 1.5; // pt, hairline sesuai DESIGN_GUIDE

  page.drawRectangle({
    x: qrX - borderPadding,
    y: qrY - borderPadding,
    width: qrSize + borderPadding * 2,
    height: qrHeight + borderPadding * 2,
    borderColor: SEAL_COLOR,
    borderWidth: borderThickness,
    // Tidak ada fill — transparan, sesuai prinsip DESIGN_GUIDE (no decorative shadow/fill)
  });

  // --- Gambar gambar QR di atas border ---
  page.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrHeight,
  });

  // --- Label teks opsional di bawah QR ---
  if (options.label && options.label.trim() !== "") {
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 6; // pt — sangat kecil, hanya sebagai keterangan
    const labelText = options.label.trim();

    // Potong label kalau terlalu panjang supaya tidak keluar dari area QR
    const maxWidth = qrSize + borderPadding * 2;
    const textWidth = font.widthOfTextAtSize(labelText, fontSize);
    const displayText =
      textWidth > maxWidth
        ? labelText.slice(0, Math.floor((maxWidth / textWidth) * labelText.length) - 1) + "…"
        : labelText;

    page.drawText(displayText, {
      x: qrX - borderPadding,
      y: qrY - borderPadding - fontSize - 3, // 3pt gap di bawah border
      size: fontSize,
      font,
      color: INK_COLOR,
      maxWidth,
    });
  }

  // Simpan dan return PDF baru
  const modifiedPdfBytes = await pdfDoc.save();
  return modifiedPdfBytes;
}
