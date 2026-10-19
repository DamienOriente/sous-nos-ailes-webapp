import { NextResponse } from "next/server";
import { getActor } from "@/lib/session";
import { canGlobal } from "@/modules/authorization";
import { exportAuditLogsCsv } from "@/modules/admin/application/security-service";

export const dynamic = "force-dynamic";

/** CSV export of the audit log with the same filters as the page. Audited itself. */
export async function GET(request: Request) {
  const actor = await getActor();
  if (!actor || !canGlobal(actor, "admin.security.view")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const sp = new URL(request.url).searchParams;
  const csv = await exportAuditLogsCsv(actor, {
    actorUserId: sp.get("acteur") || undefined,
    action: sp.get("action") || undefined,
    resourceType: sp.get("ressource") || undefined,
    resourceId: sp.get("id") || undefined,
    from: sp.get("du") ? new Date(sp.get("du") as string) : undefined,
    to: sp.get("au") ? new Date(`${sp.get("au")}T23:59:59`) : undefined,
  });
  return new NextResponse(`﻿${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="audit-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
}
