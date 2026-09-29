import { NextRequest, NextResponse } from "next/server";
import { signDocumentHash } from "@/lib/crypto/sign";
import { decryptPrivateKey } from "@/lib/keystore/decryptPrivateKey";
import { createUserScopedServerClient } from "@/lib/auth/session";
import { generateKeyPair } from "@/lib/crypto/keygen";
import { encryptPrivateKey } from "@/lib/keystore/encryptPrivateKey";

/**
 * API Route: /api/sign
 * Tanggung Jawab: Anggota A (Modul Kriptografi Inti)
 *
 * Endpoint untuk menandatangani hash dokumen dengan private key (Ed25519).
 * Menerima payload JSON:
 * - hash / documentHash: string (SHA-256 digest dari dokumen)
 * - privateKey?: string (format PEM PKCS#8)
 * - ATAU encryptedPrivateKey?: string dan passphrase?: string (didekripsi via Modul B)
 * - ATAU passphrase?: string dengan header Authorization: Bearer <token> (mengambil encrypted_private_key user dari DB)
 */
export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Body request harus berupa JSON yang valid" },
        { status: 400 }
      );
    }

    const hash = (body.hash || body.documentHash) as string | undefined;
    const privateKey = body.privateKey as string | undefined;
    const encryptedPrivateKey = body.encryptedPrivateKey as string | undefined;
    const passphrase = body.passphrase as string | undefined;

    if (!hash || typeof hash !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Parameter 'hash' atau 'documentHash' wajib diisi (string SHA-256)",
        },
        { status: 400 }
      );
    }

    let activePrivateKey = "";
    let signerName = (body.signerName as string) || undefined;
    let signerRole = (body.signerRole as string) || (body.role as string) || undefined;
    let signerInstitution = (body.signerInstitution as string) || (body.institution as string) || undefined;

    // Skenario 1: Private key disediakan langsung
    if (privateKey && typeof privateKey === "string") {
      activePrivateKey = privateKey;
    }
    // Skenario 2: Encrypted private key + passphrase disediakan di body
    else if (encryptedPrivateKey && passphrase) {
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
    }
    // Skenario 3: Passphrase + Bearer token autentikasi (alur UI app/sign/page.tsx)
    else if (passphrase) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice("Bearer ".length).trim()
        : null;

      if (!token) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Sertakan 'privateKey', 'encryptedPrivateKey', atau token autentikasi Bearer untuk menandatangani",
          },
          { status: 401 }
        );
      }

      const userClient = createUserScopedServerClient(token);
      if (!userClient) {
        return NextResponse.json(
          {
            success: false,
            error: "Koneksi Supabase belum dikonfigurasi atau token tidak valid",
          },
          { status: 500 }
        );
      }

      const {
        data: { user },
        error: userError,
      } = await userClient.auth.getUser();

      if (userError || !user) {
        return NextResponse.json(
          {
            success: false,
            error: "Sesi tidak valid atau telah kedaluwarsa. Silakan login kembali.",
          },
          { status: 401 }
        );
      }

      // Ambil encrypted_private_key dan profil dari tabel public.users
      const { data: profile } = await userClient
        .from("users")
        .select("encrypted_private_key, public_key, full_name, role, institution")
        .eq("id", user.id)
        .single();

      signerName = signerName ?? profile?.full_name ?? undefined;
      signerRole = signerRole ?? profile?.role ?? undefined;
      signerInstitution = signerInstitution ?? profile?.institution ?? undefined;

      if (!profile?.encrypted_private_key) {
        // Auto-provisioning: akun ini belum memiliki pasangan kunci di DB
        // Bangkitkan pasangan kunci Ed25519 baru dan enkripsi dengan passphrase user
        const newKeyPair = generateKeyPair();
        const encrypted = encryptPrivateKey(newKeyPair.privateKey, passphrase);

        await userClient
          .from("users")
          .update({
            public_key: newKeyPair.publicKey,
            encrypted_private_key: encrypted,
          })
          .eq("id", user.id);

        activePrivateKey = newKeyPair.privateKey;
      } else {
        try {
          activePrivateKey = decryptPrivateKey(
            profile.encrypted_private_key,
            passphrase
          );
        } catch (decryptErr) {
          return NextResponse.json(
            {
              success: false,
              error:
                (decryptErr as Error).message ||
                "Passphrase salah untuk membuka kunci privat akun Anda",
            },
            { status: 401 }
          );
        }
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          error:
            "Sertakan 'privateKey' langsung, kombinasi 'encryptedPrivateKey' dan 'passphrase', atau 'passphrase' dengan token login",
        },
        { status: 400 }
      );
    }

    // Tanda tangani hash dokumen menggunakan Ed25519
    const signature = signDocumentHash(hash, activePrivateKey);

    // Bersihkan referensi private key dari memori segera setelah proses signing
    activePrivateKey = "";

    // Multi-signer: Catat tanda tangan ini ke tabel document_signatures bila documentId tersedia
    if (body.documentId && typeof body.documentId === "string") {
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice("Bearer ".length).trim()
        : null;
      if (token) {
        const userClient = createUserScopedServerClient(token);
        if (userClient) {
          const { data: authUser } = await userClient.auth.getUser();
          if (authUser?.user) {
            await userClient
              .from("document_signatures")
              .upsert(
                {
                  document_id: body.documentId,
                  signer_id: authUser.user.id,
                  signature,
                  signer_name: signerName ?? "Penandatangan",
                  signer_role: signerRole ?? "Signer",
                  institution: signerInstitution ?? "",
                },
                { onConflict: "document_id,signer_id" }
              );
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      signature,
      hash,
      signerName: signerName ?? "Penandatangan",
      role: signerRole ?? "Signer",
      institution: signerInstitution ?? "",
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


