import Link from "next/link";
import { ArrowLeft, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { DuplicateGroups } from "@/components/contacts/duplicate-groups";
import { requireActor } from "@/lib/session";
import { findDuplicateContacts } from "@/modules/contacts/application/contact-service";
import { mergeContactsAction } from "../actions";

export const metadata = { title: "Doublons — Sous Nos Ailes" };

export default async function DuplicatesPage() {
  const actor = await requireActor("/app/contacts/doublons");
  const groups = await findDuplicateContacts(actor);
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/app/contacts">
          <ArrowLeft className="size-4" aria-hidden="true" /> Contacts
        </Link>
      </Button>
      <PageHeader eyebrow="Carnet" title="Doublons détectés" description="Fiches partageant la même adresse e-mail ou le même numéro de téléphone (normalisé). Choisissez la fiche à conserver puis fusionnez." />
      {groups.length === 0 ? (
        <EmptyState icon={Copy} title="Aucun doublon" description="Votre carnet est propre." />
      ) : (
        <DuplicateGroups groups={groups.map((g) => ({ key: g.key, items: g.items.map((i) => ({ id: i.id, firstName: i.firstName, lastName: i.lastName, company: i.company, email: i.email, phone: i.phone, tags: i.tags, eventCount: i.eventCount, createdAt: i.createdAt })) }))} onMerge={mergeContactsAction} />
      )}
    </div>
  );
}
