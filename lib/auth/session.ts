/**
 * Modul Keamanan Penyimpanan & Auth — Session & Supabase Client
 * Tanggung Jawab: Anggota B
 *
 * TODO: Dikerjakan oleh Anggota B
 * - Setup client Supabase untuk browser & server
 * - Kelola sesi user dan ambil informasi user saat ini
 * - Kontrak: getCurrentUser(): { id: string; publicKey: string } | null
 */

export interface CurrentUser {
  id: string;
  publicKey: string;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  // TODO: Implementasi oleh Anggota B
  return null;
}
