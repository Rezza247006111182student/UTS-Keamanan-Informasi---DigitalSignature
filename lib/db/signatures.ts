import { getCurrentUser, supabase } from "@/lib/auth/session";

/**
 * Modul Keamanan Penyimpanan & Auth — Helper Data Multi-Signer
 * Tanggung Jawab: Anggota B
 *
 * Tugas tambahan Anggota B (PROJECT_CONTEXT.md Bagian 4):
 *   "merancang skema data & logic Multi-signer (tabel relasi
 *    dokumen-ke-banyak-signer, fungsi untuk menyimpan/mengambil
 *    banyak signature per dokumen)"
 *
 * File ini adalah lapisan TypeScript di atas tabel public.document_signatures
 * yang skemanya didefinisikan di lib/db/schema.sql.
 *
 * CATATAN KONTRAK: file ini TIDAK mengimplementasikan logika kriptografi.
 * Signature di sini sudah dihasilkan oleh Modul A (lib/crypto/sign.ts)
 * melalui kontrak signDocumentHash() dan selalu berupa base64 string
 * (CONTRACT.md Bagian 2). Modul C yang memanggil fungsi-fungsi di bawah
 * untuk keperluan verifikasi dokumen multi-signer.
 *
 * CATATAN KEAMANAN:
 *   - Fungsi-fungsi ini memakai client browser (anon key), sehingga aturan
 *     RLS di schema.sql yang berlaku. signer_id selalu diisi dari user yang
 *     sedang login, BUKAN dari input pemanggil, supaya tidak ada orang yang
 *     bisa menandatangani atas nama orang lain.
 *   - Nama/role/institusi disimpan sebagai snapshot (denormalisasi) memakai
 *     gaya penulisan snake_case yang sama dengan skema di schema.sql.
 */

/** Bentuk baris tabel public.document_signatures (snake_case, sesuai Postgres). */
export interface DocumentSignatureRow {
  id: string;
  document_id: string;
  signer_id: string;
  signature: string;
  signer_name: string;
  signer_role: string;
  institution: string;
  signed_at: string;
  qr_payload: string | null;
}

/**
 * Data yang dibutuhkan untuk menyimpan satu tanda tangan.
 * signer_id sengaja TIDAK ada di sini: akan diambil otomatis dari user
 * yang sedang login untuk mencegah pemalsuan identitas penandatangan.
 */
export interface NewSignatureInput {
  documentId: string;
  /** Signature base64 dari Modul A (kontrak signDocumentHash). */
  signature: string;
  /** Nama penandatangan saat tanda tangan dibuat (snapshot). */
  signerName: string;
  /** Jabatan/peran saat tanda tangan dibuat (snapshot). */
  signerRole: string;
  /** Institusi saat tanda tangan dibuat (snapshot). */
  institution: string;
  /** JSON string payload QR dari Modul C (opsional, boleh diisi setelah QR dibuat). */
  qrPayload?: string;
}

export type SignatureResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Pesan standar bila environment Supabase belum dikonfigurasi.
 * supabase bernilai null hanya dalam kondisi itu, jadi pesan ini cukup
 * untuk menjelaskan kegagalan ke pemanggil.
 */
const SUPABASE_NOT_CONFIGURED =
  "Konfigurasi Supabase belum lengkap. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di .env.local.";

/**
 * Mengambil Supabase client, atau null bila env belum dikonfigurasi.
 * Tiap fungsi publik di file ini memanggil ini di awal dan langsung
 * mengembalikan error bila null — supaya tidak ada yang melempar
 * "Cannot read properties of null" ke user.
 */
function getClient() {
  return supabase;
}

/**
 * Menyimpan satu tanda tangan ke tabel document_signatures.
 *
 * Memanggil modul auth milik Anggota B sendiri (getCurrentUser) untuk
 * mengisi signer_id, sehingga kolom signer_id tidak bisa dipalsukan pemanggil.
 *
 * Gagal bila user sudah menandatangani dokumen yang sama (dibatasi UNIQUE
 * constraint di level database, bukan hanya pengecekan di aplikasi).
 */
