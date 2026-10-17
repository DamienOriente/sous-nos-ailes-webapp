import { NextResponse, type NextRequest } from "next/server";
import { isAppError } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { exportContactsCsv } from "@/modules/contacts/application/contact-service";

/** CSV export of the contacts the actor is allowed to read (personal + organisations), optionally narrowed by scope. */
export async function GET(request: NextRequest) {
  try {
    const actor = await requireActorOrThrow();
    const scope = request.nextUrl.searchParams.get("scope") ?? "all";
    if (!/^(all|personal|[0-9a-f-]{36})$/.test(scope)) return NextResponse.json({ error: "scope invalide" }, { status: 400 });
    const csv = await exportContactsCsv(actor, scope);
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="contacts-${date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (isAppError(e)) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
