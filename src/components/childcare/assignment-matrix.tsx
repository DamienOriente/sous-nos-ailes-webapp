"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import type { ActionResult } from "@/lib/errors";
import type { CareTeamMember } from "@/modules/childcare/application/assignments-service";

/** Children × care team matrix. Non-childcare members require an explicit confirmation. */
export function AssignmentMatrix({
  rows,
  team,
  onAssign,
  onUnassign,
}: {
  rows: Array<{ id: string; firstName: string; lastName: string; ageYears: number }>;
  team: CareTeamMember[];
  onAssign: (childId: string, memberId: string, allowNonChildcare: boolean) => Promise<ActionResult<unknown>>;
  onUnassign: (childId: string, memberId: string) => Promise<ActionResult<unknown>>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pendingNonChildcare, setPendingNonChildcare] = useState<{ childId: string; memberId: string } | null>(null);
  const assigned = new Set(team.flatMap((m) => m.assignedChildIds.map((c) => `${c}:${m.memberId}`)));

  function toggle(childId: string, member: CareTeamMember, checked: boolean) {
    if (checked && !member.isChildcare) {
      setPendingNonChildcare({ childId, memberId: member.memberId });
      return;
    }
    start(async () => {
      const res = checked ? await onAssign(childId, member.memberId, false) : await onUnassign(childId, member.memberId);
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });
  }

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Enfant</TableHead>
            {team.map((m) => (
              <TableHead key={m.memberId} className="text-center">
                <div className="font-medium">{m.name}</div>
                <div className="text-xs font-normal text-muted-foreground">{m.categoryName ?? (m.role === "staff" ? "Personnel" : "Prestataire")}</div>
                {!m.isChildcare && (
                  <StatusBadge tone="warning" dot={false} className="mt-1">
                    hors garde
                  </StatusBadge>
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">
                {c.firstName} {c.lastName} <span className="text-xs text-muted-foreground">({c.ageYears} ans)</span>
              </TableCell>
              {team.map((m) => {
                const key = `${c.id}:${m.memberId}`;
                return (
                  <TableCell key={m.memberId} className="text-center">
                    <Checkbox aria-label={`Affecter ${c.firstName} à ${m.name}`} checked={assigned.has(key)} disabled={pending} onCheckedChange={(v) => toggle(c.id, m, v === true)} />
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <NonChildcareConfirm pending={pendingNonChildcare} onClose={() => setPendingNonChildcare(null)} onConfirm={onAssign} />
    </div>
  );
}

/** Controlled confirmation (the generic ConfirmDialog is trigger-based). */
function NonChildcareConfirm({ pending, onClose, onConfirm }: { pending: { childId: string; memberId: string } | null; onClose: () => void; onConfirm: (childId: string, memberId: string, allow: boolean) => Promise<ActionResult<unknown>> }) {
  const router = useRouter();
  if (!pending) return null;
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="ncc-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-6 shadow-lg">
        <h2 id="ncc-title" className="text-lg font-semibold">
          Affecter un membre hors garde d'enfants ?
        </h2>
        <p className="text-sm text-muted-foreground">Ce membre n'exerce pas un métier de garde d'enfants. Il verra la fiche de l'enfant (sans les informations de santé, sauf permission explicite). Confirmez-vous ?</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="rounded-lg px-3 py-2 text-sm hover:bg-muted" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
            onClick={async () => {
              const res = await onConfirm(pending.childId, pending.memberId, true);
              if (!res.ok) toast.error(res.error);
              onClose();
              router.refresh();
            }}
          >
            Affecter quand même
          </button>
        </div>
      </div>
    </div>
  );
}