export async function addSignature(
  input: NewSignatureInput
): Promise<SignatureResult<DocumentSignatureRow>> {
  const client = getClient();
  if (!client) {
    return { success: false, error: SUPABASE_NOT_CONFIGURED };
  }

  const user = await getCurrentUser();
  if (!user) {
    return {
      success: false,
      error: "Anda harus masuk terlebih dahulu untuk menandatangani dokumen.",
    };
  }

  const { data, error } = await client
    .from("document_signatures")
    .insert({
      document_id: input.documentId,
      signer_id: user.id,
      signature: input.signature,
      signer_name: input.signerName,
      signer_role: input.signerRole,
      institution: input.institution,
      qr_payload: input.qrPayload ?? null,
    })
    .select()
    .single();

  if (error) {
    // Error paling sering: 23505 = unique violation (sudah pernah menandatangani)
    if (error.code === "23505") {
      return {
        success: false,
        error: "Anda sudah pernah menandatangani dokumen ini sebelumnya.",
      };
    }
    // 42501 = RLS menolak (mis. bukan pemilik dokumen / RLS belum dikonfigurasi)
    if (error.code === "42501") {
      return {
        success: false,
        error: "Akses ditolak oleh kebijakan keamanan database (RLS).",
      };
    }
    return { success: false, error: error.message };
  }

  return { success: true, data: data as DocumentSignatureRow };
}

/**
 * Mengambil SEMUA tanda tangan pada satu dokumen (multi-signer).
 * Diurutkan berdasarkan waktu penandatanganan (paling awal dulu).
 *
 * Dipakai Modul C saat verifikasi: semua tanda tangan harus dicocokkan,
 * bukan hanya satu.
 */
export async function getSignaturesForDocument(
  documentId: string
): Promise<SignatureResult<DocumentSignatureRow[]>> {
  const client = getClient();
  if (!client) {
    return { success: false, error: SUPABASE_NOT_CONFIGURED };
  }

  const { data, error } = await client
    .from("document_signatures")
    .select("*")
    .eq("document_id", documentId)
    .order("signed_at", { ascending: true });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: (data ?? []) as DocumentSignatureRow[] };
}

/**
 * Mengambil daftar ID penandatangan pada satu dokumen saja.
 * Berguna untuk pengecekan cepat "sudah lengkap belum?" tanpa memuat
 * signature yang ukurannya besar.
 */
export async function getSignerIdsForDocument(
  documentId: string
): Promise<SignatureResult<string[]>> {
  const client = getClient();
  if (!client) {
    return { success: false, error: SUPABASE_NOT_CONFIGURED };
  }

  const { data, error } = await client
    .from("document_signatures")
    .select("signer_id")
    .eq("document_id", documentId);

  if (error) {
    return { success: false, error: error.message };
  }

  const ids = (data ?? []).map((row) => (row as { signer_id: string }).signer_id);
  return { success: true, data: ids };
}

/**
 * Mengambil public key penandatangan dari view public_signers.
 *
 * View ini yang mengekspos public key ke client tanpa membuka
 * encrypted_private_key (lihat penjelasan di lib/db/schema.sql bagian 7).
 * Public key memang boleh disebar bebas — inilah yang dipakai Modul C
 * untuk memverifikasi signature.
 */
export async function getSignerPublicKey(
  signerId: string
): Promise<SignatureResult<string>> {
  const client = getClient();
  if (!client) {
    return { success: false, error: SUPABASE_NOT_CONFIGURED };
  }

  const { data, error } = await client
    .from("public_signers")
    .select("public_key")
    .eq("id", signerId)
    .maybeSingle();

  if (error) {
    return { success: false, error: error.message };
  }

  const publicKey = (data as { public_key: string | null } | null)?.public_key;
  if (!publicKey) {
    return {
      success: false,
      error: "Public key penandatangan tidak ditemukan atau belum diunggah.",
    };
  }

  return { success: true, data: publicKey };
}
