import type { Metadata } from "next";
import { requirePartner } from "@/server/authz";
import { getSettings } from "@/server/services/settings";
import { getCurrentPath } from "@/components/shell/current-path";
import { PrivateShell, type NavItem } from "@/components/shell/private-shell";

export const metadata: Metadata = { title: "Espace partenaire", robots: { index: false, follow: false } };

const NAV: NavItem[] = [{ href: "/espace-partenaire", label: "Mon lieu", exact: true }];

export default async function PartnerSpaceLayout({ children }: LayoutProps<"/espace-partenaire">) {
  const { user } = await requirePartner("/espace-partenaire");
  const [settings, currentPath] = await Promise.all([getSettings(), getCurrentPath()]);
  return (
    <PrivateShell user={user} spaceLabel="Espace partenaire" nav={NAV} currentPath={currentPath} brandName={settings.brandName}>
      {children}
    </PrivateShell>
  );
}
