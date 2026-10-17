import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { exportGuestsCsv } from "@/modules/guests/application/guest-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const actor = await requireActorOrThrow();
    const csv = await exportGuestsCsv(actor, id);
    return new NextResponse(csv, {
      status: 200,
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="invites-${id.slice(0, 8)}.csv"`, "Cache-Control": "no-store" },
    });
  } catch (e) {
    if (isAppError(e)) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
