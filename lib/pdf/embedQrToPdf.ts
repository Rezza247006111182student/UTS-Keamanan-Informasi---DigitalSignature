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
  /** Posisi X pojok kiri bawah QR (pt). Default: dihitung otomatis per slot. */
  x?: number;
  /** Posisi Y pojok kiri bawah QR (pt). Default: margin bawah. */
  y?: number;
  /** Lebar QR dalam pt. Default: 90. */
  width?: number;
  /** Tinggi QR dalam pt. Default: 90. */
  height?: number;
  /** Label teks kecil di bawah QR (mis. nama penandatangan). Opsional. */
  label?: string;
  /**
   * JSON string payload QR untuk disimpan di Subject metadata PDF.
   * Jika disediakan, verifikasi bisa membaca langsung dari metadata tanpa
   * harus mengekstrak ulang gambar PNG (lebih andal).
   */
  qrPayloadJson?: string;
  /**
   * Nomor penandatangan saat ini (1-based). Default: dihitung dari jumlah
   * payload yang sudah ada di Subject + 1. Menentukan slot QR berikutnya
   * dalam baris; bila baris penuh, halaman lanjutan otomatis dibuat.
   */
  signerIndex?: number;
}

// Hitung jumlah penandatangan yang sudah tercatat di Subject (dedupe via signature)
function countSignersInSubject(subject: string): number {
  const seen = new Set<string>();
  for (const part of subject.split("|")) {
    if (!part.startsWith("QR-B64:")) continue;
    try {
      const parsed = JSON.parse(Buffer.from(part.slice("QR-B64:".length), "base64").toString("utf-8"));
      for (const item of Array.isArray(parsed) ? parsed : [parsed]) {
        if (item && typeof item.signature === "string") seen.add(item.signature);
      }
    } catch {
      // segmen rusak diabaikan
    }
  }
  return seen.size;
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

  // Meta Subject saat ini: jumlah penandatangan & halaman lanjutan QR yang sudah ada
  const existingSubject = pdfDoc.getSubject() || "";
  const signerIndex = options.signerIndex ?? (countSignersInSubject(existingSubject) + 1);
  const slot = Math.max(0, signerIndex - 1); // 0-based

  const qrPagesMatch = existingSubject.match(/QR-PG:(\d+)/);
  const existingQrPages = qrPagesMatch ? parseInt(qrPagesMatch[1], 10) : 0;

  const gap = 12;
  const origPages = pdfDoc.getPages();
  const lastOrigPage = origPages[origPages.length - 1 - existingQrPages];
  const { width: refWidth } = lastOrigPage.getSize();

  // Berapa QR yang muat dalam satu baris pada lebar halaman
  const cols = Math.max(1, Math.floor((refWidth - margin * 2 + gap) / (qrSize + gap)));
  const rowIndex = Math.floor(slot / cols); // 0 = baris di halaman asli; >=1 = halaman lanjutan
  const neededContPages = Math.max(0, rowIndex);

  // Tentukan halaman target; buat halaman lanjutan bila diperlukan (ukuran sama dengan halaman terakhir)
  let targetPage = lastOrigPage;
  let newQrPages = existingQrPages;
  if (neededContPages > 0) {
    const origCount = origPages.length - existingQrPages;
    for (let k = existingQrPages; k < neededContPages; k++) {
      const size = lastOrigPage.getSize();
      pdfDoc.addPage([size.width, size.height]);
    }
    newQrPages = Math.max(existingQrPages, neededContPages);
    targetPage = pdfDoc.getPage(origCount + rowIndex - 1);
  }

  const { width: targetWidth } = targetPage.getSize();
  const col = slot % cols;

  // Slot diatur dari kanan ke kiri agar konsisten dengan posisi default dulu
  const defaultX = targetWidth - margin - qrSize - col * (qrSize + gap);
  const defaultY = margin;
  const qrX = options.x ?? defaultX;
  const qrY = options.y ?? defaultY;

  // Header kecil pada halaman lanjutan (di baris pertamanya saja)
  if (neededContPages > 0 && col === 0 && targetPage !== lastOrigPage) {
    const hFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    targetPage.drawText("Halaman lanjutan meterai tanda tangan digital", {
      x: margin,
      y: targetPage.getSize().height - margin - 10,
      size: 8,
      font: hFont,
      color: INK_COLOR,
    });
  }

  // Embed gambar PNG ke dalam dokumen
  const qrImage = await pdfDoc.embedPng(qrPngBytes);

  // --- Gambar border seal di sekitar QR ---
  const borderPadding = 4;
  const borderThickness = 1.5;

  targetPage.drawRectangle({
    x: qrX - borderPadding,
    y: qrY - borderPadding,
    width: qrSize + borderPadding * 2,
    height: qrHeight + borderPadding * 2,
    borderColor: SEAL_COLOR,
    borderWidth: borderThickness,
    color: rgb(1, 1, 1),
  });

  // --- Gambar gambar QR di atas border ---
  targetPage.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrHeight,
  });

  // --- Label teks opsional di bawah QR ---
  if (options.label && options.label.trim() !== "") {
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 6; 
    const labelText = options.label.trim();

    const maxWidth = qrSize + borderPadding * 2;
    const textWidth = font.widthOfTextAtSize(labelText, fontSize);
    const displayText =
      textWidth > maxWidth
        ? labelText.slice(0, Math.floor((maxWidth / textWidth) * labelText.length) - 1) + "…"
        : labelText;

    targetPage.drawText(displayText, {
      x: qrX - borderPadding,
      y: qrY - borderPadding - fontSize - 3,
      size: fontSize,
      font,
      color: INK_COLOR,
      maxWidth,
    });
  }

  // Simpan payload QR di Subject metadata PDF
  // PENTING: encode sebagai base64 karena PEM key mengandung newline
  // yang membuat pdf-lib meng-encode Subject sebagai hex string (tidak bisa dicari sebagai teks)
  // Juga gunakan useObjectStreams: false agar Info dictionary tetap sebagai plain text.
  // Subject SELALU diganti dengan snapshot array lengkap seluruh penandatangan
  // (penumpukan segmen menyebabkan payload duplikat saat verifikasi). Jumlah halaman
  // lanjutan QR dicatat sebagai segmen QR-PG:<n> yang diabaikan pembaca payload.
  if (options.qrPayloadJson) {
    const b64Payload = Buffer.from(options.qrPayloadJson).toString("base64");
    const qrPagesSuffix = newQrPages > 0 ? `|QR-PG:${newQrPages}` : "";
    pdfDoc.setSubject(`QR-B64:${b64Payload}${qrPagesSuffix}`);
  } else if (newQrPages > 0) {
    const stripped = existingSubject.replace(/\|QR-PG:\d+/g, "");
    pdfDoc.setSubject(`${stripped}|QR-PG:${newQrPages}`);
  }

  // Simpan dengan useObjectStreams: false agar metadata bisa dicari di raw bytes
  const modifiedPdfBytes = await pdfDoc.save({ useObjectStreams: false });
  return modifiedPdfBytes;
}
