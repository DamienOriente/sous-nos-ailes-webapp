import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { exportUserCalendarIcs } from "@/modules/calendar/application/ics-export";

/** Authenticated personal ICS export (download). */
export async function GET() {
  try {
    const actor = await requireActorOrThrow();
    const ics = await exportUserCalendarIcs(actor);
    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="sous-nos-ailes-${new Date().toISOString().slice(0, 10)}.ics"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (isAppError(e)) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
