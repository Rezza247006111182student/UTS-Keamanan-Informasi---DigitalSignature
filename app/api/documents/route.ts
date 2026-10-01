/**
 * API Route: /api/documents
 * Tanggung Jawab: Anggota C
 *
 * GET  /api/documents        — ambil riwayat dokumen milik user yang login
 * POST /api/documents        — simpan metadata dokumen baru setelah sign selesai
 *
 * Autentikasi: pakai access token dari header Authorization: Bearer <token>
 * via createUserScopedServerClient (Modul B) agar RLS tetap berlaku.
 *
 * Tidak ada logic kriptografi di sini — signature sudah dibuat oleh Modul A
 * sebelum route ini dipanggil.
 */

import { NextRequest, NextResponse } from "next/server";
import { createUserScopedServerClient } from "@/lib/auth/session";

// ─── tipe baris tabel ─────────────────────────────────────────────────────────

interface DocumentRow {
  id: string;
  title: string;
  file_path: string;
  document_hash: string;
  created_by: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// ─── helper ambil token dari header ──────────────────────────────────────────

function extractToken(req: NextRequest): string | null {
  const auth = req.headers.get("Authorization") ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

// ─── GET /api/documents ───────────────────────────────────────────────────────

/**
 * Mengembalikan daftar dokumen milik user yang sedang login,
 * diurutkan dari yang paling baru.
 * Setiap item juga menyertakan jumlah tanda tangan (dari document_signatures).
 */
export async function GET(req: NextRequest) {
  const token = extractToken(req);
  const supabase = createUserScopedServerClient(token);

  if (!supabase) {
    return NextResponse.json(
      { error: "Tidak terautentikasi. Masuk terlebih dahulu." },
      { status: 401 }
    );
  }

  // Ambil user dari token
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Sesi tidak valid atau sudah kedaluwarsa." },
      { status: 401 }
    );
  }

  // Ambil dokumen milik user + join ke document_signatures via document_hash
  // agar jumlah signer di multi-sign (dokumen sama, upload berbeda) terhitung benar
  const { data, error } = await supabase
    .from("documents")
    .select(`
      id,
      title,
      file_path,
      document_hash,
      created_by,
      status,
      created_at,
      updated_at
    `)
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[GET /api/documents] Supabase error:", error.message);
    return NextResponse.json(
      { error: "Gagal mengambil data dokumen." },
      { status: 500 }
    );
  }

  // Tidak perlu lagi mengambil signature_count karena kolom tersebut telah dihapus di UI
  return NextResponse.json({ documents: data });
}

// ─── POST /api/documents ──────────────────────────────────────────────────────

/**
 * Menyimpan metadata dokumen baru ke tabel documents.
 *
 * Body JSON yang diharapkan:
 * {
 *   title:         string   — nama/judul dokumen
 *   file_path:     string   — path di Supabase Storage setelah upload
 *   document_hash: string   — SHA-256 hex hash dokumen asli (dari Modul A)
 * }
 *
 * Response sukses: { document: DocumentRow }
 */
export async function POST(req: NextRequest) {
  const token = extractToken(req);
  const supabase = createUserScopedServerClient(token);

  if (!supabase) {
    return NextResponse.json(
      { error: "Tidak terautentikasi. Masuk terlebih dahulu." },
      { status: 401 }
    );
  }

  // Validasi user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Sesi tidak valid atau sudah kedaluwarsa." },
      { status: 401 }
    );
  }

  // Parse body
  let body: { title?: string; file_path?: string; document_hash?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body request bukan JSON yang valid." },
      { status: 400 }
    );
  }

  const { title, file_path, document_hash } = body;

  // Validasi field wajib
  if (!title || typeof title !== "string" || title.trim() === "") {
    return NextResponse.json(
      { error: "Field 'title' wajib diisi." },
      { status: 400 }
    );
  }
  if (!file_path || typeof file_path !== "string" || file_path.trim() === "") {
    return NextResponse.json(
      { error: "Field 'file_path' wajib diisi." },
      { status: 400 }
    );
  }
  if (
    !document_hash ||
    typeof document_hash !== "string" ||
    !/^[a-f0-9]{64}$/i.test(document_hash)
  ) {
    return NextResponse.json(
      { error: "Field 'document_hash' wajib berupa SHA-256 hex (64 karakter)." },
      { status: 400 }
    );
  }

  // Insert ke tabel documents
  const { data, error } = await supabase
    .from("documents")
    .insert({
      title: title.trim(),
      file_path: file_path.trim(),
      document_hash: document_hash.toLowerCase(),
      created_by: user.id,
      status: "fully_signed",
    })
    .select()
    .single();

  if (error) {
    console.error("[POST /api/documents] Supabase error:", error.message);
    return NextResponse.json(
      { error: "Gagal menyimpan dokumen ke database." },
      { status: 500 }
    );
  }

  return NextResponse.json({ document: data as DocumentRow }, { status: 201 });
}
