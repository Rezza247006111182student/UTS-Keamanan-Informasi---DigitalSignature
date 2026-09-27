"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isSupabaseConfigured, supabase } from "./session";

/**
 * Guard untuk halaman yang butuh login (dashboard, sign).
 * Tanggung Jawab: Anggota B — pembatasan akses, bukan fitur dokumen C.
 *
 * - Saat Supabase belum dikonfigurasi: tampilkan pesan setup.
 * - Saat belum login: tampilkan kartu ajakan Masuk/Daftar (sesuai DESIGN_GUIDE,
 *   border hairline, radius 4px, tombol seal).
 * - Saat sudah login: render children (area kerja Anggota C tetap tampil).
 *
 * Dipakai di app/dashboard/page.tsx dan app/sign/page.tsx.
 * app/verify/page.tsx SENGAJA tidak dibungkus — verifikasi boleh anon
 * (sesuai PROJECT_CONTEXT: "Siapa pun bisa memverifikasi").
 */
export default function RequireAuth({
  children,
  title = "Perlu masuk untuk melanjutkan",
  description = "Masuk untuk mengakses fitur ini. Akun Anda menyimpan kunci digital terenkripsi yang diperlukan untuk menandatangani dokumen.",
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
}) {
  const [status, setStatus] = useState<"loading" | "anon" | "authed" | "no-config">("loading");

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setStatus("no-config");
      return;
    }

    let mounted = true;

    async function check() {
      const {
        data: { user },
      } = await supabase!.auth.getUser();
      if (!mounted) return;
      setStatus(user ? "authed" : "anon");
    }

    check();

    const { data: sub } = supabase!.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      setStatus(session?.user ? "authed" : "anon");
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="border border-border rounded bg-paper p-8">
        <div className="h-5 w-48 animate-pulse bg-border/60 rounded mb-3" />
        <div className="h-4 w-full animate-pulse bg-border/40 rounded" />
      </div>
    );
  }

  if (status === "no-config") {
    return (
      <div className="border border-invalid/30 rounded bg-invalid-bg p-6">
        <p className="text-sm font-medium text-invalid mb-1">Konfigurasi belum lengkap</p>
        <p className="text-sm text-invalid/80">
          Supabase belum dikonfigurasi. Isi <span className="font-mono-data">NEXT_PUBLIC_SUPABASE_URL</span> dan{" "}
          <span className="font-mono-data">NEXT_PUBLIC_SUPABASE_ANON_KEY</span> di <span className="font-mono-data">.env.local</span>.
        </p>
      </div>
    );
  }

  if (status === "anon") {
    return (
      <div className="border border-border rounded bg-paper p-8">
        <h2 className="font-serif text-lg font-semibold text-ink mb-2">{title}</h2>
        <p className="text-sm text-ink-muted mb-6 leading-relaxed max-w-xl">{description}</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/login"
            className="px-5 py-2.5 bg-seal hover:bg-seal-dark text-white text-sm font-medium rounded transition-colors"
          >
            Masuk ke akun
          </Link>
          <Link
            href="/register"
            className="px-5 py-2.5 border border-border text-ink text-sm font-medium rounded hover:bg-black/5 transition-colors"
          >
            Daftar akun baru
          </Link>
        </div>
        <p className="text-xs text-ink-muted mt-4">
          Verifikasi dokumen tetap bisa dilakukan tanpa masuk melalui halaman{" "}
          <Link href="/verify" className="text-seal hover:underline">
            Verifikasi
          </Link>
          .
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
