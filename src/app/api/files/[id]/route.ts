import { NextResponse } from "next/server";
import { requireActorOrThrow } from "@/lib/session";
import { deleteFile, issueFileUrl } from "@/modules/files/application/file-service";
import { errorResponse, NO_STORE, requestMeta } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: authorisation → 302 to a 5-minute signed URL. `?download=1` forces an attachment disposition. */
export async function GET(request: Request, ctx: RouteContext<"/api/files/[id]">) {
  try {
    const actor = await requireActorOrThrow();
    const { id } = await ctx.params;
    const download = new URL(request.url).searchParams.get("download") === "1";
    const { url } = await issueFileUrl(actor, id, { download, ...requestMeta(request) });
    return NextResponse.redirect(url, { status: 302, headers: { ...NO_STORE, Pragma: "no-cache" } });
  } catch (err) {
    return errorResponse(err);
  }
}

/** DELETE: soft delete + removal of stored objects (uploader or scope manager). */
export async function DELETE(request: Request, ctx: RouteContext<"/api/files/[id]">) {
  try {
    const actor = await requireActorOrThrow();
    const { id } = await ctx.params;
    await deleteFile(actor, id, requestMeta(request));
    return new NextResponse(null, { status: 204, headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}
