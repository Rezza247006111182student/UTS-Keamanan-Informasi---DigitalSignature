"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isSupabaseConfigured, supabase } from "./session";

interface HeaderUser {
  id: string;
  email: string | null;
  fullName: string | null;
  role: string | null;
  institution: string | null;
}

/**
 * Header auth-aware untuk layout bersama.
 * Tanggung Jawab: Anggota B (menampilkan status login, bukan fitur C).
 *
 * - Saat belum login: tampilkan tombol Masuk & Daftar (seperti sebelumnya).
 * - Saat sudah login: tampilkan kredensial (nama, peran, institusi, email)
 *   + tombol Keluar. Navigasi Dashboard/Tanda Tangani disembunyikan untuk anon
 *   di layout, tapi Verifikasi tetap terlihat (sesuai spec: siapa pun bisa verify).
 *
 * Mengikuti DESIGN_GUIDE.md: warna seal untuk aksen, border hairline, radius 4px,
 * font sans untuk body, serif untuk nama.
 */
export default function AuthHeader() {
  const router = useRouter();
  const [user, setUser] = useState<HeaderUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    async function loadUser() {
      try {
        const {
          data: { user: authUser },
        } = await supabase!.auth.getUser();

        if (!mounted) return;

        if (!authUser) {
          setUser(null);
          setLoading(false);
          return;
        }

        const { data: profile } = await supabase!
          .from("users")
          .select("full_name, role, institution")
          .eq("id", authUser.id)
          .maybeSingle();

        if (!mounted) return;

        setUser({
          id: authUser.id,
          email: authUser.email ?? null,
          fullName: (profile as { full_name?: string } | null)?.full_name ?? null,
          role: (profile as { role?: string } | null)?.role ?? null,
          institution: (profile as { institution?: string } | null)?.institution ?? null,
        });
      } catch {
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadUser();

    const { data: sub } = supabase!.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      if (!session?.user) {
        setUser(null);
        setLoading(false);
        return;
      }
      // Session ada -> muat ulang profil
      const { data: profile } = await supabase!
        .from("users")
        .select("full_name, role, institution")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!mounted) return;
      setUser({
        id: session.user.id,
        email: session.user.email ?? null,
        fullName: (profile as { full_name?: string } | null)?.full_name ?? null,
        role: (profile as { role?: string } | null)?.role ?? null,
        institution: (profile as { institution?: string } | null)?.institution ?? null,
      });
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setMenuOpen(false);
    router.push("/login");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-3">
        <div className="h-8 w-20 animate-pulse rounded bg-border/60" />
        <div className="h-8 w-20 animate-pulse rounded bg-border/60" />
      </div>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="flex items-center space-x-4 text-sm">
        <span className="text-invalid text-xs hidden sm:inline">
          Supabase belum dikonfigurasi
        </span>
        <Link href="/login" className="text-ink-muted hover:text-ink transition-colors">
          Masuk
        </Link>
        <Link
          href="/register"
          className="border border-border px-3 py-1.5 rounded hover:bg-black/5 transition-colors"
        >
          Daftar
        </Link>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center space-x-4 text-sm">
        <Link href="/login" className="text-ink-muted hover:text-ink transition-colors">
          Masuk
        </Link>
        <Link
          href="/register"
          className="border border-border px-3 py-1.5 rounded bg-seal text-white border-seal hover:bg-seal-dark transition-colors"
        >
          Daftar
        </Link>
      </div>
    );
  }

  const initial = (user.fullName?.trim()?.[0] ?? user.email?.[0] ?? "?").toUpperCase();

  return (
    <div className="flex items-center gap-3">
      {/* Info user — hidden di mobile kecil, tampil di sm+ */}
      <div className="hidden sm:flex flex-col items-end leading-tight mr-1">
        <span className="text-sm font-medium text-ink font-serif truncate max-w-[14rem]">
          {user.fullName ?? user.email ?? "Pengguna"}
        </span>
        <span className="text-xs text-ink-muted truncate max-w-[14rem]">
          {[user.role, user.institution].filter(Boolean).join(" • ") || user.email}
        </span>
      </div>

      {/* Avatar + dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 border border-border rounded px-2.5 py-1.5 bg-white hover:bg-black/[0.03] transition-colors"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded bg-seal text-white text-xs font-semibold">
            {initial}
          </span>
          <span className="hidden sm:inline text-xs text-ink-muted">▾</span>
        </button>

        {menuOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-10 cursor-default"
              aria-label="Tutup menu"
              onClick={() => setMenuOpen(false)}
              tabIndex={-1}
            />
            <div className="absolute right-0 mt-2 w-64 rounded border border-border bg-white shadow-lg z-20 overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-paper">
                <p className="text-sm font-medium text-ink truncate">
                  {user.fullName ?? "Pengguna"}
                </p>
                <p className="text-xs text-ink-muted truncate">{user.email}</p>
                {(user.role || user.institution) && (
                  <p className="text-xs text-ink-muted truncate mt-1">
                    {[user.role, user.institution].filter(Boolean).join(" • ")}
                  </p>
                )}
              </div>
              <div className="p-2">
                <Link
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2 text-sm text-ink hover:bg-black/5 rounded transition-colors"
                >
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 text-sm text-invalid hover:bg-invalid-bg rounded transition-colors"
                >
                  Keluar
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
