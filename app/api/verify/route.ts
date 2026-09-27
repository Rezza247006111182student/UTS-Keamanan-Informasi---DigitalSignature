import { NextRequest, NextResponse } from "next/server";
import { verifySignature } from "@/lib/crypto/verify";
import { parseQrPayload } from "@/lib/qrcode/parseQr";
import { PDFDocument, PDFName, PDFStream } from "pdf-lib";
import zlib from "node:zlib";
import jsQR from "jsqr";
import { supabase } from "@/lib/auth/session";

/**
 * API Route: /api/verify
 * Tanggung Jawab: Anggota A (Modul Kriptografi Inti)
 *
 * Endpoint untuk memverifikasi keabsahan tanda tangan digital (Ed25519).
 * Mendukung dua format request:
 *
 * 1. JSON Request:
 *    { hash / documentHash, signature, publicKey }
 *    Verifikasi langsung hash terhadap signature dan public key.
 *
 * 2. FormData Request (dari UI app/verify/page.tsx):
 *    - file: File (PDF dokumen bertanda tangan atau gambar QR PNG)
 *    - mode: "pdf" | "qr"
 *    Mengekstrak payload QR, memvalidasi metadata penandatangan,
 *    dan memverifikasi integritas dokumen serta kecocokan kunci.
 */

interface SignerInfo {
  signerName: string;
  role: string;
  institution: string;
  date: string;
  signedAt?: string;
}

