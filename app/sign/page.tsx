/**
 * Halaman Tanda Tangani Dokumen
 * Tanggung Jawab: Anggota C (UI memanggil API Modul A & Modul B)
 *
 * TODO: Dikerjakan oleh Anggota C
 * - Form upload file PDF (max-w-2xl, rata kiri sesuai DESIGN_GUIDE.md)
 * - Input passphrase untuk membuka private key
 * - Panggil API /api/sign (Modul A)
 * - Tampilkan QR-Code meterai yang dihasilkan dan preview/unduh PDF ber-QR
 */

export default function SignPage() {
  return (
    <div className="max-w-2xl py-6">
      <h1 className="text-3xl font-semibold text-ink mb-2">Tanda Tangani Dokumen</h1>
      <p className="text-ink-muted mb-6">
        Unggah dokumen PDF dan masukkan passphrase Anda untuk membubuhkan tanda tangan digital.
      </p>

      {/* Placeholder area kerja Anggota C */}
      <div className="border border-border p-8 rounded bg-paper text-left">
        <p className="font-semibold text-ink mb-2">
          Form Penandatanganan (Modul C — Anggota C)
        </p>
        <p className="text-sm text-ink-muted">
          // TODO: Dikerjakan oleh Anggota C — Upload PDF, input passphrase, call /api/sign, embed QR, tombol aksi primer bertema seal.
        </p>
      </div>
    </div>
  );
}
