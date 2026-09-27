import { NextRequest, NextResponse } from "next/server";
import { generateKeyPair } from "@/lib/crypto/keygen";
import { encryptPrivateKey } from "@/lib/keystore/encryptPrivateKey";

/**
 * API Route: /api/keygen
 * Tanggung Jawab: Anggota A (Modul Kriptografi Inti)
 *
 * Endpoint untuk membangkitkan pasangan kunci asimetris baru (Ed25519).
 * - Menghasilkan publicKey dan privateKey dalam format PEM string.
 * - Menerima opsional { passphrase: string } di body: jika disertakan,
 *   otomatis mengenkripsi privateKey menggunakan encryptPrivateKey() (Modul B)
 *   dan mengembalikan encryptedPrivateKey untuk disimpan ke database.
 */
export async function POST(req: NextRequest) {
  try {
    let passphrase: string | undefined;

    try {
      const body = await req.json();
      if (body && typeof body.passphrase === "string" && body.passphrase.trim().length > 0) {
        passphrase = body.passphrase.trim();
      }
    } catch {
      // Body kosong atau bukan JSON (pemanggilan tanpa parameter) -> tetap jalan
    }

    const keyPair = generateKeyPair();

    const result: {
      success: boolean;
      publicKey: string;
      privateKey: string;
      encryptedPrivateKey?: string;
    } = {
      success: true,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
    };

    if (passphrase) {
      result.encryptedPrivateKey = encryptPrivateKey(keyPair.privateKey, passphrase);
    }

    return NextResponse.json(result);
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


