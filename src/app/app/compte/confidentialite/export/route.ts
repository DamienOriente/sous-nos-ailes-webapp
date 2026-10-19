import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { exportUserData } from "@/modules/privacy/application/data-export";

export const dynamic = "force-dynamic";

/** Downloads the signed-in person's data as JSON (generated on demand, never stored). */
export async function GET() {
  try {
    const actor = await requireActorOrThrow();
    const data = await exportUserData(actor);
    const filename = `sous-nos-ailes-export-${data.generatedAt.slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (isAppError(e)) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Export impossible pour le moment." }, { status: 500 });
  }
}
