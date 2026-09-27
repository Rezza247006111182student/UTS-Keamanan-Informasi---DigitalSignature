import RequireAuth from "@/lib/auth/RequireAuth";

/**
 * Halaman Dashboard & Riwayat Dokumen
 * Tanggung Jawab: Anggota C (konten dokumen), Anggota B (pembatasan akses)
 *
 * Guard RequireAuth ditambahkan Anggota B agar dashboard hanya bisa diakses
 * setelah login — sesuai RLS di lib/db/schema.sql (anon hanya boleh baca
 * public_signers). Area placeholder di dalamnya tetap milik Anggota C.
 */

export default function DashboardPage() {
  return (
    <div className="max-w-4xl py-6">
      <h1 className="text-3xl font-semibold text-ink mb-2">Dashboard Dokumen</h1>
      <p className="text-ink-muted mb-6">
        Kelola dokumen Anda dan pantau status tanda tangan digital.
      </p>

      <RequireAuth
        title="Masuk untuk melihat dashboard"
        description="Dashboard menampilkan dokumen dan status tanda tangan milik Anda. Masuk terlebih dahulu — kunci digital Anda disimpan terenkripsi dan hanya bisa dibuka setelah autentikasi."
      >
        {/* Placeholder area kerja Anggota C — tetap tampil hanya saat sudah login */}
        <div className="border border-border p-8 rounded bg-paper text-left">
          <p className="font-semibold text-ink mb-2">
            Area Dashboard (Modul C — Anggota C)
          </p>
          <p className="text-sm text-ink-muted">
            // TODO: Dikerjakan oleh Anggota C — Integrasi tabel riwayat dokumen dari Supabase, filter status, dan aksi unduh PDF.
          </p>
        </div>
      </RequireAuth>
    </div>
  );
}
