"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { IllustratedEmpty } from "@/components/events/illustrated-empty";
import { ChecklistScene } from "@/components/illustrations/event-scenes";
import { EmptyNestScene } from "@/components/illustrations";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormMessage } from "@/components/shared/form-message";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/errors";
import { cn, formatDateFr } from "@/lib/utils";
import { isTaskOverdue } from "@/modules/events/domain/checklist";
import { TASK_EXAMPLES, TASK_SECTIONS } from "@/modules/events/domain/suggestions";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, TASK_STATUSES } from "@/modules/events/domain/task-labels";
import type { TaskComment } from "@/app/app/evenements/[id]/taches/actions";

export type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done" | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  section: string | null;
  dueDate: string | null;
  assigneeMemberId: string | null;
  assigneeName: string | null;
  visibility: "organizers" | "team";
  commentCount: number;
};
export type MemberOption = { id: string; name: string };

type Actions = {
  create: (eventId: string, input: unknown) => Promise<ActionResult<{ id: string }>>;
  update: (eventId: string, taskId: string, input: unknown) => Promise<ActionResult>;
  toggle: (eventId: string, taskId: string, done: boolean) => Promise<ActionResult>;
  remove: (eventId: string, taskId: string) => Promise<ActionResult>;
  listComments: (eventId: string, taskId: string) => Promise<ActionResult<TaskComment[]>>;
  addComment: (eventId: string, taskId: string, body: string) => Promise<ActionResult>;
  /** Creates the tasks organisers often forget for this event type (titles already present are skipped). */
  addSuggested?: (eventId: string) => Promise<ActionResult<{ created: number }>>;
};

const PRIORITY_TONE = { low: "neutral", normal: "info", high: "warning", urgent: "danger" } as const;

