import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Modul Keamanan Penyimpanan & Auth — Session & Supabase Client
 * Tanggung Jawab: Anggota B
 *
 * Menginisialisasi client Supabase (browser & server) dan mengelola sesi
 * pengguna sesuai kontrak interface pada CONTRACT.md.
 *
 * Semua kredensial dibaca dari environment variable. Tidak ada URL, anon key,
 * maupun service role key yang ditulis langsung di kode ini.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * True bila environment Supabase sudah dikonfigurasi.
 * Dipakai halaman & test untuk memberi pesan yang jelas, bukan crash
 * dengan error Supabase yang membingungkan.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured && typeof window !== "undefined") {
  console.warn(
    "Peringatan: Variabel lingkungan Supabase belum dikonfigurasi. " +
      "Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di .env.local"
  );
}

/**
 * Client Supabase untuk sisi browser (komponen "use client").
 *
 * NULL ketika environment belum dikonfigurasi. Semua export lain di file ini
 * memeriksa null-ness ini dan mengembalikan nilai aman (null / error),
 * sehingga halaman tidak crash saat kredensial belum diisi.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export interface CurrentUser {
  id: string;
  email?: string;
  fullName?: string;
  role?: string;
  institution?: string;
  publicKey: string;
}

/** Bentuk baris tabel public.users (snake_case, sesuai Postgres). */
interface UserProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  institution: string | null;
  public_key: string | null;
}

/**
 * Kontrak Antar-Modul (CONTRACT.md):
 *   getCurrentUser(): { id: string; publicKey: string } | null
 *
 * Mengambil user yang sedang login beserta public key-nya.
 * Dijalankan di sisi browser, sehingga RLS di schema.sql ikut berlaku
 * (user hanya bisa membaca profilnya sendiri).
 *
 * Mengembalikan null bila:
 *   - tidak ada sesi login, atau
 *   - kredensial Supabase belum dikonfigurasi, atau
 *   - profil di tabel public.users belum terbentuk.
 *
 * Catatan: sengaja TIDAK mengembalikan objek dengan publicKey kosong sebagai
 * fallback. Profil yang belum ada berarti user belum siap dipakai, dan
 * mengembalikan publicKey kosong hanya menyembunyikan masalah yang nanti akan
 * membingungkan pemanggil (mis. Anggota C saat verifikasi).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!supabase) {
    return null;
  }

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return null;
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id, email, full_name, role, institution, public_key")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Gagal membaca profil pengguna:", profileError.message);
      return null;
    }

    if (!profile) {
      // Normalnya profil dibuat otomatis oleh trigger handle_new_user() di
      // schema.sql. Kalau kosong, berarti schema.sql versi terbaru belum
      // dijalankan di Supabase.
      console.warn(
        `Profil untuk user ${user.id} belum ada di tabel public.users. ` +
          "Pastikan lib/db/schema.sql versi terbaru sudah dijalankan di Supabase SQL Editor."
      );
      return null;
    }

    const row = profile as UserProfileRow;

    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name ?? undefined,
      role: row.role ?? undefined,
      institution: row.institution ?? undefined,
      publicKey: row.public_key ?? "",
    };
  } catch (err) {
    console.error("Gagal mengambil data user saat ini:", err);
    return null;
  }
}

/**
 * Keluar dari akun (menghapus sesi di browser).
 * Sengaja tidak menghapus apa pun di database — profil dan tanda tangan
 * milik user tetap tersimpan.
 */
export async function signOut(): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: "Supabase belum dikonfigurasi." };
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Mengambil access token milik user yang sedang login (dipakai browser).
 * Mengembalikan null bila tidak ada sesi.
 */
export async function getAccessToken(): Promise<string | null> {
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    return null;
  }
  return data.session.access_token;
}

/**
 * Membuat Supabase client untuk sisi SERVER (Route Handler / Server Component)
 * yang mewakili seorang user, berdasarkan access token miliknya.
 *
 * Kenapa begini: session Supabase pada aplikasi ini disimpan di localStorage
 * browser (persistSession: true), sehingga server tidak bisa membacanya lewat
 * cookie. Solusi yang dipakai: client mengirim access token lewat header
 * Authorization, dan server meneruskannya sebagai header JWT ke Supabase.
 * Dengan begitu semua query di server tetap tunduk pada RLS milik user itu
 * sendiri, bukan service role.
 *
 * Mengembalikan null bila token kosong atau env belum dikonfigurasi.
 *
 * CATATAN: service role key SENGAJA tidak dipakai di sini. Service role
 * melewati RLS, dan memakainya di jalur yang menerima token dari client
 * berisiko membuat seluruh tabel bisa dibaca tanpa batas.
 */
export function createUserScopedServerClient(
  accessToken: string | null | undefined
): SupabaseClient | null {
  if (!isSupabaseConfigured || !accessToken) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
