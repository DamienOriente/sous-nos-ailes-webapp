import Link from "next/link";
import { Download } from "lucide-react";
import { AdminTable, dateTime } from "@/components/admin/admin-table";
import { TwoFactorBanner } from "@/components/admin/two-factor-banner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { canGlobal } from "@/modules/authorization";
import { listAuditLogs, listSecurityEvents } from "@/modules/admin/application/security-service";
import { requireAdminPage } from "../_lib/admin-page";

export const dynamic = "force-dynamic";

type Search = { acteur?: string; action?: string; ressource?: string; id?: string; du?: string; au?: string };

type HealthModule = { getQueueStats?: () => Promise<{ available: boolean; queues: Record<string, { waiting: number; active: number; delayed: number; failed: number; completed: number }> }> };

export function SecuritySubnav({ current, showBreakGlass }: { current: string; showBreakGlass: boolean }) {
  const items = [
    { href: "/admin/securite", label: "Audit et évènements" },
    { href: "/admin/securite/sessions", label: "Sessions actives" },
    ...(showBreakGlass ? [{ href: "/admin/securite/break-glass", label: "Accès exceptionnel (break-glass)" }] : []),
  ];
  return (
    <nav aria-label="Sécurité" className="flex flex-wrap gap-2 text-sm">
      {items.map((s) => (
        <Link key={s.href} href={s.href} className={`rounded-full border px-3 py-1 ${current === s.href ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted"}`} aria-current={current === s.href ? "page" : undefined}>
          {s.label}
        </Link>
      ))}
    </nav>
  );
}

export default async function SecurityPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { actor, twoFactorWarning } = await requireAdminPage("admin.security.view", "/admin/securite");
  const sp = await searchParams;
  const filter = { actorUserId: sp.acteur || undefined, action: sp.action || undefined, resourceType: sp.ressource || undefined, resourceId: sp.id || undefined, from: sp.du ? new Date(sp.du) : undefined, to: sp.au ? new Date(`${sp.au}T23:59:59`) : undefined, limit: 200 };
  const health = (await import("@/workers/health").catch(() => null)) as HealthModule | null;
  const [audit, events, queues] = await Promise.all([listAuditLogs(actor, filter), listSecurityEvents(actor, { limit: 50 }), health?.getQueueStats ? health.getQueueStats() : Promise.resolve(null)]);
  const exportQs = new URLSearchParams(Object.entries(sp).filter(([, v]) => Boolean(v)) as [string, string][]).toString();
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administration" title="Sécurité et audit" description="Journal d'audit filtrable (export CSV), évènements de sécurité, état des files de traitement." actions={<Button asChild variant="outline" size="sm"><a href={`/admin/securite/export${exportQs ? `?${exportQs}` : ""}`}><Download className="size-4" aria-hidden="true" /> Export CSV</a></Button>} />
      <TwoFactorBanner show={twoFactorWarning} />
      <SecuritySubnav current="/admin/securite" showBreakGlass={canGlobal(actor, "admin.break_glass")} />
      <Card className="gap-3 p-6">
        <h2 className="font-semibold">Files de traitement</h2>
        {!queues ? <p className="text-sm text-muted-foreground">Module worker indisponible.</p> : !queues.available ? <p className="text-sm text-muted-foreground">Redis injoignable.</p> : (
          <ul className="grid gap-1 text-sm sm:grid-cols-3">
            {Object.entries(queues.queues).map(([name, q]) => (
              <li key={name} className="flex justify-between rounded-lg bg-muted/50 px-3 py-2"><span>{name}</span><span className="tabular-nums text-muted-foreground">{q.waiting} att. · {q.active} actifs · {q.delayed} différés · <span className={q.failed > 0 ? "text-destructive" : ""}>{q.failed} échecs</span></span></li>
            ))}
          </ul>
        )}
      </Card>
      <section className="space-y-3" aria-labelledby="events">
        <h2 id="events" className="text-lg font-semibold">Évènements de sécurité (50 derniers)</h2>
        <AdminTable
          rows={events}
          rowKey={(r) => r.id}
          emptyTitle="Aucun évènement de sécurité"
          columns={[
            { key: "sev", header: "Sévérité", cell: (r) => <StatusBadge tone={r.severity === "critical" || r.severity === "high" ? "danger" : r.severity === "medium" ? "warning" : "neutral"}>{r.severity}</StatusBadge> },
            { key: "type", header: "Type", cell: (r) => <code className="text-xs">{r.type}</code> },
            { key: "user", header: "Compte", cell: (r) => r.userEmail ?? <span className="text-muted-foreground">—</span> },
            { key: "ip", header: "IP", cell: (r) => <span className="text-muted-foreground">{r.ipAddress ?? "—"}</span> },
            { key: "details", header: "Détails", cell: (r) => <code className="text-xs text-muted-foreground">{JSON.stringify(r.details).slice(0, 80)}</code> },
            { key: "date", header: "Date", cell: (r) => <span className="text-muted-foreground">{dateTime(r.createdAt)}</span> },
          ]}
        />
      </section>
      <section className="space-y-3" aria-labelledby="audit">
        <h2 id="audit" className="text-lg font-semibold">Journal d'audit</h2>
        <form className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6" role="search">
          <Input name="acteur" placeholder="Id acteur" defaultValue={sp.acteur ?? ""} aria-label="Acteur" />
          <Input name="action" placeholder="Action (contient)" defaultValue={sp.action ?? ""} aria-label="Action" />
          <Input name="ressource" placeholder="Type de ressource" defaultValue={sp.ressource ?? ""} aria-label="Type de ressource" />
          <Input name="id" placeholder="Id ressource" defaultValue={sp.id ?? ""} aria-label="Id ressource" />
          <Input name="du" type="date" defaultValue={sp.du ?? ""} aria-label="Du" />
          <div className="flex gap-2">
            <Input name="au" type="date" defaultValue={sp.au ?? ""} aria-label="Au" />
            <Button type="submit" variant="outline">Filtrer</Button>
          </div>
        </form>
        <AdminTable
          rows={audit}
          rowKey={(r) => r.id}
          emptyTitle="Aucune entrée d'audit"
          columns={[
            { key: "date", header: "Date", cell: (r) => <span className="text-muted-foreground">{dateTime(r.createdAt)}</span> },
            { key: "actor", header: "Acteur", cell: (r) => r.actorEmail ?? <span className="text-muted-foreground">système</span> },
            { key: "action", header: "Action", cell: (r) => <code className="text-xs">{r.action}</code> },
            { key: "res", header: "Ressource", cell: (r) => <span>{r.resourceType} <code className="text-xs text-muted-foreground">{r.resourceId?.slice(0, 8)}</code></span> },
            { key: "reason", header: "Motif / méta", cell: (r) => <span className="text-xs text-muted-foreground">{r.reason ?? JSON.stringify(r.metadata).slice(0, 80)}</span> },
          ]}
        />
      </section>
    </div>
  );
}
