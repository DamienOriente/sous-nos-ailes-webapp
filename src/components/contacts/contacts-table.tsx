import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CONTACT_CATEGORY_LABELS, type ContactCategory } from "@/modules/contacts/domain/contact-import";
import type { ContactListItem } from "@/modules/contacts/application/contact-service";

export function ContactsTable({ contacts, orgNames }: { contacts: ContactListItem[]; orgNames: Record<string, string> }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead className="hidden md:table-cell">Coordonnées</TableHead>
            <TableHead className="hidden sm:table-cell">Catégorie</TableHead>
            <TableHead className="hidden lg:table-cell">Tags</TableHead>
            <TableHead className="hidden lg:table-cell">Carnet</TableHead>
            <TableHead className="text-right">Évènements</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <Link href={`/app/contacts/${c.id}`} className="font-medium hover:underline">
                  {`${c.firstName} ${c.lastName}`.trim() || c.company || "Sans nom"}
                </Link>
                {c.company && (c.firstName || c.lastName) && <p className="text-xs text-muted-foreground">{c.company}</p>}
                <p className="text-xs text-muted-foreground md:hidden">{[c.email, c.phone].filter(Boolean).join(" · ")}</p>
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{[c.email, c.phone].filter(Boolean).join(" · ") || "Non renseigné"}</TableCell>
              <TableCell className="hidden sm:table-cell">{c.category ? CONTACT_CATEGORY_LABELS[c.category as ContactCategory] ?? c.category : "Non renseignée"}</TableCell>
              <TableCell className="hidden lg:table-cell">
                <div className="flex flex-wrap gap-1">
                  {c.tags.slice(0, 4).map((t) => (
                    <Badge key={t} variant="outline" className="rounded-full">
                      {t}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{c.organizationId ? orgNames[c.organizationId] ?? "Organisation" : "Personnel"}</TableCell>
              <TableCell className="text-right tabular-nums">{c.eventCount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
