/**
 * API Route: /api/documents/verify
 *
 * Strategi verifikasi (dari yang paling andal):
 *   1. Baca JSON payload dari Subject metadata PDF  ← paling andal
 *   2. Scan raw bytes PDF untuk PNG, lalu scan QR   ← fallback
 *   3. Jika mode "qr": parse file gambar langsung
 *
 * Setelah payload didapat:
 *   - Cari hash asli dokumen di tabel users (via public_key) + documents
 *   - Jika tidak ada di DB, gunakan documentHash yang dikirim client sebagai fallback
 *   - verifySignature(hash, signature, publicKey)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseQrPayload } from "@/lib/qrcode/parseQr";
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
            let isValid = true;
            for (const f of required) {
              if (!parsed[f] || typeof parsed[f] !== "string") {
                isValid = false;
                break;
              }
            }
            if (isValid) payloads.push(parsed as QrPayload);
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
async function extractPayloadFromPdfImage(pdfBytes: Buffer): Promise<QrPayload | null> {
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
          const result = parseQrPayload(pngBytes);
          return result;
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
          const result = parseQrPayload(Buffer.from(contents));
          return result;
        } catch {
          // bukan QR atau tidak bisa di-parse, lanjut
        }
      }
    }
  } catch {
    // pdf-lib gagal load, skip
  }

  return null;
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

  // 2. Ekstrak payload QR
  let payloads: QrPayload[] = [];
  let payload: QrPayload | null = null; // Payload utama (terakhir) untuk validasi kriptografi

  if (mode === "pdf") {
    // Strategi 1: baca dari Subject metadata (ditanam oleh embedQrToPdf)
    payloads = await extractAllPayloadsFromSubject(fileBytes);
    console.log("[verify] metadata extraction:", payloads.length > 0 ? `BERHASIL (${payloads.length} payload)` : "tidak ditemukan");

    if (payloads.length > 0) {
      payload = payloads[payloads.length - 1]; // Gunakan payload terakhir untuk verifikasi hash PDF
    }

    // Strategi 2: scan PNG di raw PDF bytes lalu baca QR (fallback)
    if (!payload) {
      payload = await extractPayloadFromPdfImage(fileBytes);
      console.log("[verify] image extraction:", payload ? "BERHASIL" : "tidak ditemukan");
      if (payload) payloads = [payload];
    }

    if (!payload) {
      return NextResponse.json<VerifyResponse>({
        valid: false,
        reason: "QR-Code tidak ditemukan di dalam PDF. Pastikan ini adalah dokumen yang sudah ditandatangani dengan NaturalSign.",
      });
    }
  } else {
    // Mode QR image
    try {
      payload = parseQrPayload(fileBytes);
      payloads = [payload];
    } catch (err) {
      return NextResponse.json<VerifyResponse>({
        valid: false,
        reason: `QR tidak valid — ${err instanceof Error ? err.message : "payload tidak lengkap"}`,
      });
    }
  }

  console.log("[verify] payload ditemukan, signerName:", payload.signerName, "publicKey prefix:", payload.publicKey.slice(0, 30));

  // 3. Cari hash dokumen asli di DB (berdasarkan signer terakhir)
  const originalData = await lookupOriginalHash(payload.publicKey);
  console.log("[verify] originalHash dari DB:", originalData?.hash ? originalData.hash.slice(0, 16) + "..." : "TIDAK DITEMUKAN");

  let hashToVerify: string | null = originalData?.hash ?? null;

  if (!hashToVerify) {
    // Fallback: gunakan documentHash yang dikirim client
    const clientHash = String(formData.get("documentHash") ?? "");
    if (clientHash && /^[a-f0-9]{64}$/i.test(clientHash)) {
      console.log("[verify] menggunakan clientHash sebagai fallback:", clientHash.slice(0, 16) + "...");
      hashToVerify = clientHash;
    } else {
      return NextResponse.json<VerifyResponse>({
        valid: false,
        reason: "Dokumen tidak ditemukan di database. Pastikan dokumen ini ditandatangani melalui NaturalSign dan tersimpan di sistem.",
      });
    }
  }

  // 4. Verifikasi kriptografi signature dari QR
  const isValid = verifySignature(hashToVerify, payload.signature, payload.publicKey);
  console.log("[verify] verifySignature result:", isValid, "| hash:", hashToVerify.slice(0, 16) + "...");

  if (!isValid) {
    // Jika gagal dengan hash dari DB, coba dengan clientHash
    if (originalData?.hash) {
      const clientHash = String(formData.get("documentHash") ?? "");
      if (clientHash && /^[a-f0-9]{64}$/i.test(clientHash)) {
        const isValidWithClient = verifySignature(clientHash, payload.signature, payload.publicKey);
        console.log("[verify] retry dengan clientHash:", isValidWithClient);
        if (isValidWithClient) {
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
      }
    }

    return NextResponse.json<VerifyResponse>({
      valid: false,
      reason: "Tanda tangan digital tidak valid. Dokumen telah diubah sejak ditandatangani, atau kunci publik tidak cocok.",
    });
  }

  // 5. Ambil semua penandatangan
  // Pertama, masukkan semua signer dari metadata payload (sequential signers)
  const extractedSigners: SignerInfo[] = payloads.map(p => ({
    signerName: p.signerName,
    role: p.role,
    institution: p.institution,
    date: p.date,
  }));

  // Jika ada originalData (berarti dokumen terdaftar di DB), ambil dari DB juga
  if (originalData?.hash) {
    const supabase = getSupabase();
    if (supabase) {
      const { data: docsWithSigs } = await supabase
        .from("documents")
        .select(`
          document_signatures (
            signer_name,
            signer_role,
            institution,
            signed_at
          )
        `)
        .eq("document_hash", originalData.hash);

      if (docsWithSigs && docsWithSigs.length > 0) {
        for (const doc of docsWithSigs) {
          if (doc.document_signatures && Array.isArray(doc.document_signatures)) {
            for (const s of doc.document_signatures) {
              extractedSigners.push({
                signerName: s.signer_name,
                role: s.signer_role,
                institution: s.institution,
                date: s.signed_at,
              });
            }
          }
        }
      }
    }
  }

  // Hapus duplikat (jika ada signer yang sama dari payload dan DB)
  const uniqueSigners = extractedSigners.filter((v, i, a) => 
    a.findIndex(t => (t.signerName === v.signerName && t.date.slice(0, 10) === v.date.slice(0, 10))) === i
  );

  const finalSigners = uniqueSigners.length > 0
    ? uniqueSigners.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : extractedSigners;

  return NextResponse.json<VerifyResponse>({
    valid: true,
    signers: finalSigners,
  });
}
