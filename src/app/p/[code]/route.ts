import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { resolveReferralCode } from "@/server/services/venues";

export const dynamic = "force-dynamic";

export const REFERRAL_COOKIE = "lpi_ref";
const REFERRAL_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Partner referral entry point: validates the non-sensitive code server-side,
 * stores it in a short-lived first-party HttpOnly cookie, and lands on the
 * venue page (or the request form). No fingerprinting, no third-party tracker.
 */
export async function GET(request: NextRequest, context: RouteContext<"/p/[code]">) {
  const { code } = await context.params;
  const env = getEnv();
  const venue = await resolveReferralCode(code);
  const via = request.nextUrl.searchParams.get("via") === "qr" ? "qr" : "link";
  if (!venue) {
    return NextResponse.redirect(new URL("/demander-un-devis", env.APP_URL));
  }
  const target = new URL(`/lieux/${venue.slug}`, env.APP_URL);
  const response = NextResponse.redirect(target);
  response.cookies.set(REFERRAL_COOKIE, `${venue.referralCode}.${via}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: REFERRAL_TTL_SECONDS,
  });
  return response;
}
