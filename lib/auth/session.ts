import { createClient } from "@supabase/supabase-js";

/**
 * Modul Keamanan Penyimpanan & Auth — Session & Supabase Client
 * Tanggung Jawab: Anggota B
 *
 * Menginisialisasi client Supabase dan mengelola sesi pengguna
 * sesuai kontrak interface pada CONTRACT.md.
 */

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy-anon-key";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  if (typeof window !== "undefined") {
    console.warn("Peringatan: Variabel lingkungan Supabase belum dikonfigurasi.");
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export interface CurrentUser {
  id: string;
  email?: string;
  fullName?: string;
  publicKey: string;
}

/**
 * Kontrak Antar-Modul (CONTRACT.md):
 * getCurrentUser(): { id: string; publicKey: string } | null
 *
 * Mengambil informasi user yang sedang login beserta public key-nya
 * dari tabel public.users.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return null;
    }

    // Ambil data profil dan public key dari tabel public.users
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id, email, full_name, public_key")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      // Jika profile belum sinkron, kembalikan ID auth dengan public key kosong
      return {
        id: user.id,
        email: user.email,
        publicKey: "",
      };
    }

    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      publicKey: profile.public_key || "",
    };
  } catch (err) {
    console.error("Gagal mengambil data user saat ini:", err);
    return null;
  }
}
