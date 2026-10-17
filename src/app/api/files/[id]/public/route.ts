import { NextResponse } from "next/server";
import { getActor } from "@/lib/session";
import { issuePublicImageUrl } from "@/modules/files/application/file-service";
import type { ImageVariant } from "@/modules/files/application/file-urls";
import { errorResponse, requestMeta } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VARIANTS: ReadonlySet<string> = new Set(["thumb", "medium", "large", "original"]);

/**
 * Public rendition of a listing image: only logo/cover/gallery files of a
 * published professional (or any image the caller is allowed to see).
 * Redirects to a 1 h signed URL; the redirect itself is cacheable for 30 min.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/files/[id]/public">) {
  try {
    const { id } = await ctx.params;
    const v = new URL(request.url).searchParams.get("v") ?? "medium";
    const variant = (VARIANTS.has(v) ? v : "medium") as ImageVariant;
    const actor = await getActor().catch(() => null);
    const { url } = await issuePublicImageUrl(actor, id, variant, requestMeta(request));
    return NextResponse.redirect(url, {
      status: 302,
      headers: { "Cache-Control": actor ? "private, max-age=600" : "public, max-age=1800, stale-while-revalidate=300" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
