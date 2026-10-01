import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createUserScopedServerClient } from "@/lib/auth/session";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "documents";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const supabase = createUserScopedServerClient(token);

  if (!supabase) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Sesi tidak valid" }, { status: 401 });
  }

  const { id: documentId } = await params;

  // Cek apakah dokumen ada dan milik user ini
  const { data: doc, error: fetchError } = await supabase
    .from("documents")
    .select("id, file_path")
    .eq("id", documentId)
    .eq("created_by", user.id)
    .single();

  if (fetchError || !doc) {
    return NextResponse.json({ error: "Dokumen tidak ditemukan atau akses ditolak" }, { status: 404 });
  }

  // Hapus file fisik dari Storage memakai service-role client (server-only).
  // Client user biasa dapat terblokir kebijakan RLS storage, dan error sebelumnya
  // diabaikan sehingga file tidak pernah benar-benar terhapus tanpa pemberitahuan.
  let storageWarning: string | null = null;
  if (doc.file_path) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    if (supabaseUrl && serviceKey) {
      const admin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: storageError } = await admin.storage.from(BUCKET).remove([doc.file_path]);
      if (storageError) {
        console.error("[documents DELETE] gagal hapus file storage:", storageError.message);
        storageWarning = `Dokumen terhapus dari daftar, tapi file arsip '${doc.file_path}' gagal dihapus dari storage (${storageError.message}).`;
      }
    } else {
      storageWarning = "Dokumen terhapus dari daftar, tapi file arsip tidak ikut terhapus karena SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi.";
    }
  }

  // Hapus dari database
  // Note: document_signatures akan terhapus otomatis jika ada ON DELETE CASCADE di foreign key,
  // tapi untuk amannya kita bisa biarkan supabase yang urus (atau hapus manual jika tidak cascade).
  // Di schema.sql kita punya: `document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE`
  const { error: deleteError } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId);

  if (deleteError) {
    return NextResponse.json({ error: "Gagal menghapus dokumen dari database" }, { status: 500 });
  }

  return NextResponse.json({ success: true, storageWarning });
}
