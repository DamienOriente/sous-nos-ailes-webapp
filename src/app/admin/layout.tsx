import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import type { NavItem } from "@/components/layout/app-nav-links";
import { requireActor } from "@/lib/session";
import { canGlobal } from "@/modules/authorization";
import { countUnreadNotifications } from "@/modules/notifications/application/notification-service";

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Tableau de bord", icon: "dashboard", exact: true },
  { href: "/admin/moderation", label: "Modération", icon: "verification" },
  { href: "/admin/signalements", label: "Signalements", icon: "reports" },
  { href: "/admin/utilisateurs", label: "Utilisateurs", icon: "guests" },
  { href: "/admin/professionnels", label: "Professionnels", icon: "store" },
  { href: "/admin/categories", label: "Catégories et métiers", icon: "tags" },
  { href: "/admin/outils", label: "Catalogue d'outils", icon: "tools" },
  { href: "/admin/offres", label: "Offres et abonnements", icon: "billing" },
  { href: "/admin/contenus", label: "Contenus éditoriaux", icon: "content" },
  { href: "/admin/rgpd", label: "RGPD et demandes", icon: "shield" },
  { href: "/admin/securite", label: "Sécurité et audit", icon: "security" },
  { href: "/admin/parametres", label: "Paramètres", icon: "settings" },
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
