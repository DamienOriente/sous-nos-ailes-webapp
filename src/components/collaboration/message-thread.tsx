"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Eye, Flag, Paperclip, Pencil, Send, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { IllustratedEmpty } from "@/components/events/illustrated-empty";
import { FileUpload } from "@/components/files/file-upload";
import { ChatScene } from "@/components/illustrations/event-scenes";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormMessage } from "@/components/shared/form-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/errors";
import { cn, formatDateFr, initials } from "@/lib/utils";
import { REPORT_REASONS } from "@/modules/collaboration/domain/report-reasons";
import { MESSAGE_PLACEHOLDERS } from "@/modules/events/domain/suggestions";
import { privateFileHref } from "@/modules/files/application/file-urls";
import type { SerializedMessage } from "@/app/app/evenements/[id]/messages/actions";

type Member = { memberId: string; userId: string; name: string; role: string };
type Actions = {
  post: (eventId: string, channelId: string, input: unknown) => Promise<ActionResult<{ id: string }>>;
  loadOlder: (eventId: string, channelId: string, before: string) => Promise<ActionResult<{ messages: SerializedMessage[]; hasMore: boolean }>>;
  edit: (eventId: string, messageId: string, body: string) => Promise<ActionResult>;
  remove: (eventId: string, messageId: string) => Promise<ActionResult>;
  report: (eventId: string, messageId: string, reason: (typeof REPORT_REASONS)[number], details: string | null) => Promise<ActionResult>;
  markRead: (eventId: string, channelId: string) => Promise<ActionResult>;
  archive: (eventId: string, channelId: string, archive: boolean) => Promise<ActionResult>;
  updateMembers: (eventId: string, channelId: string, memberIds: string[]) => Promise<ActionResult>;
};

const POLL_MS = 10_000;

