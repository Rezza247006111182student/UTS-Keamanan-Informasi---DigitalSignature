/**
 * API Route: /api/documents/verify
 * Tanggung Jawab: Anggota C
 *
 * Adapter antara halaman verify (upload file) dengan logic kriptografi Modul A.
 *
 * Menerima: FormData { file: File, mode: "pdf" | "qr" }
 *   - mode "pdf"  → ekstrak QR dari PDF, lookup hash asli di DB, verify
 *   - mode "qr"   → parse QR langsung, lookup hash asli di DB, verify
 *
 * Alur:
 *   1. parseQrPayload (Modul C) → { signature, publicKey, signerName, ... }
 *   2. Cari hash dokumen asli di DB via document_signatures + documents
 *      (filter by publicKey penandatangan — hash asli tersimpan di documents.document_hash)
 *   3. verifySignature (Modul A) → hash asli vs signature vs publicKey
 *
 * Mengapa perlu DB lookup:
 *   - Hash yang di-sign = SHA-256 dokumen ASLI (sebelum QR disematkan)
 *   - PDF yang diupload user sudah berisi QR → hash-nya berbeda
 *   - Satu-satunya tempat hash asli tersimpan: tabel documents.document_hash
 *
 * Response: { valid: boolean, reason?: string, signers?: SignerInfo[] }
 * Endpoint ini tidak butuh auth — verifikasi boleh dilakukan siapa saja.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseQrPayload } from "@/lib/qrcode/parseQr";
import { verifySignature } from "@/lib/crypto/verify";
import { PDFDocument } from "pdf-lib";

// ─── Tipe response ────────────────────────────────────────────────────────────

interface SignerInfo {
  signerName: string;
  role: string;
  institution: string;
  date: string;
}

interface VerifyResponse {
  valid: boolean;
  reason?: string;
  signers?: SignerInfo[];
}

// ─── Supabase anon client (hanya baca data publik, RLS berlaku) ───────────────

function getAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── Helper: ekstrak PNG bytes QR yang ter-embed di PDF ──────────────────────
// pdf-lib menyimpan PNG yang di-embed via embedPng() sebagai PDFRawStream.
// Kita iterasi semua indirect objects, cari yang merupakan image XObject PNG.

async function extractQrBytesFromPdf(pdfBytes: Buffer): Promise<Buffer> {
  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(pdfBytes);
  } catch {
    throw new Error("File bukan PDF yang valid atau rusak.");
  }

  const pages = pdfDoc.getPages();
  if (pages.length === 0) throw new Error("PDF tidak memiliki halaman.");

  // pdf-lib internal: enumerateIndirectObjects() mengembalikan semua object di xref table
  const context = pdfDoc.context;
  for (const [, obj] of context.enumerateIndirectObjects()) {
    if (obj == null || typeof obj !== "object") continue;

    // PDFRawStream punya properti dict (PDFDict) dan contents (Uint8Array)
    const rawStream = obj as unknown as Record<string, unknown>;
    if (!("dict" in rawStream) || !("contents" in rawStream)) continue;

    const contents = rawStream.contents as Uint8Array | undefined;
    if (!contents || contents.length < 8) continue;

    // Cek magic bytes PNG: 0x89 0x50 0x4E 0x47 (‰PNG)
    const isPng =
      contents[0] === 0x89 &&
      contents[1] === 0x50 &&
      contents[2] === 0x4e &&
      contents[3] === 0x47;

    if (isPng) {
      return Buffer.from(contents);
    }
  }

  throw new Error(
    "QR-Code tidak ditemukan di dalam PDF. Pastikan ini adalah dokumen yang sudah ditandatangani dengan NaturalSign."
  );
}

// ─── Helper: cari hash dokumen asli di DB berdasarkan publicKey ───────────────
// Flow: publicKey → cari di public_signers → dapat signer_id
//       → cari di document_signatures by signer_id → dapat document_id
//       → ambil document_hash dari documents

async function lookupOriginalHash(publicKey: string): Promise<string | null> {
  const supabase = getAnonClient();
  if (!supabase) return null;

  // 1. Cari signer_id dari public_signers berdasarkan public_key
  const { data: signer } = await supabase
    .from("public_signers")
    .select("id")
    .eq("public_key", publicKey)
    .maybeSingle();

  if (!signer) return null;
  const signerId = (signer as { id: string }).id;

  // 2. Ambil document_id terbaru yang ditandatangani signer ini
  const { data: sig } = await supabase
    .from("document_signatures")
    .select("document_id")
    .eq("signer_id", signerId)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sig) return null;
  const documentId = (sig as { document_id: string }).document_id;

  // 3. Ambil document_hash dari tabel documents
  const { data: doc } = await supabase
    .from("documents")
    .select("document_hash")
    .eq("id", documentId)
    .maybeSingle();

  if (!doc) return null;
  return (doc as { document_hash: string }).document_hash ?? null;
}

// ─── POST /api/documents/verify ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let fileBytes: Buffer;
  let mode: string;
  let formData: FormData;

  // ── 1. Parse FormData ────────────────────────────────────────────────────
  try {
    formData = await req.formData();
    const file = formData.get("file");
    mode = String(formData.get("mode") ?? "qr");

    if (!file || typeof file === "string") {
      return NextResponse.json<VerifyResponse>(
        { valid: false, reason: "File tidak ditemukan dalam request." },
        { status: 400 }
      );
    }

    const arrayBuffer = await (file as File).arrayBuffer();
    fileBytes = Buffer.from(arrayBuffer);
  } catch {
    return NextResponse.json<VerifyResponse>(
      { valid: false, reason: "Gagal membaca file yang diunggah." },
      { status: 400 }
    );
  }

  // ── 2. Ekstrak QR bytes ──────────────────────────────────────────────────
  let qrBytes: Buffer;
  try {
    qrBytes = mode === "pdf"
      ? await extractQrBytesFromPdf(fileBytes)
      : fileBytes; // mode "qr": file itu sendiri adalah gambar QR
  } catch (err) {
    return NextResponse.json<VerifyResponse>({
      valid: false,
      reason: err instanceof Error ? err.message : "Gagal mengekstrak QR dari file.",
    });
  }

  // ── 3. Parse QR payload ──────────────────────────────────────────────────
  let payload: ReturnType<typeof parseQrPayload>;
  try {
    payload = parseQrPayload(qrBytes);
  } catch (err) {
    return NextResponse.json<VerifyResponse>({
      valid: false,
      reason: `QR tidak valid atau dipalsukan — ${err instanceof Error ? err.message : "payload tidak lengkap"}`,
    });
  }

  // ── 4. Lookup hash dokumen asli dari DB ──────────────────────────────────
  // Hash yang di-sign = SHA-256 hex dokumen ASLI (sebelum QR disematkan).
  // Satu-satunya tempat hash ini tersimpan: tabel documents.document_hash.
  const originalHash = await lookupOriginalHash(payload.publicKey);

  if (!originalHash) {
    // Tidak ketemu di DB — dokumen belum pernah disimpan, atau Supabase tidak terkonfigurasi.
    // Fallback: gunakan hash yang dikirim client (jika mode PDF + hash tersedia)
    const clientHash = String(formData.get("documentHash") ?? "");
    if (!clientHash || !/^[a-f0-9]{64}$/i.test(clientHash)) {
      return NextResponse.json<VerifyResponse>({
        valid: false,
        reason:
          "Dokumen tidak ditemukan di database. Pastikan dokumen ini sebelumnya ditandatangani dan disimpan melalui NaturalSign.",
      });
    }
    // Gunakan hash dari client sebagai fallback (akurasi berkurang karena ini hash PDF+QR)
    const isValidFallback = verifySignature(clientHash, payload.signature, payload.publicKey);
    if (!isValidFallback) {
      return NextResponse.json<VerifyResponse>({
        valid: false,
        reason: "Tanda tangan tidak valid. Dokumen mungkin telah diubah atau QR berasal dari dokumen berbeda.",
      });
    }
    return NextResponse.json<VerifyResponse>({
      valid: true,
      signers: [{
        signerName: payload.signerName,
        role: payload.role,
        institution: payload.institution,
        date: payload.date,
      }],
    });
  }

  // ── 5. Verifikasi signature dengan hash asli (Modul A) ───────────────────
  // verifySignature(hash, signature, publicKey): boolean
  // Modul A: data yang di-sign = Buffer.from(hash, "utf-8") → hash adalah hex string
  const isValid = verifySignature(originalHash, payload.signature, payload.publicKey);

  if (!isValid) {
    return NextResponse.json<VerifyResponse>({
      valid: false,
      reason:
        "Tanda tangan digital tidak valid. Dokumen telah diubah sejak ditandatangani, atau kunci publik tidak cocok.",
    });
  }

  // ── 6. Response sukses ───────────────────────────────────────────────────
  return NextResponse.json<VerifyResponse>({
    valid: true,
    signers: [{
      signerName: payload.signerName,
      role: payload.role,
      institution: payload.institution,
      date: payload.date,
    }],
  });
}
