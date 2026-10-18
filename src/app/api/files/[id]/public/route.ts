import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getActor } from "@/lib/session";
import { resolvePublicImage } from "@/modules/files/application/file-service";
import type { ImageVariant } from "@/modules/files/application/file-urls";
import { getObjectStream } from "@/modules/files/infrastructure/s3";
import { errorResponse, requestMeta } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VARIANTS: ReadonlySet<string> = new Set(["thumb", "card", "medium", "large", "original"]);

/**
 * Public rendition of a listing image: only logo/cover/gallery files of a
 * published professional (or any image the caller is allowed to see).
 * The bytes are streamed from this origin (no redirect to a signed URL that
 * changes on every request), so browsers and CDNs can cache them: a file id
 * never changes content. Images that are not public stay private and uncached.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/files/[id]/public">) {
  try {
    const { id } = await ctx.params;
    const v = new URL(request.url).searchParams.get("v") ?? "medium";
    const variant = (VARIANTS.has(v) ? v : "medium") as ImageVariant;
    const actor = await getActor().catch(() => null);
    const { bucket, key, mimeType, publiclyVisible } = await resolvePublicImage(actor, id, variant, requestMeta(request));
    const object = await getObjectStream(bucket, key);
    const headers = new Headers({
      "Content-Type": object.contentType ?? mimeType,
      "Cache-Control": publiclyVisible ? "public, max-age=86400, stale-while-revalidate=604800" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    if (object.contentLength) headers.set("Content-Length", String(object.contentLength));
    return new NextResponse(Readable.toWeb(object.stream) as ReadableStream, { status: 200, headers });
  } catch (err) {
    return errorResponse(err);
  }
}
