import { NextResponse } from "next/server";
import { generateKeyPair } from "@/lib/crypto/keygen";

/**
 * API Route: /api/keygen
 * Tanggung Jawab: Anggota A
 *
 * Endpoint untuk membangkitkan pasangan kunci asimetris baru (Ed25519).
 * Menghasilkan public key dan private key dalam format PEM string.
 */
export async function POST() {
  try {
    const keyPair = generateKeyPair();

    return NextResponse.json({
      success: true,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          (error as Error).message || "Gagal membangkitkan pasangan kunci",
      },
      { status: 500 }
    );
  }
}

