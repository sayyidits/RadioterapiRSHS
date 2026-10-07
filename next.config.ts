import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Semua halaman membaca sesi login per request, jadi Cache Components dimatikan
  // agar render tetap dinamis seperti biasa.

  // Mode demo: PGlite (Postgres WASM) dimuat langsung oleh Node, bukan di-bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Migration SQL dibaca saat runtime oleh mode demo
  outputFileTracingIncludes: {
    "/**": ["./supabase/migrations/*.sql"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
