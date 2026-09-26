/**
 * Halaman Masuk (Login)
 * Tanggung Jawab: Anggota B
 *
 * TODO: Dikerjakan oleh Anggota B
 * - Form email & password terhubung ke Supabase Auth
 * - Form max-w-2xl, rata kiri sesuai DESIGN_GUIDE.md
 * - Redirect ke /dashboard setelah berhasil login
 */

export default function LoginPage() {
  return (
    <div className="max-w-2xl py-6">
      <h1 className="text-3xl font-semibold text-ink mb-2">Masuk ke Akun</h1>
      <p className="text-ink-muted mb-6">
        Masuk untuk mengakses dashboard dokumen dan kunci digital Anda.
      </p>

      {/* Placeholder area kerja Anggota B */}
      <div className="border border-border p-8 rounded bg-paper text-left">
        <p className="font-semibold text-ink mb-2">
          Form Login (Modul B — Anggota B)
        </p>
        <p className="text-sm text-ink-muted">
          // TODO: Dikerjakan oleh Anggota B — Integrasi Supabase Auth login, validasi input, dan penanganan session.
        </p>
      </div>
    </div>
  );
}
