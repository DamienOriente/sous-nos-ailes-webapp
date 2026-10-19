import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";
import { getActor } from "@/lib/session";
import { requireFeature } from "@/modules/billing/application/entitlements";
import { budgetCsv } from "@/modules/events/application/budget-service";

/** CSV export of the budget — premium (budget.advanced), organisers with budget.view. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  try {
    await requireFeature(actor, "organizer", "budget.advanced");
    const csv = await budgetCsv(actor, id);
    return new NextResponse(csv, { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="budget-${id.slice(0, 8)}.csv"`, "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (isAppError(e)) return NextResponse.json({ error: e.message }, { status: e.code === "forbidden" ? 404 : e.status });
    throw e;
  }
}
