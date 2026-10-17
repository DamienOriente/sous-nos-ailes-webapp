import { getCurrentAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { qrCodePng } from "@/lib/qr";
import { referralUrlFor } from "@/server/services/venues";

// PNG of the partner's referral QR code. Pages use requirePartner (redirects);
// a route handler answers 404 instead so nothing about the venue leaks.
export async function GET(): Promise<Response> {
  const auth = await getCurrentAuth();
  if (!auth || auth.user.role !== "PARTNER") return new Response(null, { status: 404 });
  const venue = await db.partnerVenue.findUnique({ where: { partnerUserId: auth.user.id }, select: { slug: true, referralCode: true } });
  if (!venue) return new Response(null, { status: 404 });
  const png = await qrCodePng(referralUrlFor(venue.referralCode));
  return new Response(new Uint8Array(png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="qr-${venue.slug}.png"`,
      "Cache-Control": "private, no-store",
    },
  });
}