export function MessageThread({ eventId, channel, members, allMembers, initialMessages, initialHasMore, currentUserId, canPost, canManage, actions }: { eventId: string; channel: { id: string; name: string; description: string | null; kind: string; archived: boolean; isOpen: boolean }; members: Member[]; allMembers: Array<{ id: string; name: string; role: string }>; initialMessages: SerializedMessage[]; initialHasMore: boolean; currentUserId: string; canPost: boolean; canManage: boolean; actions: Actions }) {
  const router = useRouter();
  const [older, setOlder] = useState<SerializedMessage[]>([]);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingOlder, startOlder] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const messages = useMemo(() => {
    const seen = new Set<string>();
    return [...older, ...initialMessages].filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
  }, [older, initialMessages]);

  // Polling: refresh server data every 10 s while the tab is visible (no websocket in V1).
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(id);
  }, [router]);

  // Mark read on open and whenever new messages arrive.
  const lastId = initialMessages.at(-1)?.id;
  useEffect(() => {
    void actions.markRead(eventId, channel.id);
  }, [eventId, channel.id, lastId, actions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [lastId]);

  function loadOlder() {
    const first = messages[0];
    if (!first) return;
    startOlder(async () => {
      const res = await actions.loadOlder(eventId, channel.id, first.createdAt);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setOlder((o) => [...res.data.messages, ...o]);
      setHasMore(res.data.hasMore);
    });
  }

  return (
    <section className="flex min-h-[60dvh] flex-col rounded-2xl border bg-card" aria-label={`Canal ${channel.name}`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate font-semibold">
            #{channel.name}
            {channel.archived && <span className="ml-2 text-xs font-normal text-muted-foreground">(archivé)</span>}
          </h2>
          {channel.description && <p className="truncate text-xs text-muted-foreground">{channel.description}</p>}
        </div>
        <div className="flex items-center gap-1">
          <MembersDialog channel={channel} members={members} allMembers={allMembers} canManage={canManage} eventId={eventId} action={actions.updateMembers} />
          {canManage && channel.kind !== "general" && (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="sm">
                  {channel.archived ? <ArchiveRestore className="size-3.5" aria-hidden="true" /> : <Archive className="size-3.5" aria-hidden="true" />}
                  {channel.archived ? "Restaurer" : "Archiver"}
                </Button>
              }
              title={channel.archived ? "Restaurer ce canal ?" : "Archiver ce canal ?"}
              description={channel.archived ? "Les membres pourront de nouveau y écrire." : "Le canal reste lisible mais plus personne ne pourra y écrire."}
              confirmLabel={channel.archived ? "Restaurer" : "Archiver"}
              destructive={!channel.archived}
              onConfirm={async () => {
                const res = await actions.archive(eventId, channel.id, !channel.archived);
                if (res.ok) router.refresh();
                return res;
              }}
            />
          )}
        </div>
      </header>
      <p className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2 text-xs text-muted-foreground" role="note">
        <Eye className="size-3.5 shrink-0" aria-hidden="true" />
        Les organisateurs de l'évènement peuvent lire tous les échanges de cet espace.
      </p>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {hasMore && (
          <div className="text-center">
            <Button variant="outline" size="sm" onClick={loadOlder} disabled={loadingOlder}>
              {loadingOlder ? "Chargement…" : "Charger les messages plus anciens"}
            </Button>
          </div>
        )}
        {messages.length === 0 && (
          <IllustratedEmpty
            scene={ChatScene}
            compact
            className="border-0 bg-transparent"
            title={channel.kind === "general" ? "Personne n'a encore écrit ici" : "Ce canal attend son premier message"}
            description={channel.kind === "general" ? "Le canal Général réunit toute l'équipe : organisateurs, prestataires et renforts. Mentionnez quelqu'un avec @Prénom pour le prévenir." : "Un canal de coordination réunit quelques membres autour d'un sujet ; les organisateurs y ont toujours accès."}
            example={channel.kind === "general" ? "Bienvenue à toute l'équipe ! Le planning du jour J est dans l'onglet Planning." : "@Hélène, à quelle heure le portail livraisons est-il ouvert samedi ?"}
            testId="thread-empty"
          />
        )}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const grouped = prev && prev.authorUserId === m.authorUserId && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000;
          return <MessageItem key={m.id} m={m} grouped={Boolean(grouped)} eventId={eventId} currentUserId={currentUserId} canManage={canManage} actions={actions} />;
        })}
        <div ref={bottomRef} />
      </div>

      {canPost ? (
        <Composer eventId={eventId} channelId={channel.id} members={members.filter((m) => m.userId !== currentUserId)} placeholder={messages.length === 0 ? (MESSAGE_PLACEHOLDERS[channel.kind] ?? MESSAGE_PLACEHOLDERS.direct) : undefined} action={actions.post} />
      ) : (
        <p className="border-t px-4 py-3 text-sm text-muted-foreground">{channel.archived ? "Ce canal est archivé : lecture seule." : "Vous pouvez lire ce canal mais pas y écrire."}</p>
      )}
    </section>
  );
}

function renderBody(body: string) {
  // Highlight @mentions; plain text otherwise (no HTML).
  const parts = body.split(/((?:^|\s)@[\p{L}'’-]+(?:\s[\p{L}'’-]+)?)/u);
  return parts.map((p, i) => (p.trimStart().startsWith("@") ? <span key={i} className="rounded bg-primary/10 px-0.5 font-medium text-primary">{p}</span> : <span key={i}>{p}</span>));
}

