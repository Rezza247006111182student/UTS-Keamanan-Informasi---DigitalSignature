import RequireAuth from "@/lib/auth/RequireAuth";

/**
 * Halaman Tanda Tangani Dokumen
 * Tanggung Jawab: Anggota C (UI & integrasi API), Anggota B (pembatasan akses)
 *
 * Guard RequireAuth ditambahkan Anggota B karena penandatanganan butuh
 * private key terenkripsi milik user — tanpa login tidak ada kunci yang bisa
 * dibuka. Area form di dalamnya tetap milik Anggota C.
 */

export default function SignPage() {
  return (
    <div className="max-w-2xl py-6">
      <h1 className="text-3xl font-semibold text-ink mb-2">Tanda Tangani Dokumen</h1>
      <p className="text-ink-muted mb-6">
        Unggah dokumen PDF dan masukkan passphrase Anda untuk membubuhkan tanda tangan digital.
      </p>

      <RequireAuth
        title="Masuk untuk menandatangani dokumen"
        description="Penandatanganan membutuhkan kunci privat terenkripsi milik Anda. Masuk terlebih dahulu, lalu masukkan passphrase untuk membuka kunci secara sementara di memori."
      >
        {/* Placeholder area kerja Anggota C — tampil hanya saat sudah login */}
        <div className="border border-border p-8 rounded bg-paper text-left">
          <p className="font-semibold text-ink mb-2">
            Form Penandatanganan (Modul C — Anggota C)
          </p>
          <p className="text-sm text-ink-muted">
            // TODO: Dikerjakan oleh Anggota C — Upload PDF, input passphrase, call /api/sign, embed QR, tombol aksi primer bertema seal.
          </p>
        </div>
      </RequireAuth>
    </div>
  );
}
