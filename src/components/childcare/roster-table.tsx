import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import type { ActionResult } from "@/lib/errors";
import type { RosterChild } from "@/modules/childcare/application/children-service";
import type { PresenceStatus } from "@/modules/childcare/domain/rules";
import { formatTime } from "@/modules/calendar/domain/datetime";
import { ActionButton } from "./action-form";

export const PRESENCE_LABELS: Record<PresenceStatus, { label: string; tone: "neutral" | "success" | "info" }> = {
  expected: { label: "Attendu", tone: "neutral" },
  present: { label: "Présent", tone: "success" },
  left: { label: "Parti", tone: "info" },
};

/** Roster: identity, age, guardian, flags (never the health text), presence and quick check-in. */
export function RosterTable({
  eventId,
  rows,
  timezone,
  canRecordAttendance,
  onCheckIn,
}: {
  eventId: string;
  rows: RosterChild[];
  timezone: string;
  canRecordAttendance: boolean;
  onCheckIn?: (childId: string) => Promise<ActionResult<unknown>>;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Enfant</TableHead>
            <TableHead>Âge</TableHead>
            <TableHead className="hidden md:table-cell">Responsable</TableHead>
            <TableHead className="hidden lg:table-cell">Horaires</TableHead>
            <TableHead>À consulter</TableHead>
            <TableHead className="hidden md:table-cell">Équipe</TableHead>
            <TableHead>Présence</TableHead>
            {canRecordAttendance && <TableHead className="sr-only">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => {
            const presence = PRESENCE_LABELS[c.presence];
            return (
              <TableRow key={c.id} data-testid="roster-row">
                <TableCell>
                  <Link href={`/app/evenements/${eventId}/enfants/${c.id}`} className="font-medium hover:underline">
                    {c.firstName} {c.lastName}
                  </Link>
                  {c.anonymizedAt && <span className="ml-2 text-xs text-muted-foreground">(anonymisé)</span>}
                </TableCell>
                <TableCell className="tabular-nums">{c.ageYears} ans</TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="text-sm">{c.guardianName}</div>
                  <div className="text-xs text-muted-foreground">{c.guardianPhone}</div>
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                  {c.expectedArrivalAt ? formatTime(c.expectedArrivalAt, timezone) : "n/d"} à {c.expectedDepartureAt ? formatTime(c.expectedDepartureAt, timezone) : "n/d"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {c.hasAllergies && (
                      <StatusBadge tone="warning" dot={false}>
                         Allergies
                      </StatusBadge>
                    )}
                    {c.hasHealthNotes && <StatusBadge tone="warning" dot={false}>Santé</StatusBadge>}
                    {c.dietaryPreference && <StatusBadge tone="neutral" dot={false}>{c.dietaryPreference}</StatusBadge>}
                    {!c.hasAllergies && !c.hasHealthNotes && !c.dietaryPreference && <span className="text-xs text-muted-foreground">Rien à signaler</span>}
                  </div>
                </TableCell>
                <TableCell className="hidden text-sm md:table-cell">{c.assignees.length ? c.assignees.map((a) => a.name).join(", ") : <span className="text-xs text-muted-foreground">Non affecté</span>}</TableCell>
                <TableCell>
                  <StatusBadge tone={presence.tone}>{presence.label}</StatusBadge>
                </TableCell>
                {canRecordAttendance && (
                  <TableCell className="text-right">
                    {c.presence === "expected" && onCheckIn && (
                      <ActionButton action={onCheckIn.bind(null, c.id)} successMessage={`${c.firstName} enregistré·e présent·e.`}>
                         Arrivée
                      </ActionButton>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
