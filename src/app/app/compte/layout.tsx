import { AccountNav } from "@/components/identity/account-nav";
import { PageHeader } from "@/components/shared/page-header";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Paramètres" title="Mon compte" description="Vos informations, votre sécurité et vos préférences." />
      <AccountNav />
      <div className="max-w-3xl">{children}</div>
    </div>
  );
}
