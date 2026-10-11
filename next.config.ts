import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Origin Supabase (mis. https://xxxx.supabase.co). Browser tidak memanggil Supabase langsung
// (semua lewat server), tapi login Google tanpa JS adalah POST form yang di-redirect ke sana.
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();

/**
 * Content-Security-Policy tanpa nonce. React butuh 'unsafe-eval' hanya saat development.
 * Script inline milik Next masih butuh 'unsafe-inline'; nonce bisa jadi tahap berikutnya.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  `form-action 'self' ${supabaseOrigin} https://accounts.google.com`.trim(),
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Anti-clickjacking untuk browser lama yang belum paham frame-ancestors
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Semua halaman membaca sesi login per request, jadi Cache Components dimatikan
  // agar render tetap dinamis seperti biasa.

  // Mode demo: PGlite (Postgres WASM) dimuat langsung oleh Node, bukan di-bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Migration SQL dibaca saat runtime oleh mode demo
  outputFileTracingIncludes: {
    "/**": ["./supabase/migrations/*.sql"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
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