export function TaskBoard({ eventId, tasks, members, canManage, isOrganizer, today, initialFilter, highlightTaskId, suggestionCount = 0, actions }: { eventId: string; tasks: TaskItem[]; members: MemberOption[]; canManage: boolean; isOrganizer: boolean; today: string; initialFilter?: string; highlightTaskId?: string; /** Number of quick-add suggestions not yet in the list. */ suggestionCount?: number; actions: Actions }) {
  const router = useRouter();
  const [status, setStatus] = useState<string>(initialFilter === "retard" ? "open" : "open");
  const [onlyOverdue, setOnlyOverdue] = useState(initialFilter === "retard");
  const [assignee, setAssignee] = useState<string>("all");
  const [sort, setSort] = useState<"section" | "due" | "priority">("section");
  const [editing, setEditing] = useState<TaskItem | "new" | null>(null);
  const [commentsFor, setCommentsFor] = useState<TaskItem | null>(null);
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    let list = tasks;
    if (status === "open") list = list.filter((t) => t.status === "todo" || t.status === "in_progress");
    else if (status !== "all") list = list.filter((t) => t.status === status);
    if (onlyOverdue) list = list.filter((t) => isTaskOverdue(t, today));
    if (assignee === "me") list = list.filter((t) => t.assigneeMemberId !== null && members.some((m) => m.id === t.assigneeMemberId));
    else if (assignee !== "all") list = list.filter((t) => t.assigneeMemberId === assignee);
    const prio = { urgent: 0, high: 1, normal: 2, low: 3 };
    if (sort === "due") list = [...list].sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
    if (sort === "priority") list = [...list].sort((a, b) => prio[a.priority] - prio[b.priority]);
    return list;
  }, [tasks, status, onlyOverdue, assignee, sort, today, members]);

  const sections = useMemo(() => {
    if (sort !== "section") return [["Résultats", filtered] as const];
    const map = new Map<string, TaskItem[]>();
    for (const t of filtered) map.set(t.section ?? "Autres", [...(map.get(t.section ?? "Autres") ?? []), t]);
    return [...map.entries()];
  }, [filtered, sort]);

  function toggle(t: TaskItem, done: boolean) {
    start(async () => {
      const res = await actions.toggle(eventId, t.id, done);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  const doneCount = tasks.filter((t) => t.status === "done").length;
  const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  function addSuggested() {
    if (!actions.addSuggested) return;
    start(async () => {
      const res = await actions.addSuggested!(eventId);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(res.data.created ? `${res.data.created} tâche${res.data.created > 1 ? "s" : ""} ajoutée${res.data.created > 1 ? "s" : ""}.` : "Ces tâches sont déjà dans votre liste.");
        router.refresh();
      }
    });
  }
  const suggestChip = canManage && actions.addSuggested && suggestionCount > 0 && (
    <Button variant="outline" size="sm" onClick={addSuggested} disabled={pending} data-testid="add-suggested-tasks">
      Ajouter {suggestionCount} tâche{suggestionCount > 1 ? "s" : ""} souvent oubliée{suggestionCount > 1 ? "s" : ""}
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {doneCount} / {tasks.length} tâches terminées
            </span>
            <span className="text-muted-foreground tabular-nums">{pct}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avancement des tâches">
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
          </div>
        </div>
        {canManage && tasks.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {suggestChip}
            <Button onClick={() => setEditing("new")}>Nouvelle tâche</Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="f-status" className="text-xs">
            Statut
          </Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="f-status" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">À faire + en cours</SelectItem>
              {TASK_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </SelectItem>
              ))}
              <SelectItem value="all">Toutes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-assignee" className="text-xs">
            Assigné à
          </Label>
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger id="f-assignee" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tout le monde</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-sort" className="text-xs">
            Tri
          </Label>
          <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
            <SelectTrigger id="f-sort" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="section">Par section</SelectItem>
              <SelectItem value="due">Par échéance</SelectItem>
              <SelectItem value="priority">Par priorité</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <Checkbox checked={onlyOverdue} onCheckedChange={(v) => setOnlyOverdue(Boolean(v))} />
          En retard uniquement
        </label>
      </div>

      {tasks.length === 0 ? (
        <IllustratedEmpty
          scene={ChecklistScene}
          title="Votre liste de préparation est vide"
          description="Les tâches se rangent par section (Lieu, Prestataires, Enfants, Invités…), avec une échéance, un responsable et des commentaires. Les tâches « Équipe » sont visibles des prestataires."
          example="Réserver le traiteur avant le 12 mars"
          action={canManage ? <>{suggestChip}<Button onClick={() => setEditing("new")}>Nouvelle tâche</Button></> : undefined}
          testId="tasks-empty"
        />
      ) : filtered.length === 0 ? (
        <IllustratedEmpty scene={EmptyNestScene} compact title="Aucune tâche ne correspond" description="Modifiez les filtres pour en voir davantage." action={<Button variant="outline" size="sm" onClick={() => { setStatus("open"); setOnlyOverdue(false); setAssignee("all"); }}>Réinitialiser les filtres</Button>} />
      ) : (
        <div className="space-y-6">
          {sections.map(([section, list]) => (
            <section key={section} aria-labelledby={`sec-${section}`}>
              <h2 id={`sec-${section}`} className="mb-2 text-base font-semibold">
                {section} <span className="font-normal text-muted-foreground tabular-nums">({list.length})</span>
              </h2>
              <ul className="divide-y rounded-2xl border bg-card">
                {list.map((t) => {
                  const overdue = isTaskOverdue(t, today);
                  const done = t.status === "done";
                  return (
                    <li key={t.id} id={`tache-${t.id}`} className={cn("flex items-start gap-3 px-4 py-3", highlightTaskId === t.id && "bg-accent/40")}>
                      <Checkbox className="mt-0.5" checked={done} disabled={!canManage || pending || t.status === "cancelled"} onCheckedChange={(v) => toggle(t, Boolean(v))} aria-label={`Marquer « ${t.title} » comme ${done ? "à faire" : "faite"}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn("font-medium", done && "text-muted-foreground line-through")}>{t.title}</span>
                          {t.priority !== "normal" && <StatusBadge tone={PRIORITY_TONE[t.priority]} dot={false}>{TASK_PRIORITY_LABELS[t.priority]}</StatusBadge>}
                          {t.status === "in_progress" && <StatusBadge tone="info">En cours</StatusBadge>}
                          {t.status === "cancelled" && <StatusBadge tone="neutral">Annulée</StatusBadge>}
                          {isOrganizer && t.visibility === "team" && <StatusBadge tone="primary" dot={false}>Équipe</StatusBadge>}
                        </div>
                        {t.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>}
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {t.dueDate && (
                            <span className={cn("tabular-nums", overdue && "font-medium text-destructive")}>
                              {formatDateFr(t.dueDate, { day: "numeric", month: "short", year: "numeric" })}
                              {overdue ? " (en retard)" : ""}
                            </span>
                          )}
                          {t.assigneeName && <span>{t.assigneeName}</span>}
                          <button type="button" onClick={() => setCommentsFor(t)} className="underline-offset-2 hover:text-foreground hover:underline">
                            {t.commentCount} commentaire{t.commentCount > 1 ? "s" : ""}
                          </button>
                        </div>
                      </div>
                      {canManage && (
                        <div className="flex shrink-0 items-center gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => setEditing(t)} aria-label={`Modifier « ${t.title} »`}>
                            <Pencil className="size-3.5" aria-hidden="true" />
                          </Button>
                          <ConfirmDialog
                            trigger={
                              <Button variant="ghost" size="icon-sm" aria-label={`Supprimer « ${t.title} »`}>
                                <Trash2 className="size-3.5" aria-hidden="true" />
                              </Button>
                            }
                            title="Supprimer cette tâche ?"
                            description={`« ${t.title} » et ses commentaires seront supprimés définitivement.`}
                            confirmLabel="Supprimer"
                            successMessage="Tâche supprimée."
                            onConfirm={async () => {
                              const res = await actions.remove(eventId, t.id);
                              if (res.ok) router.refresh();
                              return res;
                            }}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <TaskDialog eventId={eventId} task={editing} members={members} isOrganizer={isOrganizer} onClose={() => setEditing(null)} actions={actions} />
      <CommentsSheet eventId={eventId} task={commentsFor} onClose={() => setCommentsFor(null)} actions={actions} />
    </div>
  );
}

function TaskDialog({ eventId, task, members, isOrganizer, onClose, actions }: { eventId: string; task: TaskItem | "new" | null; members: MemberOption[]; isOrganizer: boolean; onClose: () => void; actions: Actions }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const open = task !== null;
  const t = task === "new" ? null : task;
  const [title, setTitle] = useState("");
  const [section, setSection] = useState("");
  const [forKey, setForKey] = useState<string | null>(null);
  const key = t?.id ?? (task === "new" ? "new" : null);
  if (key !== forKey) {
    setForKey(key);
    setTitle(t?.title ?? "");
    setSection(t?.section ?? "");
  }
  const examples = TASK_EXAMPLES[section] ?? TASK_EXAMPLES.Autres ?? [];
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = {
      title,
      description: String(fd.get("description") ?? "") || null,
      section: String(fd.get("section") ?? "") || null,
      status: String(fd.get("status") ?? "todo"),
      priority: String(fd.get("priority") ?? "normal"),
      dueDate: String(fd.get("dueDate") ?? "") || null,
      assigneeMemberId: (fd.get("assigneeMemberId") as string) === "none" || !fd.get("assigneeMemberId") ? null : String(fd.get("assigneeMemberId")),
      visibility: String(fd.get("visibility") ?? "organizers"),
    };
    start(async () => {
      const res = t ? await actions.update(eventId, t.id, input) : await actions.create(eventId, input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(t ? "Tâche mise à jour." : "Tâche créée.");
      setError(null);
      onClose();
      router.refresh();
    });
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t ? "Modifier la tâche" : "Nouvelle tâche"}</DialogTitle>
          <DialogDescription>Les tâches « Équipe » sont visibles par les prestataires ; les autres restent entre organisateurs.</DialogDescription>
        </DialogHeader>
        <form key={t?.id ?? "new"} onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="t-title">Titre</Label>
            <Input id="t-title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} maxLength={200} autoFocus placeholder={examples[0] ?? "Réserver le traiteur avant le 12 mars"} />
            {!t && (
              <div className="flex flex-wrap gap-1.5 pt-1" aria-label="Exemples de tâches">
                {examples.map((ex) => (
                  <button key={ex} type="button" onClick={() => setTitle(ex)} className="rounded-md border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                    {ex}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-desc">Description</Label>
            <Textarea id="t-desc" name="description" defaultValue={t?.description ?? ""} rows={3} maxLength={4000} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="t-section">Section</Label>
              <Input id="t-section" name="section" value={section} onChange={(e) => setSection(e.target.value)} placeholder="Lieu, Enfants, Invités…" maxLength={80} list="task-sections" />
              <datalist id="task-sections">
                {TASK_SECTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-due">Échéance</Label>
              <Input id="t-due" name="dueDate" type="date" defaultValue={t?.dueDate ?? ""} aria-describedby="t-due-hint" />
              <p id="t-due-hint" className="text-xs text-muted-foreground">Les tâches datées remontent dans « Prochaines échéances ».</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-status">Statut</Label>
              <Select name="status" defaultValue={t?.status ?? "todo"}>
                <SelectTrigger id="t-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {TASK_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-priority">Priorité</Label>
              <Select name="priority" defaultValue={t?.priority ?? "normal"}>
                <SelectTrigger id="t-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {TASK_PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-assignee">Assigner à</Label>
              <Select name="assigneeMemberId" defaultValue={t?.assigneeMemberId ?? "none"}>
                <SelectTrigger id="t-assignee">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Personne</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isOrganizer && (
              <div className="space-y-1.5">
                <Label htmlFor="t-visibility">Visibilité</Label>
                <Select name="visibility" defaultValue={t?.visibility ?? "organizers"}>
                  <SelectTrigger id="t-visibility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="organizers">Organisateurs seulement</SelectItem>
                    <SelectItem value="team">Toute l'équipe (prestataires inclus)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <FormMessage error={error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending} aria-busy={pending}>
              {pending ? "Enregistrement…" : t ? "Enregistrer" : "Créer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CommentsSheet({ eventId, task, onClose, actions }: { eventId: string; task: TaskItem | null; onClose: () => void; actions: Actions }) {
  const router = useRouter();
  // Comments are keyed by task id so switching task shows the loading state without a setState in the effect body.
  const [loaded, setLoaded] = useState<{ taskId: string; comments: TaskComment[] } | null>(null);
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const taskId = task?.id ?? null;
  const comments = loaded && loaded.taskId === taskId ? loaded.comments : null;
  const setComments = (list: TaskComment[]) => (taskId ? setLoaded({ taskId, comments: list }) : undefined);
  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;
    void actions.listComments(eventId, taskId).then((res) => {
      if (cancelled) return;
      setLoaded({ taskId, comments: res.ok ? res.data : [] });
      if (!res.ok) toast.error(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [taskId, eventId, actions]);
  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!task || !body.trim()) return;
    start(async () => {
      const res = await actions.addComment(eventId, task.id, body);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setBody("");
      const list = await actions.listComments(eventId, task.id);
      if (list.ok) setComments(list.data);
      router.refresh();
    });
  }
  return (
    <Sheet open={task !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Commentaires</SheetTitle>
          <SheetDescription>{task?.title}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-3 overflow-y-auto px-4">
          {comments === null ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun commentaire pour l'instant.</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="rounded-xl bg-muted/60 px-3 py-2 text-sm">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{c.authorName}</span>
                  <time dateTime={c.createdAt}>{formatDateFr(c.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
                </div>
                <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
              </div>
            ))
          )}
        </div>
        <form onSubmit={send} className="space-y-2 border-t p-4">
          <Label htmlFor="comment-body" className="sr-only">
            Votre commentaire
          </Label>
          <Textarea id="comment-body" value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={2000} placeholder="Ajouter un commentaire…" />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={pending || !body.trim()}>
              Envoyer
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
