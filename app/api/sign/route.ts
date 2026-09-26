import { NextRequest, NextResponse } from "next/server";
import { signDocumentHash } from "@/lib/crypto/sign";
import { decryptPrivateKey } from "@/lib/keystore/decryptPrivateKey";

/**
 * API Route: /api/sign
 * Tanggung Jawab: Anggota A
 *
 * Endpoint untuk menandatangani hash dokumen dengan private key (Ed25519).
 * Menerima payload JSON:
 * - hash: string (SHA-256 digest dari dokumen)
 * - privateKey?: string (format PEM PKCS#8)
 * - ATAU encryptedPrivateKey?: string dan passphrase?: string (didekripsi via Modul B)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { hash, privateKey, encryptedPrivateKey, passphrase } = body;

    if (!hash || typeof hash !== "string") {
      return NextResponse.json(
        { success: false, error: "Parameter 'hash' wajib diisi (string SHA-256)" },
        { status: 400 }
      );
    }

    let activePrivateKey = "";

    if (privateKey && typeof privateKey === "string") {
      activePrivateKey = privateKey;
    } else if (encryptedPrivateKey && passphrase) {
      try {
        activePrivateKey = decryptPrivateKey(encryptedPrivateKey, passphrase);
      } catch (decryptErr) {
        return NextResponse.json(
          {
            success: false,
            error:
              (decryptErr as Error).message ||
              "Gagal mendekripsi private key dengan passphrase yang diberikan",
          },
          { status: 401 }
        );
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          error:
            "Sertakan 'privateKey' langsung atau kombinasi 'encryptedPrivateKey' dan 'passphrase'",
        },
        { status: 400 }
      );
    }

    // Tanda tangani hash dokumen
    const signature = signDocumentHash(hash, activePrivateKey);

    // Bersihkan referensi private key dari memori segera setelah proses signing
    activePrivateKey = "";

    return NextResponse.json({
      success: true,
      signature,
      hash,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message || "Gagal menandatangani dokumen",
      },
      { status: 500 }
    );
  }
}

