import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Semua halaman membaca sesi login per request, jadi Cache Components dimatikan
  // agar render tetap dinamis seperti biasa.
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
