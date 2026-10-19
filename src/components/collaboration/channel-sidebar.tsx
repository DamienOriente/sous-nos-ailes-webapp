"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { FormMessage } from "@/components/shared/form-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/errors";
import { cn, formatDateFr } from "@/lib/utils";
import type { SearchHit } from "@/app/app/evenements/[id]/messages/actions";
import { CHANNEL_EXAMPLES } from "@/modules/events/domain/suggestions";

export type ChannelListItem = { id: string; name: string; kind: string; unread: number; archived: boolean; isMember: boolean; memberCount: number };
export type MemberOption = { id: string; name: string; role: string };

export function ChannelSidebar({ eventId, activeChannelId, channels, canManage, members, actions }: { eventId: string; activeChannelId: string; channels: ChannelListItem[]; canManage: boolean; members: MemberOption[]; actions: { createChannel: (eventId: string, input: unknown) => Promise<ActionResult<{ id: string }>>; search: (eventId: string, q: string) => Promise<ActionResult<SearchHit[]>> } }) {
  const live = channels.filter((c) => !c.archived);
  const archived = channels.filter((c) => c.archived);
  return (
    <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start" aria-label="Canaux">
      <SearchBox eventId={eventId} search={actions.search} />
      <nav className="space-y-1">
        <div className="flex items-center justify-between px-2">
          <p className="text-xs font-semibold text-muted-foreground">Canaux</p>
          {canManage && <CreateChannelDialog eventId={eventId} members={members} action={actions.createChannel} />}
        </div>
        <ul className="space-y-0.5">
          {live.map((c) => (
            <li key={c.id}>
              <Link
                href={`/app/evenements/${eventId}/messages/${c.id}`}
                aria-current={c.id === activeChannelId ? "page" : undefined}
                className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm", c.id === activeChannelId ? "bg-accent font-medium text-accent-foreground" : "text-foreground/80 hover:bg-muted")}
              >
                                <span className="min-w-0 flex-1 truncate">
                  <span className="text-muted-foreground">#</span> {c.name}
                </span>
                {c.kind !== "general" && !c.isMember && <span className="text-xs text-muted-foreground">privé</span>}
                {c.unread > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">{c.unread}</span>}
              </Link>
            </li>
          ))}
        </ul>
        {archived.length > 0 && (
          <details className="px-2 pt-2">
            <summary className="cursor-pointer text-xs text-muted-foreground">Archivés ({archived.length})</summary>
            <ul className="mt-1 space-y-0.5">
              {archived.map((c) => (
                <li key={c.id}>
                  <Link href={`/app/evenements/${eventId}/messages/${c.id}`} className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted", c.id === activeChannelId && "bg-accent")}>
                    <span className="truncate">{c.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        )}
      </nav>
    </aside>
  );
}

function SearchBox({ eventId, search }: { eventId: string; search: (eventId: string, q: string) => Promise<ActionResult<SearchHit[]>> }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [pending, start] = useTransition();
  function run(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    start(async () => {
      const res = await search(eventId, q);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setHits(res.data);
    });
  }
  return (
    <div className="space-y-2">
      <form onSubmit={run} role="search" className="relative">
        <Label htmlFor="msg-search" className="sr-only">
          Rechercher dans les messages
        </Label>
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input id="msg-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" className="pl-8" />
      </form>
      {hits !== null && (
        <div className="rounded-xl border bg-card p-2 text-sm">
          <div className="flex items-center justify-between px-1 pb-1 text-xs text-muted-foreground">
            <span>{pending ? "Recherche…" : `${hits.length} résultat${hits.length > 1 ? "s" : ""}`}</span>
            <button type="button" className="hover:underline" onClick={() => setHits(null)}>
              Fermer
            </button>
          </div>
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {hits.map((h) => (
              <li key={h.id}>
                <Link href={`/app/evenements/${eventId}/messages/${h.channelId}#msg-${h.id}`} className="block rounded-lg px-2 py-1.5 hover:bg-muted">
                  <span className="block text-xs text-muted-foreground">
                    #{h.channelName} · {h.authorName} · {formatDateFr(h.createdAt, { day: "numeric", month: "short" })}
                  </span>
                  <span className="line-clamp-2">{h.body}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CreateChannelDialog({ eventId, members, action }: { eventId: string; members: MemberOption[]; action: (eventId: string, input: unknown) => Promise<ActionResult<{ id: string }>> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [openToAll, setOpenToAll] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = { name, description: description || null, kind: openToAll ? "topic" : "coordination", memberIds: selected, isOpenToAllMembers: openToAll };
    start(async () => {
      const res = await action(eventId, input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Canal créé.");
      setOpen(false);
      router.push(`/app/evenements/${eventId}/messages/${res.data.id}`);
    });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label="Créer un canal">
          <Plus className="size-3.5" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau canal</DialogTitle>
          <DialogDescription>Un canal thématique (logistique, enfants, musique…) ou de coordination entre quelques prestataires. Les organisateurs y ont toujours accès.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="flex flex-wrap gap-1.5" aria-label="Exemples de canaux">
            {CHANNEL_EXAMPLES.map((ex) => (
              <button key={ex.name} type="button" onClick={() => { setName(ex.name); setDescription(ex.description); }} className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground">
                {ex.name}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ch-name">Nom</Label>
            <Input id="ch-name" name="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} placeholder="Logistique lieu & traiteur" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ch-desc">Description</Label>
            <Textarea id="ch-desc" name="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={300} placeholder="Accès, horaires de livraison, cuisine, plan de salle." />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={openToAll} onCheckedChange={(v) => setOpenToAll(Boolean(v))} />
            Ouvert à toute l'équipe
          </label>
          {!openToAll && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Membres</legend>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
                {members.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={selected.includes(m.id)} onCheckedChange={(v) => setSelected((s) => (v ? [...s, m.id] : s.filter((x) => x !== m.id)))} />
                    <span className="flex-1">{m.name}</span>
                    <span className="text-xs text-muted-foreground">{m.role}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <FormMessage error={error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Création…" : "Créer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
