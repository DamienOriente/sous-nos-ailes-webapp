import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";
import { getActor } from "@/lib/session";
import { budgetCsv } from "@/modules/events/application/budget-service";
import { listProviders } from "@/modules/events/application/provider-service";
import { listTasks } from "@/modules/events/application/task-service";
import { toCsv } from "@/modules/events/domain/budget";
import { PROVIDER_STATUS_LABELS } from "@/modules/events/domain/providers";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/modules/events/domain/task-labels";

/** End-of-event exports (free): ?kind=tasks|budget|providers. Each list is filtered by the actor's own permissions. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const kind = new URL(req.url).searchParams.get("kind") ?? "tasks";
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  try {
    let csv: string;
    if (kind === "budget") csv = await budgetCsv(actor, id);
    else if (kind === "providers") {
      const { providers } = await listProviders(actor, id);
      csv = toCsv([["Catégorie", "Prestataire", "Type", "Statut", "Devis (€)", "Début", "Fin", "E-mail", "Téléphone"], ...providers.map((p) => [p.categoryName, p.displayName, p.isExternal ? "externe" : "plateforme", PROVIDER_STATUS_LABELS[p.status], p.quoteCents !== null ? p.quoteCents / 100 : "", p.serviceStartsAt?.toISOString() ?? "", p.serviceEndsAt?.toISOString() ?? "", p.externalEmail, p.externalPhone])]);
    } else {
      const { tasks } = await listTasks(actor, id);
      csv = toCsv([["Section", "Titre", "Statut", "Priorité", "Échéance", "Assigné à", "Terminée le"], ...tasks.map((t) => [t.section, t.title, TASK_STATUS_LABELS[t.status], TASK_PRIORITY_LABELS[t.priority], t.dueDate, t.assigneeName, t.completedAt?.toISOString().slice(0, 10) ?? ""])]);
    }
    return new NextResponse(csv, { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${kind}-${id.slice(0, 8)}.csv"`, "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (isAppError(e)) return NextResponse.json({ error: e.message }, { status: e.code === "forbidden" ? 404 : e.status });
    throw e;
  }
}
