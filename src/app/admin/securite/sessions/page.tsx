import { headers } from "next/headers";
import { ActionForm, ActionSubmit } from "@/components/admin/action-form";
import { AdminTable, dateTime } from "@/components/admin/admin-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { canGlobal } from "@/modules/authorization";
import { listActiveSessions } from "@/modules/admin/application/security-service";
import { requireAdminPage } from "../../_lib/admin-page";
import { revokeSessionAction } from "../../utilisateurs/actions";
import { SecuritySubnav } from "../page";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const { actor } = await requireAdminPage("admin.security.view", "/admin/securite/sessions");
  const rows = await listActiveSessions(actor, await headers());
  const canManage = canGlobal(actor, "admin.users.manage");
  return (
    <div className="space-y-6">
      <PageHeader title="Sessions actives" description="Sessions non expirées des comptes privilégiés et des comptes actifs ces 7 derniers jours (les sessions vivent dans Redis, lues via better-auth). La révocation déconnecte immédiatement l'appareil concerné." />
      <SecuritySubnav current="/admin/securite/sessions" showBreakGlass={canGlobal(actor, "admin.break_glass")} />
      <AdminTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyTitle="Aucune session active"
        columns={[
          { key: "user", header: "Compte", cell: (r) => (<div><span className="font-medium">{r.userEmail}</span> <StatusBadge tone={r.userRole === "user" ? "neutral" : "primary"} dot={false}>{r.userRole}</StatusBadge>{r.impersonatedBy && <StatusBadge tone="warning" className="ml-1">impersonation</StatusBadge>}</div>) },
          { key: "ip", header: "IP / agent", cell: (r) => <span className="text-xs text-muted-foreground">{r.ipAddress ?? "n/d"} · {r.userAgent?.slice(0, 50) ?? "n/d"}</span> },
          { key: "created", header: "Ouverte le", cell: (r) => <span className="text-muted-foreground">{dateTime(r.createdAt)}</span> },
          { key: "expires", header: "Expire le", cell: (r) => <span className="text-muted-foreground">{dateTime(r.expiresAt)}</span> },
          {
            key: "actions",
            header: "",
            cell: (r) =>
              canManage ? (
                <ActionForm action={revokeSessionAction} successMessage="Session révoquée." className="space-y-0">
                  <input type="hidden" name="userId" value={r.userId} />
                  <input type="hidden" name="sessionId" value={r.id} />
                  <ActionSubmit size="sm" variant="outline">Révoquer</ActionSubmit>
                </ActionForm>
              ) : null,
          },
        ]}
      />
    </div>
  );
}
