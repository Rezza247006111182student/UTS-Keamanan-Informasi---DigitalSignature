/**
 * API Route: /api/documents/download
 * Tanggung Jawab: Anggota C (integrasi storage) — fase finalisasi tim
 *
 * GET /api/documents/download?documentId=<uuid>
 *   Menghasilkan SIGNED URL sementara (60 detik) untuk file PDF bertanda tangan
 *   milik user yang sedang login. Bucket "documents" sengaja PRIVATE, sehingga
 *   file tidak bisa diakses publik — hanya lewat URL bertanda tangan ini.
 *
 * Keamanan:
 *   1. Pemanggil harus punya sesi valid (access token di header Authorization).
 *   2. Kepemilikan dokumen diverifikasi lewat RLS memakai user-scoped client —
 *      signed URL hanya dibuat bila dokumen memang milik user tersebut.
 *   3. createSignedUrl dijalankan dengan service role key HANYA di server
 *      (tidak pernah dikirim ke client), karena bucket private tidak punya
 *      policy storage untuk role authenticated.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createUserScopedServerClient } from "@/lib/auth/session";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "documents";
const URL_TTL_SECONDS = 60;

function extractToken(req: NextRequest): string | null {
  const auth = req.headers.get("Authorization") ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  return null;
}

export async function GET(req: NextRequest) {
  const token = extractToken(req);
  const userClient = createUserScopedServerClient(token);

  if (!userClient) {
    return NextResponse.json(
      { error: "Tidak terautentikasi. Masuk terlebih dahulu." },
      { status: 401 }
    );
  }

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Sesi tidak valid atau sudah kedaluwarsa." },
      { status: 401 }
    );
  }

  const documentId = req.nextUrl.searchParams.get("documentId");
  if (!documentId) {
    return NextResponse.json(
      { error: "Parameter 'documentId' wajib diisi." },
      { status: 400 }
    );
  }

  // Verifikasi kepemilikan lewat RLS (user-scoped). Filter created_by juga
  // dipasang sebagai lapisan kedua bila RLS berubah di kemudian hari.
  const { data: doc, error: docError } = await userClient
    .from("documents")
    .select("id, file_path, title")
    .eq("id", documentId)
    .eq("created_by", user.id)
    .maybeSingle();

  if (docError) {
    console.error("[GET /api/documents/download] query error:", docError.message);
    return NextResponse.json(
      { error: "Gagal memverifikasi dokumen." },
      { status: 500 }
    );
  }

  if (!doc || !doc.file_path) {
    return NextResponse.json(
      { error: "Dokumen tidak ditemukan atau file belum diunggah." },
      { status: 404 }
    );
  }

  // Service role client (server-only) untuk menandatangani URL pada bucket private.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Konfigurasi storage (service role) belum lengkap di server." },
      { status: 500 }
    );
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(doc.file_path, URL_TTL_SECONDS, {
      download: `${doc.title || "dokumen"}-signed.pdf`,
    });

  if (signError || !signed?.signedUrl) {
    console.error("[GET /api/documents/download] sign error:", signError?.message);
    const raw = signError?.message ?? "unknown error";
    return NextResponse.json(
      {
        error:
          raw.toLowerCase().includes("bucket not found")
            ? `Bucket '${BUCKET}' belum ada di Supabase Storage.`
            : raw.toLowerCase().includes("not found")
              ? "File PDF tidak ditemukan di storage — kemungkinan gagal ter-upload. Tanda tangani ulang dokumen ini."
              : `Gagal membuat tautan unduh: ${raw}`,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ url: signed.signedUrl, expiresIn: URL_TTL_SECONDS });
}
