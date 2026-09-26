/**
 * Halaman Dashboard & Riwayat Dokumen
 * Tanggung Jawab: Anggota C
 *
 * TODO: Dikerjakan oleh Anggota C
 * - Tampilkan daftar dokumen yang telah diunggah dan ditandatangani
 * - Status tanda tangan (pending, partially signed, fully signed)
 * - Tautan untuk unduh dokumen ber-QR meterai
 */

export default function DashboardPage() {
  return (
    <div className="max-w-4xl py-6">
      <h1 className="text-3xl font-semibold text-ink mb-2">Dashboard Dokumen</h1>
      <p className="text-ink-muted mb-6">
        Kelola dokumen Anda dan pantau status tanda tangan digital.
      </p>

      {/* Placeholder area kerja Anggota C */}
      <div className="border border-border p-8 rounded bg-paper text-left">
        <p className="font-semibold text-ink mb-2">
          Area Dashboard (Modul C — Anggota C)
        </p>
        <p className="text-sm text-ink-muted">
          // TODO: Dikerjakan oleh Anggota C — Integrasi tabel riwayat dokumen dari Supabase, filter status, dan aksi unduh PDF.
        </p>
      </div>
    </div>
  );
}
