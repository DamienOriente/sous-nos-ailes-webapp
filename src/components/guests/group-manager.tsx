"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { ActionResult } from "@/lib/errors";
import { GUEST_SIDES } from "@/modules/guests/domain/guests";

type Group = { id: string; name: string; side: string | null; guestCount: number };

export function GroupManager({
  eventId,
  groups,
  canManage,
  onCreate,
  onUpdate,
  onDelete,
}: {
  eventId: string;
  groups: Group[];
  canManage: boolean;
  onCreate: (eventId: string, input: { name: string; side?: string | null }) => Promise<ActionResult<{ id: string }>>;
  onUpdate: (eventId: string, groupId: string, input: { name: string; side?: string | null }) => Promise<ActionResult>;
  onDelete: (eventId: string, groupId: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);

  function create(fd: FormData) {
    start(async () => {
      const res = await onCreate(eventId, { name: String(fd.get("name") ?? ""), side: String(fd.get("side") ?? "") || null });
      if (res.ok) {
        toast.success("Groupe créé.");
        router.refresh();
      } else toast.error(res.error);
    });
  }
  function save(groupId: string, fd: FormData) {
    start(async () => {
      const res = await onUpdate(eventId, groupId, { name: String(fd.get("name") ?? ""), side: String(fd.get("side") ?? "") || null });
      if (res.ok) {
        toast.success("Groupe modifié.");
        setEditing(null);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4 text-primary" aria-hidden="true" /> Groupes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {groups.length === 0 && <p className="text-sm text-muted-foreground">Aucun groupe (famille, amis, collègues…).</p>}
        <ul className="space-y-2">
          {groups.map((g) =>
            editing === g.id ? (
              <li key={g.id}>
                <form action={(fd) => save(g.id, fd)} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                  <Input name="name" defaultValue={g.name} aria-label="Nom du groupe" className="min-w-32 flex-1" required />
                  <select name="side" defaultValue={g.side ?? ""} aria-label="Côté" className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm">
                    <option value="">Côté —</option>
                    {GUEST_SIDES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" size="sm" disabled={pending}>
                    OK
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    Annuler
                  </Button>
                </form>
              </li>
            ) : (
              <li key={g.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{g.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {g.guestCount} invité(s){g.side ? ` · côté ${g.side}` : ""}
                  </p>
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="xs" onClick={() => setEditing(g.id)}>
                      Modifier
                    </Button>
                    <ConfirmDialog
                      title={`Supprimer le groupe « ${g.name} » ?`}
                      description="Les invités du groupe sont conservés, simplement détachés."
                      confirmLabel="Supprimer"
                      onConfirm={async () => {
                        const res = await onDelete(eventId, g.id);
                        if (res.ok) router.refresh();
                        return res;
                      }}
                      successMessage="Groupe supprimé."
                      trigger={
                        <Button variant="ghost" size="icon-xs" aria-label={`Supprimer ${g.name}`}>
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      }
                    />
                  </div>
                )}
              </li>
            ),
          )}
        </ul>
        {canManage && (
          <form action={create} className="flex flex-wrap gap-2">
            <Input name="name" placeholder="Nouveau groupe" aria-label="Nom du nouveau groupe" required className="min-w-32 flex-1" />
            <select name="side" aria-label="Côté" defaultValue="" className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm">
              <option value="">Côté —</option>
              {GUEST_SIDES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm" variant="secondary" disabled={pending}>
              <Plus className="size-4" aria-hidden="true" /> Créer
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
