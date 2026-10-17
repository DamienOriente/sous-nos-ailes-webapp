import type { NextConfig } from "next";

// Security headers are applied to every response. CSP is enforced in proxy.ts
// with a per-request nonce; the static headers below are the ones that do not
// depend on request context.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=(self), usb=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  serverExternalPackages: ["pino", "pino-pretty", "sharp", "bullmq", "ioredis", "pg"],
  images: {
    formats: ["image/avif", "image/webp"],
    // Demo photography (Unsplash licence) used only for fictitious profiles and marketing pages.
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
