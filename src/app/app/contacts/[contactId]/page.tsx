import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { ContactFormDialog } from "@/components/contacts/contact-form-dialog";
import { ContactEventLinks } from "@/components/contacts/contact-event-links";
import { isAppError } from "@/lib/errors";
import { requireActor } from "@/lib/session";
import { formatDateFr } from "@/lib/utils";
import { CONTACT_CATEGORY_LABELS, type ContactCategory } from "@/modules/contacts/domain/contact-import";
import { getContact, listContactEvents, listLinkableEvents } from "@/modules/contacts/application/contact-service";
import { deleteContactAction, linkContactEventAction, updateContactAction } from "../actions";
import { redirect } from "next/navigation";

export default async function ContactDetailPage({ params }: { params: Promise<{ contactId: string }> }) {
  const { contactId } = await params;
  const actor = await requireActor(`/app/contacts/${contactId}`);
  let contact;
  try {
    contact = await getContact(actor, contactId);
  } catch (e) {
    if (isAppError(e) && e.code === "not_found") notFound();
    throw e;
  }
  const [linked, linkable] = await Promise.all([listContactEvents(actor, contactId), listLinkableEvents(actor)]);
  const name = `${contact.firstName} ${contact.lastName}`.trim() || contact.company || "Sans nom";
  const update = updateContactAction.bind(null, contact.id);

  async function remove() {
    "use server";
    const res = await deleteContactAction(contactId);
    if (res.ok) redirect("/app/contacts");
    return res;
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/app/contacts">
          <ArrowLeft className="size-4" aria-hidden="true" /> Tous les contacts
        </Link>
      </Button>
      <PageHeader
        eyebrow={contact.category ? CONTACT_CATEGORY_LABELS[contact.category as ContactCategory] ?? contact.category : "Contact"}
        title={name}
        description={contact.company && (contact.firstName || contact.lastName) ? contact.company : undefined}
        actions={
          <>
            <ContactFormDialog
              initial={{ id: contact.id, firstName: contact.firstName, lastName: contact.lastName, company: contact.company, email: contact.email, phone: contact.phone, category: contact.category as ContactCategory | null, tags: contact.tags.join(", "), notes: contact.notes }}
              onSubmit={(values) => update(values)}
              trigger={
                <Button variant="outline" size="sm">
                  <Pencil className="size-4" aria-hidden="true" /> Modifier
                </Button>
              }
            />
            <ConfirmDialog
              title="Supprimer ce contact ?"
              description="Les invités déjà créés à partir de ce contact sont conservés ; seul le contact du carnet est supprimé."
              confirmLabel="Supprimer"
              onConfirm={remove}
              trigger={
                <Button variant="destructive" size="sm">
                  <Trash2 className="size-4" aria-hidden="true" /> Supprimer
                </Button>
              }
            />
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coordonnées</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">E-mail</dt>
                <dd>{contact.email ? <a href={`mailto:${contact.email}`} className="underline-offset-2 hover:underline">{contact.email}</a> : "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Téléphone</dt>
                <dd>{contact.phone ? <a href={`tel:${contact.phone}`} className="underline-offset-2 hover:underline">{contact.phone}</a> : "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Tags</dt>
                <dd className="flex flex-wrap gap-1">
                  {contact.tags.length === 0 && "—"}
                  {contact.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="rounded-full">
                      {t}
                    </Badge>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Ajouté le</dt>
                <dd>{formatDateFr(contact.createdAt)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Notes</dt>
                <dd className="whitespace-pre-wrap">{contact.notes ?? "—"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <ContactEventLinks contactId={contact.id} linked={linked} linkable={linkable} onToggle={linkContactEventAction} />
      </div>
    </div>
  );
}
