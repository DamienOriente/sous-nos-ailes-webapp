import { NextResponse } from "next/server";
import { requireActorOrThrow } from "@/lib/session";
import { getFileStatus } from "@/modules/files/application/file-service";
import { errorResponse, NO_STORE, requestMeta } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Polled by the FileUpload component until the status is terminal. */
export async function GET(request: Request, ctx: RouteContext<"/api/files/[id]/status">) {
  try {
    const actor = await requireActorOrThrow();
    const { id } = await ctx.params;
    const status = await getFileStatus(actor, id, requestMeta(request));
    return NextResponse.json(status, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}
