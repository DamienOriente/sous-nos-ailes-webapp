import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge proxy (Next 16 name for middleware): per-request nonce for the CSP,
 * correlation id, and a cheap optimistic redirect for private areas when no
 * session cookie is present. Real authorisation happens server side in layouts
 * and services — this is a UX shortcut, never a security boundary.
 */
const PRIVATE_PREFIXES = ["/app", "/admin", "/onboarding"];

function buildCsp(nonce: string, isDev: boolean, https: boolean, imageOrigins: string[]): string {
  // Dev: Turbopack/HMR inject inline scripts without nonce, and a nonce disables 'unsafe-inline'.
  // Prod: nonce + strict-dynamic, Next tags its own inline scripts with the nonce from the request header.
  const scriptSrc = isDev ? `'self' 'unsafe-eval' 'unsafe-inline'` : `'self' 'nonce-${nonce}' 'strict-dynamic'`;
  const connectSrc = isDev ? "'self' ws: wss: http://localhost:* http://127.0.0.1:*" : "'self' https://api.stripe.com";
  return [
    `default-src 'self'`,
    `script-src ${scriptSrc} https://js.stripe.com`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https: ${imageOrigins.join(" ")}`.trim(),
    `font-src 'self' data:`,
    `connect-src ${connectSrc}`,
    `frame-src https://js.stripe.com https://checkout.stripe.com`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self' https://checkout.stripe.com`,
    `object-src 'none'`,
    // Only when the site is served over HTTPS (a local production build on http:// would upgrade its own prefetches and fail).
    https ? "upgrade-insecure-requests" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const isDev = process.env.NODE_ENV !== "production";

  const { pathname } = request.nextUrl;
  const isPrivate = PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const hasSessionCookie = request.cookies.getAll().some((c) => c.name.includes("session_token") || c.name.includes("session_data"));
  if (isPrivate && !hasSessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  const https = (process.env.APP_URL ?? "").startsWith("https://");
  // Signed image URLs point at the object storage endpoint (MinIO locally, S3 in production).
  const imageOrigins: string[] = [];
  for (const raw of [process.env.S3_ENDPOINT, process.env.S3_PUBLIC_ENDPOINT]) {
    if (!raw) continue;
    try {
      imageOrigins.push(new URL(raw).origin);
    } catch {
      // ignore malformed values: env validation reports them
    }
  }
  const csp = buildCsp(nonce, isDev, https, imageOrigins);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-request-id", requestId);
  // Next.js reads the nonce from the request CSP header to tag its own inline scripts.
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-request-id", requestId);
  if (!isDev) response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  return response;
}

export const config = {
  matcher: [
    // Skip static assets and Next internals; API routes get headers from next.config.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|woff2?)$).*)",
  ],
};
