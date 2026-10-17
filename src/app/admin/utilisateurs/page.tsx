import Link from "next/link";
import { Search } from "lucide-react";
import { AdminTable, dateTime } from "@/components/admin/admin-table";
import { TwoFactorBanner } from "@/components/admin/two-factor-banner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchUsers } from "@/modules/admin/application/user-admin";
import { requireAdminPage } from "../_lib/admin-page";

export const dynamic = "force-dynamic";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; suspendus?: string }> }) {
  const { actor, twoFactorWarning } = await requireAdminPage("admin.users.view", "/admin/utilisateurs");
  const sp = await searchParams;
  const rows = await searchUsers(actor, sp.q ?? "", { role: sp.role || undefined, banned: sp.suspendus === "1" ? true : undefined });
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administration" title="Utilisateurs" description="Recherche par e-mail ou nom. La fiche détaille rôle, sécurité, fiches pro, évènements (noms uniquement) et historique." />
      <TwoFactorBanner show={twoFactorWarning} />
      <form className="flex flex-wrap items-end gap-2" role="search">
        <div className="flex-1 min-w-56">
          <label htmlFor="q" className="sr-only">
            Rechercher un utilisateur
          </label>
          <Input id="q" name="q" defaultValue={sp.q ?? ""} placeholder="E-mail ou nom" />
        </div>
        <select name="role" defaultValue={sp.role ?? ""} className="h-9 rounded-md border bg-background px-2 text-sm" aria-label="Rôle">
          <option value="">Tous les rôles</option>
          <option value="user">user</option>
          <option value="moderator">moderator</option>
          <option value="admin">admin</option>
          <option value="super_admin">super_admin</option>
        </select>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" name="suspendus" value="1" defaultChecked={sp.suspendus === "1"} /> Suspendus seulement
        </label>
        <Button type="submit" variant="outline">
          <Search className="size-4" aria-hidden="true" /> Rechercher
        </Button>
      </form>
      <AdminTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyTitle="Aucun utilisateur"
        emptyDescription="Modifiez la recherche."
        columns={[
          {
            key: "user",
            header: "Utilisateur",
            cell: (r) => (
              <div>
                <Link href={`/admin/utilisateurs/${r.id}`} className="font-medium hover:underline">
                  {r.name}
                </Link>
                <p className="text-xs text-muted-foreground">{r.email}</p>
              </div>
            ),
          },
          { key: "role", header: "Rôle", cell: (r) => <StatusBadge tone={r.role === "user" ? "neutral" : "primary"} dot={false}>{r.role}</StatusBadge> },
          {
            key: "status",
            header: "Statut",
            cell: (r) => (
              <div className="flex flex-wrap gap-1">
                {r.banned ? <StatusBadge tone="danger">Suspendu{r.banExpires ? ` → ${dateTime(r.banExpires)}` : ""}</StatusBadge> : <StatusBadge tone="success">Actif</StatusBadge>}
                {!r.emailVerified && <StatusBadge tone="warning">e-mail non vérifié</StatusBadge>}
                {r.twoFactorEnabled && <StatusBadge tone="info">2FA</StatusBadge>}
                {r.isDemo && <StatusBadge tone="neutral">démo</StatusBadge>}
              </div>
            ),
          },
          { key: "created", header: "Inscrit le", cell: (r) => <span className="text-muted-foreground">{dateTime(r.createdAt)}</span> },
          { key: "login", header: "Dernière connexion", cell: (r) => <span className="text-muted-foreground">{dateTime(r.lastLoginAt)}</span> },
        ]}
      />
    </div>
  );
}
