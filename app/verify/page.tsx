/**
 * Halaman Verifikasi Dokumen & QR-Code
 * Tanggung Jawab: Anggota C (UI memanggil API Modul A)
 *
 * TODO: Dikerjakan oleh Anggota C
 * - Upload PDF atau scan gambar QR-Code meterai
 * - Ekstraksi signature, public key, dan hash dokumen
 * - Panggil API /api/verify (Modul A)
 * - Tampilkan badge status valid/invalid (warna valid #2F6B4F / invalid #A23B32) sesuai DESIGN_GUIDE.md
 */

export default function VerifyPage() {
  return (
    <div className="max-w-2xl py-6">
      <h1 className="text-3xl font-semibold text-ink mb-2">Verifikasi Keaslian Dokumen</h1>
      <p className="text-ink-muted mb-6">
        Unggah berkas PDF atau pindai QR-Code meterai untuk memverifikasi keutuhan dan keaslian tanda tangan.
      </p>

      {/* Placeholder area kerja Anggota C */}
      <div className="border border-border p-8 rounded bg-paper text-left">
        <p className="font-semibold text-ink mb-2">
          Area Verifikasi (Modul C — Anggota C)
        </p>
        <p className="text-sm text-ink-muted">
          // TODO: Dikerjakan oleh Anggota C — Upload PDF/QR scan, call /api/verify, tampilkan status valid/invalid dengan pesan spesifik.
        </p>
      </div>
    </div>
  );
}
