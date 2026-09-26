/**
 * Halaman Pendaftaran (Register)
 * Tanggung Jawab: Anggota B
 *
 * TODO: Dikerjakan oleh Anggota B
 * - Form pendaftaran akun baru (email, password, nama lengkap, institusi, role)
 * - Input passphrase untuk mengamankan private key yang dibangkitkan
 * - Integrasi dengan /api/keygen (Modul A) untuk generate keypair dan simpan encrypted key ke database
 */

export default function RegisterPage() {
  return (
    <div className="max-w-2xl py-6">
      <h1 className="text-3xl font-semibold text-ink mb-2">Daftar Akun Baru</h1>
      <p className="text-ink-muted mb-6">
        Daftar untuk mulai menandatangani dan mengelola dokumen digital bermeterai.
      </p>

      {/* Placeholder area kerja Anggota B */}
      <div className="border border-border p-8 rounded bg-paper text-left">
        <p className="font-semibold text-ink mb-2">
          Form Registrasi (Modul B — Anggota B)
        </p>
        <p className="text-sm text-ink-muted">
          // TODO: Dikerjakan oleh Anggota B — Integrasi Supabase Auth register, form passphrase, alur keygen bersama Modul A, dan simpan data ke tabel users.
        </p>
      </div>
    </div>
  );
}
