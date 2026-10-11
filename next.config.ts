import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Приложението е силно персонализирано (сесии, прогрес), затова използваме
  // класическия динамичен модел вместо Cache Components.
  cacheComponents: false,
  poweredByHeader: false,
  serverExternalPackages: ["@node-rs/argon2", "pg", "unpdf", "mammoth"],
  experimental: {
    // Импорт на документи в админ панела (PDF/DOCX/CSV/JSON до 10 MB)
    serverActions: { bodySizeLimit: "12mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
