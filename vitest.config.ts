import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // Muat environment variable dari .env.local jika ada
  const env = loadEnv(mode, process.cwd(), "");

  return {
    test: {
      environment: "node",
      env: {
        NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL || "https://cojtpapxjicmixfxhigb.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy-anon-key",
      },
    },
  };
});
