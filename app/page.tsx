import Link from "next/link";

export default function HomePage() {
  return (
    <div className="max-w-3xl py-12">
      <h1 className="text-4xl font-semibold tracking-tight text-ink mb-4">
        NaturalSign — Sistem Tanda Tangan & Verifikasi Dokumen Digital
      </h1>
      <p className="text-ink-muted text-lg mb-8 leading-relaxed">
        Platform penandatanganan dokumen PDF berbasis kriptografi asimetris dengan
        penyematan QR-Code meterai digital dan dukungan multi-signer.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <Link
          href="/sign"
          className="border border-border p-5 rounded hover:border-seal transition-colors bg-paper"
        >
          <h2 className="text-xl font-semibold mb-2 text-ink">Tanda Tangani Dokumen</h2>
          <p className="text-sm text-ink-muted">
            Bubuhkan tanda tangan digital pada berkas PDF dengan kunci privat Anda.
          </p>
        </Link>

        <Link
          href="/verify"
          className="border border-border p-5 rounded hover:border-seal transition-colors bg-paper"
        >
          <h2 className="text-xl font-semibold mb-2 text-ink">Verifikasi Dokumen</h2>
          <p className="text-sm text-ink-muted">
            Periksa keaslian dan integritas dokumen melalui pembacaan QR-Code meterai.
          </p>
        </Link>
      </div>

      <div className="border border-border p-4 rounded text-sm text-ink-muted bg-paper">
        <p className="font-medium text-ink mb-1">Status Proyek (Starter Skeleton):</p>
        <p>
          Proyek telah diinisialisasi sesuai spesifikasi. Modul kriptografi,
          penyimpanan & auth, serta integrasi QR/PDF akan dikerjakan oleh masing-masing anggota.
        </p>
      </div>
    </div>
  );
}
