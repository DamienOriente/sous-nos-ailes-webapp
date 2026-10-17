import type { Metadata } from "next";
import { requireUser } from "@/server/authz";
import { getSettings } from "@/server/services/settings";
import { getCurrentPath } from "@/components/shell/current-path";
import { PrivateShell, type NavItem } from "@/components/shell/private-shell";

export const metadata: Metadata = { title: "Espace client", robots: { index: false, follow: false } };

const NAV: NavItem[] = [{ href: "/espace-client", label: "Mes événements" }];

// Any signed-in role may open the client space: data is scoped by clientId in
// every service call, so an admin or provider simply sees their own files.
export default async function ClientSpaceLayout({ children }: LayoutProps<"/espace-client">) {
  const user = await requireUser({ next: "/espace-client" });
  const [settings, currentPath] = await Promise.all([getSettings(), getCurrentPath()]);
  return (
    <PrivateShell user={user} spaceLabel="Espace client" nav={NAV} currentPath={currentPath} brandName={settings.brandName}>
      {children}
    </PrivateShell>
  );
}
