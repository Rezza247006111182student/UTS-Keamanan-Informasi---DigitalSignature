"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/auth/session";

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(error.message || "Gagal masuk. Periksa kembali email dan kata sandi Anda.");
        setLoading(false);
        return;
      }

      if (data.session) {
        router.push("/dashboard");
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
