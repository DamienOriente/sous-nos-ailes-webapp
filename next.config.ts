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
    // Narrow srcset: phones ask for 640-828 px, desktops up to 1920 px (no 3840 px candidate for a 560 px frame).
    deviceSizes: [360, 640, 828, 1200, 1920],
    imageSizes: [320, 480],
    formats: ["image/avif", "image/webp"],
    // Demo photography (Unsplash licence) used only for fictitious profiles and marketing pages.
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
  experimental: {
    // Inline the (small) CSS in the HTML: one render-blocking request less.
    inlineCss: true,
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
      {
        // Self-hosted font files never change under the same name.
        source: "/fonts/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
