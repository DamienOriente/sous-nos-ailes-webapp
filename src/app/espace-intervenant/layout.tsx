import type { Metadata } from "next";
import { requireProvider } from "@/server/authz";
import { getSettings } from "@/server/services/settings";
import { getCurrentPath } from "@/components/shell/current-path";
import { PrivateShell, type NavItem } from "@/components/shell/private-shell";

export const metadata: Metadata = { title: "Espace intervenant·e", robots: { index: false, follow: false } };

const NAV: NavItem[] = [
  { href: "/espace-intervenant", label: "Mes missions", exact: true },
  { href: "/espace-intervenant/disponibilites", label: "Mes disponibilités" },
  { href: "/espace-intervenant/profil", label: "Mon profil" },
];

export default async function ProviderSpaceLayout({ children }: LayoutProps<"/espace-intervenant">) {
  const { user } = await requireProvider("/espace-intervenant");
  const [settings, currentPath] = await Promise.all([getSettings(), getCurrentPath()]);
  return (
    <PrivateShell user={user} spaceLabel="Espace intervenant·e" nav={NAV} currentPath={currentPath} brandName={settings.brandName}>
      {children}
    </PrivateShell>
  );
}