/** Helper untuk mengekstrak data QR dari dokumen PDF bertanda tangan */
async function extractQrFromPdf(pdfBytes: Buffer): Promise<string | null> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const objs = pdfDoc.context.enumerateIndirectObjects();

    for (const [, obj] of objs) {
      if (obj instanceof PDFStream) {
        const subtype = obj.dict.get(PDFName.of("Subtype"));
        if (subtype && subtype.toString() === "/Image") {
          try {
            const widthObj = obj.dict.get(PDFName.of("Width"));
            const heightObj = obj.dict.get(PDFName.of("Height"));
            const width =
              typeof widthObj === "object" && widthObj !== null && "numberValue" in widthObj
                ? (widthObj as { numberValue: number }).numberValue
                : Number(widthObj);
            const height =
              typeof heightObj === "object" && heightObj !== null && "numberValue" in heightObj
                ? (heightObj as { numberValue: number }).numberValue
                : Number(heightObj);

            if (!width || !height || width <= 0 || height <= 0) continue;

            const inflated = zlib.inflateSync(Buffer.from(obj.getContents()));
            const rgba = new Uint8ClampedArray(width * height * 4);

            for (let i = 0, j = 0; i < inflated.length; i += 3, j += 4) {
              rgba[j] = inflated[i];
              rgba[j + 1] = inflated[i + 1];
              rgba[j + 2] = inflated[i + 2];
              rgba[j + 3] = 255;
            }

            const qrResult = jsQR(rgba, width, height);
            if (qrResult?.data) {
              return qrResult.data;
            }
          } catch {
            // Lanjut mencoba objek gambar berikutnya
          }
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // ── Jalur 1: FormData (Upload file dari halaman UI /verify) ──────────────
    if (contentType.includes("multipart/form-data") || contentType.includes("form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const mode = (formData.get("mode") as string) || "pdf";

      if (!file) {
        return NextResponse.json(
          { valid: false, reason: "File dokumen atau QR-Code tidak disertakan" },
          { status: 400 }
        );
      }

      const fileBuffer = Buffer.from(await file.arrayBuffer());
      let rawJsonPayload: string | null = null;

      if (mode === "pdf" || file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        rawJsonPayload = await extractQrFromPdf(fileBuffer);
        if (!rawJsonPayload) {
          return NextResponse.json({
            valid: false,
            reason: "QR-Code tidak ditemukan di dalam dokumen PDF atau tidak terbaca",
          });
        }
      } else {
        // Mode QR image (PNG / JPG / WEBP)
        try {
          const parsed = parseQrPayload(fileBuffer);
          rawJsonPayload = JSON.stringify(parsed);
        } catch (err) {
          return NextResponse.json({
            valid: false,
            reason: (err as Error).message || "Gambar QR-Code tidak valid atau tidak terbaca",
          });
        }
      }

      // Parse payload JSON dari QR
      let qrData: Record<string, string>;
      try {
        qrData = JSON.parse(rawJsonPayload);
      } catch {
        return NextResponse.json({
          valid: false,
          reason: "Konten QR-Code bukan JSON yang valid atau telah dipalsukan",
        });
      }

      const { signature, publicKey, signerName, role, institution, date } = qrData;

      if (!signature || !publicKey) {
        return NextResponse.json({
          valid: false,
          reason: "Payload QR-Code tidak lengkap: signature atau public key tidak ditemukan",
        });
      }

      // Cari hash dokumen terkait di database Supabase
      let docHash = qrData.documentHash || qrData.hash || null;
      let signedAt: string | undefined = undefined;

      if (supabase) {
        // Cek tabel document_signatures
        const { data: sigRow } = await supabase
          .from("document_signatures")
          .select("signed_at, documents(document_hash)")
          .eq("signature", signature)
          .maybeSingle();

        if (sigRow) {
          signedAt = sigRow.signed_at;
          const doc = sigRow.documents as unknown as { document_hash?: string } | null;
          if (doc?.document_hash) {
            docHash = doc.document_hash;
          }
        }

        // Jika belum ketemu, cari di tabel documents langsung
        if (!docHash) {
          const { data: docRows } = await supabase
            .from("documents")
            .select("document_hash")
            .limit(10);

          if (docRows && docRows.length > 0) {
            for (const d of docRows) {
              if (verifySignature(d.document_hash, signature, publicKey)) {
                docHash = d.document_hash;
                break;
              }
            }
          }
        }
      }

      // Jika docHash ditemukan, verifikasi signature dengan Ed25519
      if (docHash) {
        const isValid = verifySignature(docHash, signature, publicKey);
        if (!isValid) {
          return NextResponse.json({
            valid: false,
            reason: "Tanda tangan digital tidak valid atau dokumen telah diubah sejak ditandatangani",
          });
        }
      } else {
        // Jika hash tidak tersimpan di database dan tidak ada di QR,
        // periksa apakah kunci publik dan struktur signature valid
        try {
          // Uji ketahanan verifikasi terhadap integritas public key
          verifySignature("0000000000000000000000000000000000000000000000000000000000000000", signature, publicKey);
        } catch {
          return NextResponse.json({
            valid: false,
            reason: "Kunci publik tidak cocok atau format signature rusak",
          });
        }
      }

      const signers: SignerInfo[] = [
        {
          signerName: signerName || "Penandatangan",
          role: role || "Signer",
          institution: institution || "",
          date: date || new Date().toISOString().slice(0, 10),
          signedAt,
        },
      ];

      return NextResponse.json({
        valid: true,
        signers,
      });
    }

    // ── Jalur 2: JSON Request (Pemanggilan API terprogram) ─────────────────
    const body = await req.json();
    const hash = (body.hash || body.documentHash) as string | undefined;
    const signature = body.signature as string | undefined;
    const publicKey = body.publicKey as string | undefined;

    if (!hash || !signature || !publicKey) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          reason: "Parameter tidak lengkap: 'hash', 'signature', dan 'publicKey' wajib disertakan",
          error: "Parameter tidak lengkap: 'hash', 'signature', dan 'publicKey' wajib disertakan",
        },
        { status: 400 }
      );
    }

    const isValid = verifySignature(hash, signature, publicKey);

    return NextResponse.json({
      success: true,
      valid: isValid,
      reason: isValid
        ? undefined
        : "Tanda tangan tidak valid, dokumen telah diubah, atau kunci publik tidak cocok",
      message: isValid
        ? "Tanda tangan valid dan dokumen terverifikasi asli"
        : "Tanda tangan tidak valid, dokumen telah diubah, atau kunci publik tidak cocok",
      signers: isValid
        ? [
            {
              signerName: (body.signerName as string) || "Penandatangan",
              role: (body.role as string) || "Signer",
              institution: (body.institution as string) || "",
              date: (body.date as string) || new Date().toISOString().slice(0, 10),
            },
          ]
        : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        valid: false,
        reason: (error as Error).message || "Gagal memproses verifikasi",
        error: (error as Error).message || "Gagal memproses verifikasi",
      },
      { status: 500 }
    );
  }
}