function MessageItem({ m, grouped, eventId, currentUserId, canManage, actions }: { m: SerializedMessage; grouped: boolean; eventId: string; currentUserId: string; canManage: boolean; actions: Actions }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.body);
  const [pending, start] = useTransition();
  const mine = m.authorUserId === currentUserId;
  return (
    <article id={`msg-${m.id}`} className={cn("group flex gap-3", grouped && "-mt-3")} aria-label={`Message de ${m.authorName}`}>
      <div className="w-8 shrink-0">{!grouped && <div className="flex size-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{initials(m.authorName)}</div>}</div>
      <div className="min-w-0 flex-1">
        {!grouped && (
          <p className="flex items-baseline gap-2 text-xs text-muted-foreground">
            <span className="text-sm font-medium text-foreground">{m.authorName}</span>
            <time dateTime={m.createdAt}>{formatDateFr(m.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
          </p>
        )}
        {m.deletedAt ? (
          <p className="text-sm text-muted-foreground italic">Message supprimé.</p>
        ) : editing ? (
          <form
            className="mt-1 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await actions.edit(eventId, m.id, draft);
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                setEditing(false);
                router.refresh();
              });
            }}
          >
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} maxLength={4000} aria-label="Modifier le message" />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                Enregistrer
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Annuler
              </Button>
            </div>
          </form>
        ) : (
          <>
            <p className="text-sm whitespace-pre-wrap break-words">
              {renderBody(m.body)}
              {m.editedAt && <span className="ml-1 text-xs text-muted-foreground">(modifié)</span>}
            </p>
            {m.attachments.length > 0 && (
              <ul className="mt-1 flex flex-wrap gap-2">
                {m.attachments.map((a) => (
                  <li key={a.id}>
                    {a.status === "clean" ? (
                      <a href={privateFileHref(a.fileId)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs hover:bg-muted">
                        <Paperclip className="size-3" aria-hidden="true" />
                        {a.name ?? "Pièce jointe"}
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-muted-foreground">
                        <Paperclip className="size-3" aria-hidden="true" />
                        {a.name ?? "Pièce jointe"} · {a.status === "infected" || a.status === "rejected" ? "bloquée" : "analyse en cours"}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      {!m.deletedAt && !editing && (
        <div className="flex shrink-0 items-start gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          {mine && (
            <Button variant="ghost" size="icon-xs" onClick={() => setEditing(true)} aria-label="Modifier mon message">
              <Pencil className="size-3" aria-hidden="true" />
            </Button>
          )}
          {(mine || canManage) && (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="icon-xs" aria-label="Supprimer le message">
                  <Trash2 className="size-3" aria-hidden="true" />
                </Button>
              }
              title="Supprimer ce message ?"
              description="Le contenu sera masqué pour tout le monde."
              confirmLabel="Supprimer"
              onConfirm={async () => {
                const res = await actions.remove(eventId, m.id);
                if (res.ok) router.refresh();
                return res;
              }}
            />
          )}
          {!mine && <ReportDialog eventId={eventId} messageId={m.id} action={actions.report} />}
        </div>
      )}
    </article>
  );
}

const REASON_LABELS: Record<(typeof REPORT_REASONS)[number], string> = { inappropriate: "Contenu inapproprié", fraud: "Tentative de fraude", spam: "Spam", safety: "Sécurité d'une personne", legal: "Problème juridique", other: "Autre" };

function ReportDialog({ eventId, messageId, action }: { eventId: string; messageId: string; action: Actions["report"] }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]>("inappropriate");
  const [details, setDetails] = useState("");
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label="Signaler le message">
          <Flag className="size-3" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Signaler ce message</DialogTitle>
          <DialogDescription>L'équipe de modération de Sous Nos Ailes examinera le signalement. L'auteur n'est pas informé de votre identité.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await action(eventId, messageId, reason, details || null);
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              toast.success("Signalement transmis.");
              setOpen(false);
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="rep-reason">Motif</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as typeof reason)}>
              <SelectTrigger id="rep-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {REASON_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rep-details">Précisions (optionnel)</Label>
            <Textarea id="rep-details" value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={1000} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              Signaler
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MembersDialog({ channel, members, allMembers, canManage, eventId, action }: { channel: { id: string; isOpen: boolean; kind: string }; members: Member[]; allMembers: Array<{ id: string; name: string; role: string }>; canManage: boolean; eventId: string; action: Actions["updateMembers"] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(members.map((m) => m.memberId));
  const [pending, start] = useTransition();
  const editable = canManage && !channel.isOpen && channel.kind !== "general";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Users className="size-3.5" aria-hidden="true" />
          {members.length}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Membres du canal</DialogTitle>
          <DialogDescription>{channel.isOpen ? "Ce canal est ouvert à toute l'équipe de l'évènement." : "Seuls ces membres (et les organisateurs) voient ce canal."}</DialogDescription>
        </DialogHeader>
        {editable ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await action(eventId, channel.id, selected);
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                toast.success("Membres mis à jour.");
                setOpen(false);
                router.refresh();
              });
            }}
          >
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-2">
              {allMembers.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={selected.includes(m.id)} onCheckedChange={(v) => setSelected((s) => (v ? [...s, m.id] : s.filter((x) => x !== m.id)))} />
                  <span className="flex-1">{m.name}</span>
                  <span className="text-xs text-muted-foreground">{m.role}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={pending}>
                Enregistrer
              </Button>
            </div>
          </form>
        ) : (
          <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
            {members.map((m) => (
              <li key={m.memberId} className="flex items-center justify-between rounded-lg px-2 py-1">
                <span>{m.name}</span>
                <span className="text-xs text-muted-foreground">{m.role}</span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Composer({ eventId, channelId, members, placeholder, action }: { eventId: string; channelId: string; members: Member[]; placeholder?: string; action: Actions["post"] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<Array<{ id: string; name: string }>>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return members.filter((m) => m.name.toLowerCase().startsWith(q) || m.name.split(" ")[0]?.toLowerCase().startsWith(q)).slice(0, 6);
  }, [mentionQuery, members]);

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setBody(value);
    const caret = e.target.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const match = /(^|\s)@([\p{L}'’-]*)$/u.exec(before);
    setMentionQuery(match ? (match[2] ?? "") : null);
  }

  function insertMention(name: string) {
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? body.length;
    const before = body.slice(0, caret).replace(/@[\p{L}'’-]*$/u, `@${name.split(" ")[0]} `);
    setBody(before + body.slice(caret));
    setMentionQuery(null);
    el?.focus();
  }

  function send() {
    if (!body.trim() && files.length === 0) return;
    start(async () => {
      const res = await action(eventId, channelId, { body, attachmentFileIds: files.map((f) => f.id) });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      setBody("");
      setFiles([]);
      setShowUpload(false);
      router.refresh();
    });
  }

  return (
    <form
      className="relative space-y-2 border-t p-3"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      {suggestions.length > 0 && (
        <ul className="absolute bottom-full left-3 mb-1 w-64 rounded-xl border bg-popover p-1 shadow-md" role="listbox" aria-label="Suggestions de mention">
          {suggestions.map((m) => (
            <li key={m.memberId}>
              <button type="button" role="option" aria-selected={false} onClick={() => insertMention(m.name)} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
                <span>{m.name}</span>
                <span className="text-xs text-muted-foreground">{m.role}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Label htmlFor="composer" className="sr-only">
        Votre message
      </Label>
      <Textarea
        id="composer"
        ref={textareaRef}
        value={body}
        onChange={onChange}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            send();
          }
          if (e.key === "Escape") setMentionQuery(null);
        }}
        rows={2}
        maxLength={4000}
        placeholder={placeholder ?? "Écrire un message… Utilisez @Prénom pour mentionner quelqu'un."}
      />
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-xs">
          {files.map((f) => (
            <li key={f.id} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1">
              <Paperclip className="size-3" aria-hidden="true" />
              {f.name}
              <button type="button" className="ml-1 text-muted-foreground hover:text-foreground" onClick={() => setFiles((l) => l.filter((x) => x.id !== f.id))} aria-label={`Retirer ${f.name}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {showUpload && files.length < 5 && <FileUpload scope="event" scopeId={eventId} purpose="attachment" maxFiles={5 - files.length} onUploaded={(f) => setFiles((l) => [...l, { id: f.id, name: f.originalName }])} />}
      <FormMessage error={error} />
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowUpload((v) => !v)} aria-pressed={showUpload}>
          <Paperclip className="size-3.5" aria-hidden="true" />
          Pièce jointe
        </Button>
        <Button type="submit" size="sm" disabled={pending || (!body.trim() && files.length === 0)}>
          <Send className="size-3.5" aria-hidden="true" />
          Envoyer
        </Button>
      </div>
    </form>
  );
}
