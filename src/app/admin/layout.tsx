import type { Metadata } from "next";
import { requireAdmin } from "@/server/authz";
import { getSettings } from "@/server/services/settings";
import { getCurrentPath } from "@/components/shell/current-path";
import { PrivateShell, type NavItem } from "@/components/shell/private-shell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const NAV: NavItem[] = [
  { href: "/admin", label: "Tableau de bord", exact: true },
  { href: "/admin/evenements", label: "Demandes et événements" },
  { href: "/admin/planning", label: "Planning" },
  { href: "/admin/intervenants", label: "Intervenant·es" },
  { href: "/admin/lieux", label: "Lieux partenaires" },
  { href: "/admin/candidatures", label: "Candidatures et contacts" },
  { href: "/admin/parametres", label: "Paramètres" },
  { href: "/admin/contenus", label: "Contenus" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();
  const [settings, currentPath] = await Promise.all([getSettings(), getCurrentPath()]);
  return (
    <PrivateShell user={user} spaceLabel="Espace de gestion" nav={NAV} currentPath={currentPath} brandName={settings.brandName}>
      <div className="flex flex-col gap-8">{children}</div>
    </PrivateShell>
  );
}
