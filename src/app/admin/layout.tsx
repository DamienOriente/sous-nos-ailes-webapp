import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import type { NavItem } from "@/components/layout/app-nav-links";
import { requireActor } from "@/lib/session";
import { canGlobal } from "@/modules/authorization";
import { countUnreadNotifications } from "@/modules/notifications/application/notification-service";

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Tableau de bord", exact: true },
  { href: "/admin/moderation", label: "Modération" },
  { href: "/admin/signalements", label: "Signalements" },
  { href: "/admin/utilisateurs", label: "Utilisateurs" },
  { href: "/admin/professionnels", label: "Professionnels" },
  { href: "/admin/categories", label: "Catégories et métiers" },
  { href: "/admin/outils", label: "Catalogue d'outils" },
  { href: "/admin/offres", label: "Offres et abonnements" },
  { href: "/admin/contenus", label: "Contenus éditoriaux" },
  { href: "/admin/rgpd", label: "RGPD et demandes" },
  { href: "/admin/securite", label: "Sécurité et audit" },
  { href: "/admin/parametres", label: "Paramètres" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor("/admin");
  if (!canGlobal(actor, "admin.dashboard")) redirect("/app");
  const unread = await countUnreadNotifications(actor.userId);
  return (
    <AppShell actor={actor} unreadCount={unread} secondaryNav={{ title: "Administration", items: ADMIN_NAV }}>
      {children}
    </AppShell>
  );
}
