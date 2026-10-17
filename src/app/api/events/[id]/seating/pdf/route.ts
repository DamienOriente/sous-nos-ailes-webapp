import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { renderSeatingPdf } from "@/modules/seating/application/seating-pdf";
import { assertSeatingEntitlement, getSeatingPlan } from "@/modules/seating/application/seating-service";

/** Vector PDF of the plan + per-table lists. Requires `event.seating.view` and the premium entitlement. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const actor = await requireActorOrThrow();
    const plan = await getSeatingPlan(actor, id);
    await assertSeatingEntitlement(id);
    const pdf = await renderSeatingPdf(plan);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="plan-de-table-${id.slice(0, 8)}.pdf"`, "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    if (isAppError(e)) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
