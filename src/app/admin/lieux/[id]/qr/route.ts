import type { NextRequest } from "next/server";
import { getOptionalUser } from "@/server/authz";
import { referralUrlFor } from "@/server/services/venues";
import { db } from "@/lib/db";
import { qrCodePng } from "@/lib/qr";

/** PNG download of the venue's referral QR code. Admin only; the referral code itself is not a secret. */
export async function GET(_request: NextRequest, context: RouteContext<"/admin/lieux/[id]/qr">) {
  const user = await getOptionalUser();
  if (!user || user.role !== "ADMIN") return new Response("Accès refusé.", { status: 403 });
  const { id } = await context.params;
  const venue = await db.partnerVenue.findUnique({ where: { id }, select: { slug: true, referralCode: true } });
  if (!venue) return new Response("Lieu introuvable.", { status: 404 });
  const png = await qrCodePng(referralUrlFor(venue.referralCode), 768);
  return new Response(new Uint8Array(png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="qr-${venue.slug}.png"`,
      "Cache-Control": "private, no-store",
    },
  });
}
