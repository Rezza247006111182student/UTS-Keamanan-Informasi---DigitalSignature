/**
 * API Route: /api/documents/verify
 *
 * Strategi verifikasi (dari yang paling andal):
 *   1. Baca JSON payload dari Subject metadata PDF  ← paling andal
 *   2. Scan raw bytes PDF untuk PNG, lalu scan QR   ← fallback
 *   3. Jika mode "qr": parse file gambar langsung
 *
 * Setelah payload didapat (SELURUH payload, bukan hanya yang terakhir):
 *   - Setiap payload diverifikasi terhadap documentHash yang tertanam di
 *     payload itu sendiri (tiap signer menandatangani versi PDF yang ia
 *     terima pada alur multi-signer berurutan)
 *   - Format lama tanpa documentHash tertanam: fallback ke lookup hash di
 *     tabel users/documents atau documentHash dari client
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseQrPayloads } from "@/lib/qrcode/parseQr";
import { verifySignature } from "@/lib/crypto/verify";
import { PDFDocument } from "pdf-lib";

interface SignerInfo {
  signerName: string;
  role: string;
  institution: string;
  date: string;
  signedAt?: string;
}

interface VerifyResponse {
  valid: boolean;
  reason?: string;
  signers?: SignerInfo[];
}

interface QrPayload {
  signature: string;
  publicKey: string;
  signerName: string;
  role: string;
  date: string;
  institution: string;
  documentHash?: string; // opsional — digunakan untuk lookup multi-signer dari DB
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  // Gunakan service_role key agar bisa membaca tabel yang dilindungi RLS (seperti users & document_signatures)
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── Ekstrak semua payload JSON dari Subject metadata PDF ────────────────────────
async function extractAllPayloadsFromSubject(pdfBytes: Buffer): Promise<QrPayload[]> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const subject = pdfDoc.getSubject();
    if (!subject) return [];

    const payloads: QrPayload[] = [];
    // Pisahkan berdasarkan delimiter |
    const parts = subject.split("|");
    for (const part of parts) {
      if (part.startsWith("QR-B64:")) {
        try {
          const b64Str = part.slice("QR-B64:".length);
          if (b64Str) {
            const jsonStr = Buffer.from(b64Str, "base64").toString("utf-8");
            const parsed = JSON.parse(jsonStr);
            const required = ["signature", "publicKey", "signerName", "role", "date", "institution"];
            // Satu bagian base64 bisa berisi array payload (hasil QR multi-signer)
            const items = Array.isArray(parsed) ? parsed : [parsed];
            for (const p of items) {
              let isValid = !!p && typeof p === "object";
              for (const f of required) {
                if (!p[f] || typeof p[f] !== "string") {
                  isValid = false;
                  break;
                }
              }
              if (isValid) payloads.push(p as QrPayload);
            }
          }
        } catch (e) {
          // Abaikan error parse parsial
        }
      }
    }
    return payloads;
  } catch (e) {
    console.error("[verify] extractAllPayloadsFromSubject error:", e);
    return [];
  }
}

// ─── Ekstrak QR PNG dari PDF, lalu scan ───────────────────────────────────────
async function extractPayloadsFromPdfImage(pdfBytes: Buffer): Promise<QrPayload[]> {
  // Strategi A: scan raw bytes PDF untuk magic bytes PNG
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const pngTrailer = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);

  let searchAt = 0;
  while (searchAt < pdfBytes.length) {
    const pngStart = pdfBytes.indexOf(pngHeader, searchAt);
    if (pngStart === -1) break;
    const pngEnd = pdfBytes.indexOf(pngTrailer, pngStart);
    if (pngEnd !== -1) {
      const pngBytes = pdfBytes.slice(pngStart, pngEnd + 8);
      if (pngBytes.length > 200) {
        try {
          return parseQrPayloads(pngBytes) as QrPayload[];
        } catch {
          // bukan QR yang valid, coba berikutnya
        }
      }
    }
    searchAt = pngStart + 1;
  }

  // Strategi B: gunakan pdf-lib untuk mengambil stream image XObject
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const context = pdfDoc.context;
    for (const [, obj] of context.enumerateIndirectObjects()) {
      if (!obj || typeof obj !== "object") continue;
      const s = obj as unknown as Record<string, unknown>;
      if (!("contents" in s)) continue;
      const contents = s.contents as Uint8Array | undefined;
      if (!contents || contents.length < 100) continue;

      // Cek magic bytes PNG di contents
      if (
        contents[0] === 0x89 && contents[1] === 0x50 &&
        contents[2] === 0x4e && contents[3] === 0x47
      ) {
        try {
          return parseQrPayloads(Buffer.from(contents)) as QrPayload[];
        } catch {
          // bukan QR atau tidak bisa di-parse, lanjut
        }
      }
    }
  } catch {
    // pdf-lib gagal load, skip
  }

  return [];
}

// ─── Cari hash asli dari DB berdasarkan public_key ───────────────────────────
async function lookupOriginalHash(publicKey: string): Promise<{ hash: string; documentId: string } | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    // Cara 1: cari langsung dari tabel users berdasarkan public_key
    const { data: userData } = await supabase
      .from("users")
      .select("id")
      .eq("public_key", publicKey)
      .maybeSingle();

    if (userData) {
      const userId = (userData as { id: string }).id;
      // Cari dokumen terbaru yang ditandatangani user ini
      const { data: sigData } = await supabase
        .from("document_signatures")
        .select("document_id, signed_at")
        .eq("signer_id", userId)
        .order("signed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sigData) {
        const docId = (sigData as { document_id: string }).document_id;
        const { data: docData } = await supabase
          .from("documents")
          .select("document_hash")
          .eq("id", docId)
          .maybeSingle();

        if (docData) {
          return {
            hash: (docData as { document_hash: string }).document_hash,
            documentId: docId
          };
        }
      }
    }

    // Cara 2: coba tabel public_signers (fallback)
    const { data: signerData } = await supabase
      .from("public_signers")
      .select("id")
      .eq("public_key", publicKey)
      .maybeSingle();

    if (signerData) {
      const signerId = (signerData as { id: string }).id;
      const { data: sigData2 } = await supabase
        .from("document_signatures")
        .select("document_id")
        .eq("signer_id", signerId)
        .order("signed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sigData2) {
        const docId = (sigData2 as { document_id: string }).document_id;
        const { data: docData } = await supabase
          .from("documents")
          .select("document_hash")
          .eq("id", docId)
          .maybeSingle();
        if (docData) {
          return {
            hash: (docData as { document_hash: string }).document_hash,
            documentId: docId
          };
        }
      }
    }
  } catch (e) {
    console.error("[verify] lookupOriginalHash error:", e);
  }

  return null;
}

// ─── POST /api/documents/verify ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Parse FormData
  let fileBytes: Buffer;
  let mode: string;
  let formData: FormData;

  try {
    formData = await req.formData();
    const file = formData.get("file");
    mode = String(formData.get("mode") ?? "pdf");

    if (!file || typeof file === "string") {
      return NextResponse.json<VerifyResponse>(
        { valid: false, reason: "File tidak ditemukan dalam request." },
        { status: 400 }
      );
    }

    fileBytes = Buffer.from(await (file as File).arrayBuffer());
  } catch {
    return NextResponse.json<VerifyResponse>(
      { valid: false, reason: "Gagal membaca file yang diunggah." },
      { status: 400 }
    );
  }

  // 2. Ekstrak SEMUA payload QR (mendukung format objek tunggal maupun array multi-signer)
  let payloads: QrPayload[] = [];

  if (mode === "pdf") {
    // Strategi 1: baca dari Subject metadata (ditanam oleh embedQrToPdf)
    payloads = await extractAllPayloadsFromSubject(fileBytes);
    console.log("[verify] metadata extraction:", payloads.length > 0 ? `BERHASIL (${payloads.length} payload)` : "tidak ditemukan");

    // Strategi 2: scan gambar QR di dalam PDF (fallback)
    if (payloads.length === 0) {
      payloads = await extractPayloadsFromPdfImage(fileBytes);
      console.log("[verify] image extraction:", payloads.length > 0 ? "BERHASIL" : "tidak ditemukan");
    }

    if (payloads.length === 0) {
      return NextResponse.json<VerifyResponse>({
        valid: false,
        reason: "QR-Code tidak ditemukan di dalam PDF. Pastikan ini adalah dokumen yang sudah ditandatangani dengan NaturalSign.",
      });
    }
  } else {
    // Mode QR image
    try {
      payloads = parseQrPayloads(fileBytes) as QrPayload[];
    } catch (err) {
      return NextResponse.json<VerifyResponse>({
        valid: false,
        reason: `QR tidak valid — ${err instanceof Error ? err.message : "payload tidak lengkap"}`,
      });
    }
  }

  // Dedupe berdasarkan signature — Subject PDF lama bisa berisi payload yang
  // sama dua kali (akibat penumpukan QR-B64 pada penandatanganan berurutan)
  {
    const seen = new Set<string>();
    payloads = payloads.filter((p) => {
      if (seen.has(p.signature)) return false;
      seen.add(p.signature);
      return true;
    });
  }

  const lastPayload = payloads[payloads.length - 1];
  console.log("[verify] payloads ditemukan:", payloads.length, "| signer terakhir:", lastPayload.signerName);

  const clientHash = String(formData.get("documentHash") ?? "");
  const hasClientHash = /^[a-f0-9]{64}$/i.test(clientHash);

  // 3. Verifikasi kriptografi SETIAP payload terhadap documentHash yang tertanam
  //    di payload itu sendiri. Pada alur multi-signer berurutan, tiap penandatangan
  //    menandatangani versi PDF yang ia terima (hash-nya berbeda-beda), sehingga
  //    tidak lagi memakai satu hash untuk semua tanda tangan.
  for (let i = 0; i < payloads.length; i++) {
    const p = payloads[i];
    let anchorHash = p.documentHash ?? null;

    // Payload format lama (tanpa documentHash tertanam) → fallback klasik
    if (!anchorHash) {
      if (hasClientHash) {
        anchorHash = clientHash;
      } else {
        const legacy = await lookupOriginalHash(p.publicKey);
        anchorHash = legacy?.hash ?? null;
      }
    }

    if (!anchorHash) {
      return NextResponse.json<VerifyResponse>({
        valid: false,
        reason: "Dokumen tidak ditemukan di database. Pastikan dokumen ini ditandatangani melalui NaturalSign dan tersimpan di sistem.",
      });
    }

    if (!verifySignature(anchorHash, p.signature, p.publicKey)) {
      console.log("[verify] verifySignature GAGAL untuk payload ke-" + (i + 1) + " (" + p.signerName + ")");
      return NextResponse.json<VerifyResponse>({
        valid: false,
        reason: "Tanda tangan digital tidak valid. Dokumen telah diubah sejak ditandatangani, atau kunci publik tidak cocok.",
      });
    }
  }

  // 4. Susun daftar penandatangan DARI payload terverifikasi (sumber utama).
  //    Lookup DB hanya memperkaya signed_at via signature yang cocok — bukan join
  //    equality pada document_hash yang bisa menarik signer dokumen lain yang
  //    kebetulan punya hash sama (campur data antar dokumen).
  const signers: SignerInfo[] = payloads.map((p) => ({
    signerName: p.signerName,
    role: p.role,
    institution: p.institution,
    date: p.date,
  }));

  const supabase = getSupabase();
  if (supabase) {
    const { data: sigRows } = await supabase
      .from("document_signatures")
      .select("signature, signed_at")
      .in("signature", payloads.map((p) => p.signature));

    if (sigRows) {
      const signedAtBySignature = new Map<string, string>();
      for (const r of sigRows as { signature: string; signed_at: string | null }[]) {
        if (r.signed_at) signedAtBySignature.set(r.signature, r.signed_at);
      }
      for (let i = 0; i < payloads.length; i++) {
        const at = signedAtBySignature.get(payloads[i].signature);
        if (at) signers[i].signedAt = at;
      }
    }
  }

  const finalSigners = signers.sort(
    (a, b) => new Date(a.signedAt ?? a.date).getTime() - new Date(b.signedAt ?? b.date).getTime()
  );

  return NextResponse.json<VerifyResponse>({
    valid: true,
    signers: finalSigners,
  });
}
