"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FaArrowRight } from "react-icons/fa6";
import { supabase } from "@/lib/auth/session";

export default function LandingCTA() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    if (!supabase) {
      setIsLoggedIn(false);
      return;
    }
    
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  if (isLoggedIn === null) {
    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-5 opacity-0">
        {/* Placeholder to prevent layout shift */}
        <div className="h-14 w-48" />
      </div>
    );
  }

  if (isLoggedIn) {
    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-5 animate-in fade-in zoom-in duration-300">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-lg px-8 py-4 text-base font-semibold text-paper transition-all duration-200 hover:brightness-110 hover:shadow-xl hover:shadow-seal/30 active:scale-95"
          style={{ background: "linear-gradient(135deg, #B08D2F, #8A6E22)" }}
        >
          Ke Dashboard Saya
          <FaArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/sign"
          className="inline-flex items-center gap-2 rounded-lg border-2 border-border px-8 py-4 text-base font-semibold text-ink transition-all duration-200 hover:border-seal hover:bg-seal/5 active:scale-95"
        >
          Tandatangani Dokumen
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-5 animate-in fade-in zoom-in duration-300">
      <Link
        href="/register"
        className="inline-flex items-center gap-2 rounded-lg px-8 py-4 text-base font-semibold text-paper transition-all duration-200 hover:brightness-110 hover:shadow-xl hover:shadow-seal/30 active:scale-95"
        style={{ background: "linear-gradient(135deg, #B08D2F, #8A6E22)" }}
      >
        Buat Akun Gratis
        <FaArrowRight className="h-4 w-4" />
      </Link>
      <Link
        href="/login"
        className="inline-flex items-center gap-2 rounded-lg border-2 border-border px-8 py-4 text-base font-semibold text-ink transition-all duration-200 hover:border-seal hover:bg-seal/5 active:scale-95"
      >
        Masuk
      </Link>
    </div>
  );
}
