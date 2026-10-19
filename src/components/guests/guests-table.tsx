"use client";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { GuestFormDialog } from "@/components/guests/guest-form-dialog";
import type { ActionResult } from "@/lib/errors";
import { RSVP_LABELS, RSVP_TONES, type RsvpStatus } from "@/modules/guests/domain/guests";
import type { GuestListItem } from "@/modules/guests/application/guest-service";
import type { GuestFormValues } from "@/app/app/evenements/[id]/invites/actions";

export function GuestsTable({
  eventId,
  guests,
  groups,
  canManage,
  onUpdate,
  onDelete,
}: {
  eventId: string;
  guests: GuestListItem[];
  groups: Array<{ id: string; name: string }>;
  canManage: boolean;
  onUpdate: (eventId: string, guestId: string, values: GuestFormValues) => Promise<ActionResult<{ id: string }>>;
  onDelete: (eventId: string, guestId: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invité</TableHead>
            <TableHead className="hidden md:table-cell">Groupe</TableHead>
            <TableHead>RSVP</TableHead>
            <TableHead className="hidden lg:table-cell">Régime</TableHead>
            <TableHead className="hidden lg:table-cell">Table</TableHead>
            {canManage && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {guests.map((g) => (
            <TableRow key={g.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{`${g.firstName} ${g.lastName}`.trim()}</span>
                  {g.isChild && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky/40 px-2 py-0.5 text-[11px] font-medium text-foreground" title="Enfant">
                       {g.ageYears !== null ? `${g.ageYears} ans` : "enfant"}
                    </span>
                  )}
                  {g.plusOnesAllowed > 0 && <span className="text-xs text-muted-foreground">+{g.plusOnesAllowed}</span>}
                </div>
                <p className="text-xs text-muted-foreground">{[g.email, g.phone].filter(Boolean).join(" · ")}</p>
              </TableCell>
              <TableCell className="hidden text-sm md:table-cell">{g.groupName ?? "Sans groupe"}</TableCell>
              <TableCell>
                <StatusBadge tone={RSVP_TONES[g.rsvpStatus as RsvpStatus]}>{RSVP_LABELS[g.rsvpStatus as RsvpStatus]}</StatusBadge>
                {g.rsvpStatus === "accepted" && g.rsvpGuestsCount && g.rsvpGuestsCount > 1 && <span className="ml-1 text-xs text-muted-foreground">({g.rsvpGuestsCount} pers.)</span>}
              </TableCell>
              <TableCell className="hidden text-sm lg:table-cell">{g.dietaryPreference ?? "Aucun"}</TableCell>
              <TableCell className="hidden text-sm lg:table-cell">{g.tableName ?? "Non placé"}</TableCell>
              {canManage && (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <GuestFormDialog
                      eventId={eventId}
                      groups={groups}
                      initial={{ id: g.id, firstName: g.firstName, lastName: g.lastName, email: g.email, phone: g.phone, groupId: g.groupId, isChild: g.isChild, ageYears: g.ageYears, dietaryPreference: g.dietaryPreference, plusOnesAllowed: g.plusOnesAllowed, notes: g.notes, rsvpStatus: g.rsvpStatus as RsvpStatus }}
                      onSubmit={(values) => onUpdate(eventId, g.id, values)}
                      trigger={
                        <Button variant="ghost" size="icon-xs" aria-label={`Modifier ${g.firstName} ${g.lastName}`}>
                          <Pencil className="size-3.5" aria-hidden="true" />
                        </Button>
                      }
                    />
                    <ConfirmDialog
                      title={`Supprimer ${`${g.firstName} ${g.lastName}`.trim()} ?`}
                      description="L'invité est retiré de la liste, des invitations et du plan de table."
                      confirmLabel="Supprimer"
                      successMessage="Invité supprimé."
                      onConfirm={async () => {
                        const res = await onDelete(eventId, g.id);
                        if (res.ok) router.refresh();
                        return res;
                      }}
                      trigger={
                        <Button variant="ghost" size="icon-xs" aria-label={`Supprimer ${g.firstName} ${g.lastName}`}>
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      }
                    />
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
