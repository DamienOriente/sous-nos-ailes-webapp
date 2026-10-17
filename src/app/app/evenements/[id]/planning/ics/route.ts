import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";
import { getActor } from "@/lib/session";
import { buildEventIcs } from "@/modules/events/application/milestone-service";

/** ICS export of the day (event + milestones). Authenticated; members only. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  try {
    const { filename, body } = await buildEventIcs(actor, id);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (isAppError(e)) return NextResponse.json({ error: e.message }, { status: e.code === "forbidden" ? 404 : e.status });
    throw e;
  }
}
