import path from "node:path";
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // Muat environment variable untuk test.
  //
  // CATATAN: Vite dengan sengaja TIDAK memuat .env.local ketika mode === "test"
  // (untuk isolasi antar test), sedangkan di project ini seluruh kredensial
  // Supabase disimpan di .env.local. Karena itu .env.local dimuat eksplisit
  // lewat mode "development" — mode ini tetap memuat .env dan .env.local.
  //
  // Tidak ada URL / API key yang ditulis langsung di file ini: semua nilai
  // hanya berasal dari environment, sehingga tidak ada credential yang
  // ikut ter-commit ke repository.
  const env: Record<string, string> = {
    ...loadEnv(mode, process.cwd(), ""),
    ...loadEnv("development", process.cwd(), ""),
  };

  return {
    resolve: {
      // Alias yang sama dengan tsconfig.json ("@/*": ["./*"]) supaya test
      // dapat mengimpor modul aplikasi dengan cara yang sama seperti production code.
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    test: {
      environment: "node",
      // Environment yang diteruskan ke test. Test yang membutuhkan Supabase
      // akan memvalidasi ketersediaannya sendiri dan gagal dengan pesan jelas
      // bila kredensial belum dikonfigurasi.
      env: {
        NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL ?? "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
        SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY ?? "",
        NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET:
          env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "",
      },
    },
  };
});
