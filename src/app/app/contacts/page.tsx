import Link from "next/link";
import { Download } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IllustratedEmpty } from "@/components/events/illustrated-empty";
import { EmptyNestScene } from "@/components/illustrations";
import { AddressBookScene } from "@/components/illustrations/event-scenes";
import { PageHeader } from "@/components/shared/page-header";
import { ContactFormDialog } from "@/components/contacts/contact-form-dialog";
import { ContactsTable } from "@/components/contacts/contacts-table";
import { requireActor } from "@/lib/session";
import { CONTACT_CATEGORIES, CONTACT_CATEGORY_LABELS } from "@/modules/contacts/domain/contact-import";
import { getContactUsage, listContactTags, listContacts, listOrganizationScopes } from "@/modules/contacts/application/contact-service";
import { createContactAction } from "./actions";

export const metadata = { title: "Contacts" };

type Search = { q?: string; category?: string; tag?: string; scope?: string };

export default async function ContactsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const actor = await requireActor("/app/contacts");
  const sp = await searchParams;
  const [contacts, usage, orgs, tags] = await Promise.all([
    listContacts(actor, { q: sp.q, category: sp.category, tag: sp.tag, scope: sp.scope }),
    getContactUsage(actor),
    listOrganizationScopes(actor),
    listContactTags(actor),
  ]);
  const scopes = [{ value: "personal", label: "Mon carnet personnel" }, ...orgs.filter((o) => o.canWrite).map((o) => ({ value: o.id, label: o.name }))];
  const orgNames = Object.fromEntries(orgs.map((o) => [o.id, o.name]));
  const atLimit = usage.limit !== null && usage.used >= usage.limit;
  const hasFilters = Boolean(sp.q || sp.category || sp.tag || (sp.scope && sp.scope !== "all"));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts"
        description="Votre carnet d'adresses privé : clients, prestataires, famille. Associez-les à vos évènements ou ajoutez-les comme invités en un clic."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/app/contacts/doublons">
                Doublons
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/contacts/export${sp.scope ? `?scope=${encodeURIComponent(sp.scope)}` : ""}`}>
                <Download className="size-4" aria-hidden="true" /> Exporter CSV
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/app/contacts/import">
                 Importer
              </Link>
            </Button>
            {(contacts.length > 0 || hasFilters) && (
              <ContactFormDialog
                scopes={scopes}
                onSubmit={createContactAction}
                disabledReason={atLimit ? `Votre offre ${usage.planName} est limitée à ${usage.limit} contacts personnels. Vous pouvez toujours consulter et exporter votre carnet ; passez à Organisateur Plus pour en ajouter.` : null}
                trigger={
                  <Button size="sm">
                     Nouveau contact
                  </Button>
                }
              />
            )}
          </>
        }
      />

      {usage.limit !== null && (
        <Alert variant={atLimit ? "destructive" : "default"}>
          <AlertTitle>
            {usage.used} / {usage.limit} contacts personnels ({usage.planName})
          </AlertTitle>
          <AlertDescription>
            {atLimit ? (
              <>
                Limite atteinte : la création est bloquée, la lecture et l'export restent disponibles.{" "}
                <Link href="/app/compte/abonnement?audience=organizer&feature=contacts" className="font-medium underline">
                  Découvrir Organisateur Plus
                </Link>
              </>
            ) : (
              "Passez à Organisateur Plus pour un carnet illimité."
            )}
          </AlertDescription>
        </Alert>
      )}

      <form className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_auto_auto_auto_auto]" role="search">
        <div>
          <label htmlFor="q" className="sr-only">
            Rechercher
          </label>
          <Input id="q" name="q" placeholder="Rechercher un nom, une société, un e-mail…" defaultValue={sp.q ?? ""} />
        </div>
        <select name="category" defaultValue={sp.category ?? ""} aria-label="Catégorie" className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm">
          <option value="">Toutes catégories</option>
          {CONTACT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CONTACT_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select name="tag" defaultValue={sp.tag ?? ""} aria-label="Tag" className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm">
          <option value="">Tous tags</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {orgs.length > 0 && (
          <select name="scope" defaultValue={sp.scope ?? "all"} aria-label="Carnet" className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm">
            <option value="all">Tous les carnets</option>
            <option value="personal">Personnel</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}
        <Button type="submit" variant="outline" size="sm">
          Filtrer
        </Button>
      </form>

      {contacts.length === 0 ? (
        hasFilters ? (
          <IllustratedEmpty scene={EmptyNestScene} compact title="Aucun contact ne correspond" description="Essayez d'élargir votre recherche ou de retirer un filtre." action={<Button asChild variant="outline" size="sm"><Link href="/app/contacts">Réinitialiser les filtres</Link></Button>} />
        ) : (
          <IllustratedEmpty
            scene={AddressBookScene}
            title="Votre carnet d'adresses est vide"
            description="Famille, amis, prestataires, partenaires : un carnet privé que vous retrouvez d'un évènement à l'autre. Associez un contact à un évènement ou ajoutez-le comme invité en un clic ; la détection des doublons s'occupe des fichiers importés en vrac."
            example="Maxime Girard, ami et témoin, maxime.girard@example.test, tags : amis, témoin"
            action={<><Button asChild variant="outline"><Link href="/app/contacts/import">Importer un CSV</Link></Button><ContactFormDialog scopes={scopes} onSubmit={createContactAction} disabledReason={atLimit ? `Votre offre ${usage.planName} est limitée à ${usage.limit} contacts personnels.` : null} trigger={<Button>Nouveau contact</Button>} /></>}
            testId="contacts-empty"
          />
        )
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{contacts.length} contact(s)</p>
          <ContactsTable contacts={contacts} orgNames={orgNames} />
        </>
      )}
    </div>
  );
}
