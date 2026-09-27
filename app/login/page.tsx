"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  fetchKeyStatus,
  isSupabaseConfigured,
  provisionUserKeys,
  supabase,
} from "@/lib/auth/session";

/**
 * Halaman Masuk (Login)
 * Modul Keamanan Penyimpanan & Auth — Anggota B
 *
 * Menggunakan Supabase Auth untuk autentikasi pengguna.
 * Mengikuti token desain DESIGN_GUIDE.md:
 * - max-w-2xl, rata kiri
 * - Tombol primer warna seal (#B08D2F)
 * - Border hairline border (#D8D2C4)
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  // User lama yang registered sebelum integrasi keygen -> belum punya kunci.
  // Tampilkan panel pembuatan kunci (backfill) alih-alih langsung redirect.
  const [needsKey, setNeedsKey] = useState(false);
  const [keyPassphrase, setKeyPassphrase] = useState("");
  const [keyConfirm, setKeyConfirm] = useState("");
  const [provisioning, setProvisioning] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setLoading(true);

    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage(
        "Konfigurasi Supabase belum lengkap. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di .env.local"
      );
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const msg = error.message.toLowerCase();
        // Kasus paling sering saat development: email belum dikonfirmasi.
        // Supabase membalas "Email not confirmed" (400), tapi UI lama
        // menutupinya dengan "Email atau kata sandi salah" sehingga user
        // tidak tahu harus cek inbox.
        if (msg.includes("email not confirmed")) {
          setErrorMessage(
            "Email Anda belum dikonfirmasi. Cek inbox (dan folder spam) untuk link konfirmasi, atau matikan Confirm email di Supabase Dashboard → Authentication → Providers → Email."
          );
        } else if (msg.includes("invalid login credentials")) {
          setErrorMessage("Email atau kata sandi salah.");
        } else {
          // Fallback: tampilkan pesan asli Supabase supaya tidak ada kasus
          // yang tertutup pesan generik lagi.
          setErrorMessage(error.message);
        }
        setLoading(false);
        return;
      }

      if (data.session) {
        // Cek apakah user sudah punya kunci digital. User yang daftar
        // sebelum integrasi keygen punya profil tanpa encrypted_private_key
        // — tanpa cek ini mereka baru gagal nanti saat sign dengan pesan
        // "Kunci privat Anda belum ditemukan di database".
        const status = await fetchKeyStatus();
        if (status.hasKey) {
          router.push("/dashboard");
        } else {
          setNeedsKey(true);
          setInfoMessage(
            "Akun Anda belum memiliki kunci digital (misalnya karena mendaftar sebelum fitur pembuatan kunci aktif). Buat kunci sekarang dengan passphrase — passphrase hanya dipakai sesaat untuk enkripsi dan tidak pernah disimpan."
          );
          setLoading(false);
        }
      } else {
        setErrorMessage(
          "Berhasil masuk, tetapi sesi tidak terbentuk. Silakan coba lagi."
        );
        setLoading(false);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Terjadi kesalahan tidak terduga saat proses masuk.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleProvisionKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setInfoMessage("");

    if (keyPassphrase !== keyConfirm) {
      setErrorMessage("Konfirmasi passphrase tidak cocok.");
      return;
    }
    if (keyPassphrase.length < 8) {
      setErrorMessage("Passphrase kunci minimal 8 karakter.");
      return;
    }

    setProvisioning(true);
    const result = await provisionUserKeys(keyPassphrase);
    // Buang passphrase dari memori browser sesegera mungkin.
    setKeyPassphrase("");
    setKeyConfirm("");
    setProvisioning(false);

    if (result.success) {
      router.push("/dashboard");
    } else if (result.keygenUnavailable) {
      setErrorMessage(
        "Layanan pembuatan kunci (Modul A) belum aktif, jadi kunci belum bisa dibuat. Anda tetap bisa masuk — coba lagi nanti setelah Modul A selesai."
      );
    } else {
      setErrorMessage(result.error ?? "Gagal membuat kunci digital.");
    }
  };

  return (
    <div className="max-w-2xl py-6">
      <h1 className="text-3xl font-semibold text-ink mb-2">Masuk ke Akun</h1>
      <p className="text-ink-muted mb-6">
        Masuk untuk mengakses dashboard dokumen dan kunci digital Anda.
      </p>

      {errorMessage && (
        <div className="mb-6 p-4 rounded bg-invalid-bg text-invalid border border-invalid/30 text-sm">
          {errorMessage}
        </div>
      )}

      {infoMessage && (
        <div className="mb-6 p-4 rounded bg-valid-bg text-valid border border-valid/30 text-sm">
          {infoMessage}
        </div>
      )}

      {needsKey && (
        <div className="mb-6 border border-border p-6 rounded bg-paper">
          <h2 className="text-sm font-semibold text-ink mb-1">
            Buat kunci digital Anda
          </h2>
          <p className="text-xs text-ink-muted mb-4 leading-relaxed">
            Kunci privat akan dibangkitkan dan langsung disimpan terenkripsi
            (AES-256-GCM). Sistem tidak pernah menyimpan passphrase Anda.
          </p>
          <form onSubmit={handleProvisionKey} className="space-y-4">
            <div>
              <label
                htmlFor="keyPassphrase"
                className="block text-sm font-medium text-ink mb-1.5"
              >
                Passphrase kunci (min. 8 karakter)
              </label>
              <input
                id="keyPassphrase"
                type="password"
                required
                minLength={8}
                value={keyPassphrase}
                onChange={(e) => setKeyPassphrase(e.target.value)}
                placeholder="Minimal 8 karakter"
                className="w-full px-3.5 py-2 border border-border rounded bg-white text-ink text-sm focus:outline-none focus:border-seal transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="keyConfirm"
                className="block text-sm font-medium text-ink mb-1.5"
              >
                Ulangi passphrase kunci
              </label>
              <input
                id="keyConfirm"
                type="password"
                required
                minLength={8}
                value={keyConfirm}
                onChange={(e) => setKeyConfirm(e.target.value)}
                placeholder="Ulangi passphrase"
                className="w-full px-3.5 py-2 border border-border rounded bg-white text-ink text-sm focus:outline-none focus:border-seal transition-colors"
              />
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="submit"
                disabled={provisioning}
                className="px-6 py-2.5 bg-seal hover:bg-seal-dark text-white text-sm font-medium rounded transition-colors disabled:opacity-50"
              >
                {provisioning ? "Membuat kunci..." : "Buat kunci digital"}
              </button>
              <button
                type="button"
                disabled={provisioning}
                onClick={() => router.push("/dashboard")}
                className="px-6 py-2.5 border border-border text-ink text-sm font-medium rounded hover:bg-black/5 transition-colors disabled:opacity-50"
              >
                Lewati dulu
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="border border-border p-6 rounded bg-paper">
        <form onSubmit={handleLogin} className="space-y-5">
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
              placeholder="nama@institusi.ac.id"
              className="w-full px-3.5 py-2 border border-border rounded bg-white text-ink text-sm focus:outline-none focus:border-seal transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-ink mb-1.5"
            >
              Kata Sandi
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2 border border-border rounded bg-white text-ink text-sm focus:outline-none focus:border-seal transition-colors"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2.5 bg-seal hover:bg-seal-dark text-white text-sm font-medium rounded transition-colors disabled:opacity-50"
            >
              {loading ? "Memproses..." : "Masuk ke akun"}
            </button>
          </div>
        </form>
      </div>

      <p className="mt-6 text-sm text-ink-muted">
        Belum memiliki akun?{" "}
        <Link href="/register" className="text-seal hover:underline font-medium">
          Daftar sekarang
        </Link>
      </p>
    </div>
  );
}
