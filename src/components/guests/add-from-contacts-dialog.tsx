"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookUser } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/errors";

type Contact = { id: string; firstName: string; lastName: string; company: string | null; email: string | null; category: string | null };

export function AddFromContactsDialog({ eventId, contacts, groups, onAdd }: { eventId: string; contacts: Contact[]; groups: Array<{ id: string; name: string }>; onAdd: (eventId: string, contactIds: string[], groupId: string | null) => Promise<ActionResult<{ created: number; skipped: number }>> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupId, setGroupId] = useState("");
  const [pending, start] = useTransition();
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? contacts.filter((c) => `${c.firstName} ${c.lastName} ${c.company ?? ""} ${c.email ?? ""}`.toLowerCase().includes(t)) : contacts;
  }, [contacts, q]);
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={contacts.length === 0} title={contacts.length === 0 ? "Tous vos contacts sont déjà invités, ou votre carnet est vide." : undefined}>
          <BookUser className="size-4" aria-hidden="true" /> Depuis mes contacts
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter depuis le carnet</DialogTitle>
          <DialogDescription>Sélectionnez un ou plusieurs contacts : ils deviennent invités et sont associés à l'évènement.</DialogDescription>
        </DialogHeader>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" aria-label="Rechercher un contact" />
        <ul className="max-h-72 space-y-1 overflow-y-auto rounded-lg border p-2">
          {filtered.length === 0 && <li className="p-2 text-sm text-muted-foreground">Aucun contact.</li>}
          {filtered.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{`${c.firstName} ${c.lastName}`.trim() || c.company}</span>
                  {c.email && <span className="text-muted-foreground"> · {c.email}</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <label htmlFor="afc-group" className="text-sm">
            Groupe
          </label>
          <select id="afc-group" value={groupId} onChange={(e) => setGroupId(e.target.value)} className="h-8 flex-1 rounded-lg border border-input bg-transparent px-2 text-sm">
            <option value="">Aucun</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <DialogFooter>
          <Button
            disabled={selected.size === 0 || pending}
            onClick={() =>
              start(async () => {
                const res = await onAdd(eventId, Array.from(selected), groupId || null);
                if (res.ok) {
                  toast.success(`${res.data.created} invité(s) ajouté(s)${res.data.skipped ? `, ${res.data.skipped} déjà présent(s)` : ""}.`);
                  setOpen(false);
                  setSelected(new Set());
                  router.refresh();
                } else toast.error(res.error);
              })
            }
          >
            {pending ? "Ajout…" : `Ajouter ${selected.size} invité(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
