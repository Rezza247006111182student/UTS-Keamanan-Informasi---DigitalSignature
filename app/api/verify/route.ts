import { NextRequest, NextResponse } from "next/server";
import { verifySignature } from "@/lib/crypto/verify";

/**
 * API Route: /api/verify
 * Tanggung Jawab: Anggota A
 *
 * Endpoint untuk memverifikasi keabsahan signature terhadap hash dokumen dan public key.
 * Menerima payload JSON:
 * - hash: string (SHA-256 digest dari dokumen)
 * - signature: string (base64 digital signature)
 * - publicKey: string (public key format PEM SPKI)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { hash, signature, publicKey } = body;

    if (!hash || !signature || !publicKey) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error:
            "Parameter tidak lengkap: 'hash', 'signature', dan 'publicKey' wajib disertakan",
        },
        { status: 400 }
      );
    }

    const isValid = verifySignature(hash, signature, publicKey);

    return NextResponse.json({
      success: true,
      valid: isValid,
      message: isValid
        ? "Tanda tangan valid dan dokumen terverifikasi asli"
        : "Tanda tangan tidak valid, dokumen telah diubah, atau kunci publik tidak cocok",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        valid: false,
        error: (error as Error).message || "Gagal memproses verifikasi",
      },
      { status: 500 }
    );
  }
}

