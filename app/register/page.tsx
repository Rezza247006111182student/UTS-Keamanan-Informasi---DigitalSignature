"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  isSupabaseConfigured,
  provisionUserKeys,
  supabase,
} from "@/lib/auth/session";

/**
 * Halaman Pendaftaran (Register)
 * Modul Keamanan Penyimpanan & Auth — Anggota B
 *
 * Mendaftarkan akun baru via Supabase Auth dan menyimpan metadata profil.
 * Menyediakan input Passphrase Kunci untuk enkripsi private key pengguna.
 *
 * Mengikuti token desain DESIGN_GUIDE.md:
 * - max-w-2xl, rata kiri
 * - Tombol primer warna seal (#B08D2F)
 * - Border hairline border (#D8D2C4)
 */
export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [institution, setInstitution] = useState("");
  const [role, setRole] = useState("Penandatangan");
  const [password, setPassword] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    // Validasi passphrase
    if (passphrase !== confirmPassphrase) {
      setErrorMessage("Konfirmasi passphrase tidak cocok dengan passphrase yang Anda masukkan.");
      return;
    }

    if (passphrase.length < 8) {
      setErrorMessage("Passphrase kunci minimal 8 karakter demi keamanan kriptografi.");
      return;
    }

    setLoading(true);

    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage(
        "Konfigurasi Supabase belum lengkap. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di .env.local"
      );
      setLoading(false);
      return;
    }

    try {
      // 1. Daftarkan akun baru ke Supabase Auth.
      //    Metadata di bawah dipakai oleh trigger handle_new_user() di
      //    lib/db/schema.sql untuk otomatis membuat baris tabel public.users.
      //    Alasannya: saat email confirmation aktif, signUp belum
      //    menghasilkan sesi sehingga insert profil dari client akan
      //    ditolak RLS.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            institution,
            role,
          },
        },
      });

      if (authError) {
        setErrorMessage(authError.message || "Gagal mendaftarkan akun. Silakan coba lagi.");
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setErrorMessage(
          "Pendaftaran tidak menghasilkan data pengguna. Silakan coba lagi."
        );
        setLoading(false);
        return;
      }

      // Bila session langsung terbentuk, email confirmation tidak aktif dan
      // user bisa langsung masuk. Bila tidak, user wajib konfirmasi email dulu.
      if (authData.session) {
        // Integrasi Hari-4 (keygen A -> enkripsi B -> simpan DB): buatkan
        // kunci digital sekarang juga memakai passphrase dari form ini.
        // Passphrase diteruskan ke POST /api/auth provision-key dan dibuang
        // server setelah dipakai; tidak pernah disimpan.
        const provision = await provisionUserKeys(passphrase);
        if (provision.success && provision.created) {
          setSuccessMessage(
            "Pendaftaran berhasil! Kunci digital Anda sudah dibuat dan tersimpan terenkripsi. Mengalihkan ke halaman masuk..."
          );
        } else if (provision.success && !provision.created) {
          setSuccessMessage(
            "Pendaftaran berhasil! Akun Anda sudah siap (kunci digital sudah ada). Mengalihkan ke halaman masuk..."
          );
        } else if (provision.keygenUnavailable) {
          setSuccessMessage(
            "Pendaftaran berhasil! Akun Anda sudah siap. Layanan pembuatan kunci (Modul A) belum aktif, jadi kunci digital belum dibuat — Anda bisa membuatnya nanti dari halaman Masuk. Mengalihkan..."
          );
        } else {
          setSuccessMessage(
            `Pendaftaran berhasil, tetapi kunci digital gagal dibuat: ${provision.error ?? "kesalahan tidak dikenal"} Simpan passphrase Anda baik-baik — kunci bisa dibuat ulang dari halaman Masuk. Mengalihkan...`
          );
        }
        // Buang passphrase dari memori browser sesegera mungkin.
        setPassphrase("");
        setConfirmPassphrase("");
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      } else {
        setSuccessMessage(
          "Pendaftaran berhasil! Silakan cek email Anda untuk melakukan konfirmasi, lalu masuk melalui halaman masuk. Siapkan passphrase kunci di atas — kunci digital Anda akan dibuat saat pertama masuk."
        );
        setTimeout(() => {
          router.push("/login");
        }, 4000);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Terjadi kesalahan tidak terduga saat pendaftaran.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12 relative">
      {/* Background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl opacity-50"
        style={{ background: "radial-gradient(circle, rgba(176,141,47,0.2) 0%, transparent 70%)" }}
      />
      <div className="text-center mb-8">
        <h1 className="text-3xl font-serif font-semibold text-ink mb-2">Daftar Akun Baru</h1>
        <p className="text-ink-muted text-sm">
          Daftar untuk mulai menandatangani dan mengelola dokumen digital bermeterai.
        </p>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 rounded bg-invalid-bg text-invalid border border-invalid/30 text-sm">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-4 rounded bg-valid-bg text-valid border border-valid/30 text-sm">
          {successMessage}
        </div>
      )}

      <div className="border border-border p-6 rounded bg-paper">
        <form onSubmit={handleRegister} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-medium text-ink mb-1.5"
              >
                Nama Lengkap
              </label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Dr. Budi Santoso, M.Kom"
                className="w-full px-3.5 py-2 border border-border rounded bg-white text-ink text-sm focus:outline-none focus:border-seal transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-ink mb-1.5"
              >
                Alamat Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="budi@kampus.ac.id"
                className="w-full px-3.5 py-2 border border-border rounded bg-white text-ink text-sm focus:outline-none focus:border-seal transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="institution"
                className="block text-sm font-medium text-ink mb-1.5"
              >
                Institusi / Perguruan Tinggi
              </label>
              <input
                id="institution"
                type="text"
                required
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="Universitas Siliwangi"
                className="w-full px-3.5 py-2 border border-border rounded bg-white text-ink text-sm focus:outline-none focus:border-seal transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="role"
                className="block text-sm font-medium text-ink mb-1.5"
              >
                Jabatan / Peran
              </label>
              <input
                id="role"
                type="text"
                required
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Dosen Pembimbing / Rektor"
                className="w-full px-3.5 py-2 border border-border rounded bg-white text-ink text-sm focus:outline-none focus:border-seal transition-colors"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-ink mb-1.5"
            >
              Kata Sandi Akun
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              className="w-full px-3.5 py-2 border border-border rounded bg-white text-ink text-sm focus:outline-none focus:border-seal transition-colors"
            />
          </div>

          <div className="border-t border-border pt-4">
            <h2 className="text-sm font-semibold text-ink mb-1">
              Passphrase Kunci Digital Pribadi
            </h2>
            <p className="text-xs text-ink-muted mb-3 leading-relaxed">
              Passphrase ini digunakan khusus untuk mengenkripsi private key Anda dengan algoritma AES-256-GCM.
              Sistem tidak pernah menyimpan passphrase Anda dalam bentuk apa pun.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="passphrase"
                  className="block text-xs font-medium text-ink mb-1"
                >
                  Passphrase Kunci
                </label>
                <input
                  id="passphrase"
                  type="password"
                  required
                  minLength={8}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Minimal 8 karakter"
                  className="w-full px-3.5 py-2 border border-border rounded bg-white text-ink text-sm focus:outline-none focus:border-seal transition-colors"
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassphrase"
                  className="block text-xs font-medium text-ink mb-1"
                >
                  Ulangi Passphrase Kunci
                </label>
                <input
                  id="confirmPassphrase"
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassphrase}
                  onChange={(e) => setConfirmPassphrase(e.target.value)}
                  placeholder="Ulangi passphrase"
                  className="w-full px-3.5 py-2 border border-border rounded bg-white text-ink text-sm focus:outline-none focus:border-seal transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2.5 bg-seal hover:bg-seal-dark text-white text-sm font-medium rounded transition-colors disabled:opacity-50"
            >
              {loading ? "Mendaftarkan..." : "Daftar akun baru"}
            </button>
          </div>
        </form>
      </div>

      <p className="mt-6 text-sm text-ink-muted">
        Sudah memiliki akun?{" "}
        <Link href="/login" className="text-seal hover:underline font-medium">
          Masuk di sini
        </Link>
      </p>
    </div>
  );
}
