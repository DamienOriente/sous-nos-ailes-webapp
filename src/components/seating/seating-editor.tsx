"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, FileDown, Pencil, Plus, Printer, Trash2, Undo2, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IllustratedEmpty } from "@/components/events/illustrated-empty";
import { TableScene } from "@/components/illustrations";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { ActionResult } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { CANVAS, GRID, popMove, pushMove, seatPoints, settlePosition, TABLE_SHAPE_LABELS, TABLE_SHAPES, type MoveRecord, type Position, type TableShape } from "@/modules/seating/domain/geometry";
import type { SeatingPlan, SeatingTableRecord, SeatingTableView } from "@/modules/seating/application/seating-service";
import type { TableFormValues } from "@/app/app/evenements/[id]/plan-de-table/actions";
import { TableShapeSvg } from "./table-shape";

export type SeatingActions = {
  createTable: (eventId: string, input: TableFormValues) => Promise<ActionResult<SeatingTableRecord>>;
  updateTable: (eventId: string, tableId: string, input: TableFormValues) => Promise<ActionResult<SeatingTableRecord>>;
  deleteTable: (eventId: string, tableId: string) => Promise<ActionResult>;
  moveTable: (eventId: string, tableId: string, position: Position) => Promise<ActionResult<Position>>;
  assignGuest: (eventId: string, guestId: string, tableId: string, mode?: "assign" | "move") => Promise<ActionResult>;
  unassignGuest: (eventId: string, guestId: string) => Promise<ActionResult>;
};

function TableDialog({ trigger, initial, onSubmit, title }: { trigger: React.ReactNode; initial?: Partial<TableFormValues>; title: string; onSubmit: (values: TableFormValues) => Promise<ActionResult<unknown>> }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [shape, setShape] = useState<TableShape>((initial?.shape as TableShape) ?? "round");
  function submit(fd: FormData) {
    start(async () => {
      const res = await onSubmit({ name: String(fd.get("name") ?? ""), shape, capacity: Number(fd.get("capacity") ?? 8), rotation: Number(fd.get("rotation") ?? 0) });
      if (res.ok) setOpen(false);
      else toast.error(res.error);
    });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Nom, forme, capacité et rotation. La position se règle sur le plan ou via les champs X/Y.</DialogDescription>
        </DialogHeader>
        <form action={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tbl-name">Nom</Label>
            <Input id="tbl-name" name="name" required defaultValue={initial?.name ?? ""} placeholder="Table 1" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tbl-shape">Forme</Label>
              <select id="tbl-shape" value={shape} onChange={(e) => setShape(e.target.value as TableShape)} className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm">
                {TABLE_SHAPES.map((s) => (
                  <option key={s} value={s}>
                    {TABLE_SHAPE_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tbl-capacity">Capacité</Label>
              <Input id="tbl-capacity" name="capacity" type="number" min={1} max={40} required defaultValue={initial?.capacity ?? 8} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tbl-rotation">Rotation (degrés)</Label>
            <Input id="tbl-rotation" name="rotation" type="number" min={0} max={359} step={15} defaultValue={initial?.rotation ?? 0} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SeatingEditor({ eventId, plan, canManage, actions }: { eventId: string; plan: SeatingPlan; canManage: boolean; actions: SeatingActions }) {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Position>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ tableId: string; offset: Position; from: Position } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<MoveRecord | null>(null);
  const [q, setQ] = useState("");
  const [, start] = useTransition();
  const saveTimers = useRef<Record<string, number>>({});

  const tables = useMemo(() => plan.tables.map((t) => ({ ...t, x: overrides[t.id]?.x ?? t.x, y: overrides[t.id]?.y ?? t.y })), [plan.tables, overrides]);
  const selected = tables.find((t) => t.id === selectedId) ?? null;
  const placed = plan.totalGuests - plan.unplaced.length;
  const overTables = tables.filter((t) => t.occupancy.isOver);
  const unplaced = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? plan.unplaced.filter((g) => `${g.firstName} ${g.lastName} ${g.groupName ?? ""}`.toLowerCase().includes(t)) : plan.unplaced;
  }, [plan.unplaced, q]);

  const refresh = useCallback(() => router.refresh(), [router]);

  const persistMove = useCallback(
    (table: SeatingTableView, to: Position, from: Position) => {
      const settled = settlePosition(to, table.shape, table.capacity);
      setOverrides((o) => ({ ...o, [table.id]: settled }));
      setUndoStack((s) => pushMove(s, { tableId: table.id, from, to: settled }));
      window.clearTimeout(saveTimers.current[table.id]);
      // Debounced save: a drag emits many positions, the server only needs the last one.
      saveTimers.current[table.id] = window.setTimeout(() => {
        start(async () => {
          const res = await actions.moveTable(eventId, table.id, settled);
          if (!res.ok) {
            toast.error(res.error);
            setOverrides((o) => ({ ...o, [table.id]: from }));
          }
        });
      }, 400);
    },
    [actions, eventId],
  );

  const svgPoint = useCallback((clientX: number, clientY: number): Position | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: pt.x, y: pt.y };
  }, []);

  function onPointerDown(e: React.PointerEvent<SVGGElement>, table: SeatingTableView & Position) {
    if (!canManage) return;
    const p = svgPoint(e.clientX, e.clientY);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedId(table.id);
    setDragging({ tableId: table.id, offset: { x: p.x - table.x, y: p.y - table.y }, from: { x: table.x, y: table.y } });
  }
  function onPointerMove(e: React.PointerEvent<SVGGElement>) {
    if (!dragging) return;
    const p = svgPoint(e.clientX, e.clientY);
    if (!p) return;
    setOverrides((o) => ({ ...o, [dragging.tableId]: { x: p.x - dragging.offset.x, y: p.y - dragging.offset.y } }));
  }
  function onPointerUp(e: React.PointerEvent<SVGGElement>) {
    if (!dragging) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const table = tables.find((t) => t.id === dragging.tableId);
    const current = overrides[dragging.tableId];
    setDragging(null);
    if (!table || !current) return;
    if (Math.abs(current.x - dragging.from.x) < 1 && Math.abs(current.y - dragging.from.y) < 1) {
      setOverrides((o) => ({ ...o, [table.id]: dragging.from }));
      return;
    }
    persistMove(table, current, dragging.from);
  }

  function nudge(table: SeatingTableView & Position, dx: number, dy: number) {
    persistMove(table, { x: table.x + dx, y: table.y + dy }, { x: table.x, y: table.y });
  }
  function setExact(table: SeatingTableView & Position, axis: "x" | "y", value: string) {
    const n = Number.parseFloat(value.replace(",", "."));
    if (!Number.isFinite(n)) return;
    persistMove(table, { x: axis === "x" ? n : table.x, y: axis === "y" ? n : table.y }, { x: table.x, y: table.y });
  }
  function undo() {
    const { undo: move, stack } = popMove(undoStack);
    setUndoStack(stack);
    if (!move) return;
    const table = tables.find((t) => t.id === move.tableId);
    if (!table) return;
    setOverrides((o) => ({ ...o, [table.id]: move.from }));
    start(async () => {
      const res = await actions.moveTable(eventId, table.id, move.from);
      if (!res.ok) toast.error(res.error);
    });
  }

  const assign = (guestId: string, tableId: string, mode: "assign" | "move" = "assign") =>
    start(async () => {
      const res = await actions.assignGuest(eventId, guestId, tableId, mode);
      if (res.ok) refresh();
      else toast.error(res.error);
    });
  const unassign = (guestId: string) =>
    start(async () => {
      const res = await actions.unassignGuest(eventId, guestId);
      if (res.ok) refresh();
      else toast.error(res.error);
    });

  useEffect(() => {
    const timers = saveTimers.current;
    return () => Object.values(timers).forEach((t) => window.clearTimeout(t));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {canManage && (
          <TableDialog
            title="Nouvelle table"
            onSubmit={async (v) => {
              const res = await actions.createTable(eventId, v);
              if (res.ok) {
                toast.success("Table ajoutée.");
                setSelectedId(res.data.id);
                refresh();
              }
              return res;
            }}
            trigger={
              <Button size="sm" data-testid="add-table">
                <Plus className="size-4" aria-hidden="true" /> Ajouter une table
              </Button>
            }
          />
        )}
        {canManage && (
          <Button size="sm" variant="outline" onClick={undo} disabled={!undoStack}>
            <Undo2 className="size-4" aria-hidden="true" /> Annuler le dernier déplacement
          </Button>
        )}
        <Button asChild size="sm" variant="outline">
          <Link href={`/app/evenements/${eventId}/plan-de-table/impression`}>
            <Printer className="size-4" aria-hidden="true" /> Vue impression
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href={`/api/events/${eventId}/seating/pdf`}>
            <FileDown className="size-4" aria-hidden="true" /> Export PDF
          </a>
        </Button>
        <p className="ml-auto text-sm text-muted-foreground" data-testid="seat-counter">
          <span className="font-medium text-foreground">{placed}</span>/{plan.totalGuests} invités placés · <span className="font-medium text-foreground">{Math.max(0, plan.totalSeats - placed)}</span> place(s) libre(s) sur {plan.totalSeats}
        </p>
      </div>
      {overTables.length > 0 && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" data-testid="over-capacity">
          Dépassement de capacité : {overTables.map((t) => `${t.name} (+${t.occupancy.over})`).join(", ")}.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`}
              className="h-auto w-full select-none"
              style={{ touchAction: "none" }}
              role="application"
              aria-label="Plan de table : déplacez les tables à la souris ou au doigt. Les positions sont aussi modifiables par les champs X/Y ci-dessous."
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) setSelectedId(null);
              }}
            >
              <defs>
                <pattern id="grid" width={GRID * 5} height={GRID * 5} patternUnits="userSpaceOnUse">
                  <path d={`M ${GRID * 5} 0 L 0 0 0 ${GRID * 5}`} fill="none" stroke="var(--border)" strokeWidth={0.5} />
                </pattern>
              </defs>
              <rect width={CANVAS.width} height={CANVAS.height} fill="url(#grid)" />
              {tables.map((t) => (
                <g
                  key={t.id}
                  transform={`translate(${t.x} ${t.y})`}
                  className={cn(canManage && "cursor-grab", dragging?.tableId === t.id && "cursor-grabbing")}
                  tabIndex={0}
                  role="button"
                  aria-label={`${t.name}, ${t.occupancy.used} sur ${t.capacity} places${t.occupancy.isOver ? ", dépassement" : ""}`}
                  aria-pressed={selectedId === t.id}
                  data-testid={`table-${t.id}`}
                  onPointerDown={(e) => onPointerDown(e, t)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={() => setDragging(null)}
                  onKeyDown={(e) => {
                    if (!canManage) return;
                    const step = e.shiftKey ? GRID * 5 : GRID;
                    if (e.key === "ArrowLeft") nudge(t, -step, 0);
                    else if (e.key === "ArrowRight") nudge(t, step, 0);
                    else if (e.key === "ArrowUp") nudge(t, 0, -step);
                    else if (e.key === "ArrowDown") nudge(t, 0, step);
                    else if (e.key === "Enter" || e.key === " ") setSelectedId(t.id);
                    else return;
                    e.preventDefault();
                  }}
                  onDragOver={(e) => {
                    if (!canManage) return;
                    e.preventDefault();
                    setDropTarget(t.id);
                  }}
                  onDragLeave={() => setDropTarget((d) => (d === t.id ? null : d))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDropTarget(null);
                    const guestId = e.dataTransfer.getData("text/sna-guest");
                    const mode = e.dataTransfer.getData("text/sna-mode") === "move" ? "move" : "assign";
                    if (guestId) assign(guestId, t.id, mode);
                  }}
                >
                  <g transform={`rotate(${t.rotation})`}>
                    <TableShapeSvg shape={t.shape} capacity={t.capacity} over={t.occupancy.isOver} selected={selectedId === t.id || dropTarget === t.id} />
                    {seatPoints(t.shape, t.capacity).map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r={5} fill={i < t.occupancy.used ? "var(--primary)" : "var(--muted)"} stroke="var(--border)" />
                    ))}
                  </g>
                  <text textAnchor="middle" dy="-2" fontSize={13} fontWeight={600} fill="var(--foreground)" style={{ pointerEvents: "none" }}>
                    {t.name}
                  </text>
                  <text textAnchor="middle" dy="15" fontSize={11} fill={t.occupancy.isOver ? "var(--destructive)" : "var(--muted-foreground)"} style={{ pointerEvents: "none" }}>
                    {t.occupancy.used}/{t.capacity}
                  </text>
                </g>
              ))}
              {tables.length === 0 && (
                <text x={CANVAS.width / 2} y={CANVAS.height / 2} textAnchor="middle" fontSize={20} fill="var(--muted-foreground)">
                  Ajoutez une première table
                </text>
              )}
            </svg>
          </div>

          <Card className="print:hidden">
            <CardHeader>
              <CardTitle className="text-base">Tables ({tables.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {tables.length === 0 ? (
                <IllustratedEmpty
                  scene={TableScene}
                  compact
                  className="border-0 bg-transparent px-0 py-2"
                  title="Aucune table pour le moment"
                  description="Ajoutez vos tables (ronde, rectangle, carrée, ovale), déplacez-les sur le plan puis placez les invités par glisser-déposer ou via « Placer à… »."
                  example="Table d'honneur — rectangle, 10 places"
                  testId="seating-empty"
                />
              ) : (
                <ul className="divide-y">
                  {tables.map((t) => (
                    <li key={t.id} className={cn("space-y-2 py-3", selectedId === t.id && "rounded-lg bg-primary/5 px-2")} data-testid={`table-row-${t.id}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" className="font-medium hover:underline" onClick={() => setSelectedId(t.id)}>
                          {t.name}
                        </button>
                        <span className="text-xs text-muted-foreground">
                          {TABLE_SHAPE_LABELS[t.shape]} · {t.capacity} places
                        </span>
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", t.occupancy.isOver ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")} data-testid={`occupancy-${t.id}`}>
                          {t.occupancy.used}/{t.capacity}
                          {t.occupancy.isOver ? ` (+${t.occupancy.over})` : ` · ${t.occupancy.free} libre(s)`}
                        </span>
                        {canManage && (
                          <div className="ml-auto flex items-center gap-1">
                            <TableDialog
                              title={`Modifier « ${t.name} »`}
                              initial={{ name: t.name, shape: t.shape, capacity: t.capacity, rotation: t.rotation }}
                              onSubmit={async (v) => {
                                const res = await actions.updateTable(eventId, t.id, v);
                                if (res.ok) refresh();
                                return res;
                              }}
                              trigger={
                                <Button variant="ghost" size="icon-xs" aria-label={`Modifier ${t.name}`}>
                                  <Pencil className="size-3.5" aria-hidden="true" />
                                </Button>
                              }
                            />
                            <ConfirmDialog
                              title={`Supprimer la table « ${t.name} » ?`}
                              description="Les invités placés à cette table redeviennent « non placés »."
                              confirmLabel="Supprimer"
                              successMessage="Table supprimée."
                              onConfirm={async () => {
                                const res = await actions.deleteTable(eventId, t.id);
                                if (res.ok) {
                                  if (selectedId === t.id) setSelectedId(null);
                                  refresh();
                                }
                                return res;
                              }}
                              trigger={
                                <Button variant="ghost" size="icon-xs" aria-label={`Supprimer ${t.name}`}>
                                  <Trash2 className="size-3.5" aria-hidden="true" />
                                </Button>
                              }
                            />
                          </div>
                        )}
                      </div>
                      {canManage && (
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <label className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">X</span>
                            <Input type="number" aria-label={`Position X de ${t.name}`} className="h-7 w-20" min={0} max={CANVAS.width} step={GRID} value={Math.round(t.x)} onChange={(e) => setExact(t, "x", e.target.value)} />
                          </label>
                          <label className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">Y</span>
                            <Input type="number" aria-label={`Position Y de ${t.name}`} className="h-7 w-20" min={0} max={CANVAS.height} step={GRID} value={Math.round(t.y)} onChange={(e) => setExact(t, "y", e.target.value)} />
                          </label>
                          <div className="flex gap-0.5" role="group" aria-label={`Déplacer ${t.name}`}>
                            <Button variant="outline" size="icon-xs" aria-label="Gauche" onClick={() => nudge(t, -GRID, 0)}>
                              <ArrowLeft className="size-3" aria-hidden="true" />
                            </Button>
                            <Button variant="outline" size="icon-xs" aria-label="Haut" onClick={() => nudge(t, 0, -GRID)}>
                              <ArrowUp className="size-3" aria-hidden="true" />
                            </Button>
                            <Button variant="outline" size="icon-xs" aria-label="Bas" onClick={() => nudge(t, 0, GRID)}>
                              <ArrowDown className="size-3" aria-hidden="true" />
                            </Button>
                            <Button variant="outline" size="icon-xs" aria-label="Droite" onClick={() => nudge(t, GRID, 0)}>
                              <ArrowRight className="size-3" aria-hidden="true" />
                            </Button>
                          </div>
                        </div>
                      )}
                      {t.guests.length > 0 && (
                        <ul className="flex flex-wrap gap-1.5">
                          {t.guests.map((g) => (
                            <li key={g.id} draggable={canManage} onDragStart={(e) => { e.dataTransfer.setData("text/sna-guest", g.id); e.dataTransfer.setData("text/sna-mode", "move"); }} className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs">
                              {`${g.firstName} ${g.lastName}`.trim()}
                              {g.isChild && <span className="text-muted-foreground">(enf.)</span>}
                              {canManage && (
                                <>
                                  <select aria-label={`Déplacer ${g.firstName} vers une autre table`} className="h-5 max-w-24 rounded border-0 bg-transparent text-[11px]" value="" onChange={(e) => e.target.value && assign(g.id, e.target.value, "move")}>
                                    <option value="">→ table…</option>
                                    {tables.filter((o) => o.id !== t.id).map((o) => (
                                      <option key={o.id} value={o.id}>
                                        {o.name}
                                      </option>
                                    ))}
                                  </select>
                                  <button type="button" aria-label={`Retirer ${g.firstName} de ${t.name}`} className="text-muted-foreground hover:text-destructive" onClick={() => unassign(g.id)}>
                                    <UserMinus className="size-3" aria-hidden="true" />
                                  </button>
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="print:hidden lg:sticky lg:top-20 lg:self-start">
          <CardHeader>
            <CardTitle className="text-base">Invités non placés ({plan.unplaced.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" aria-label="Rechercher un invité non placé" />
            {selected && canManage && <p className="text-xs text-muted-foreground">Table sélectionnée : <span className="font-medium text-foreground">{selected.name}</span> — glissez un invité sur le plan ou utilisez le sélecteur.</p>}
            <ul className="max-h-[60dvh] space-y-1 overflow-y-auto" data-testid="unplaced-list">
              {unplaced.length === 0 && <li className="p-2 text-sm text-muted-foreground">{plan.unplaced.length === 0 ? "Tous les invités sont placés." : "Aucun résultat."}</li>}
              {unplaced.map((g) => (
                <li key={g.id} draggable={canManage && tables.length > 0} onDragStart={(e) => { e.dataTransfer.setData("text/sna-guest", g.id); e.dataTransfer.setData("text/sna-mode", "assign"); }} className={cn("flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm", canManage && tables.length > 0 && "cursor-grab")} data-testid={`unplaced-${g.id}`}>
                  <span className="min-w-0 flex-1 truncate">
                    {`${g.firstName} ${g.lastName}`.trim()}
                    {g.isChild && <span className="ml-1 text-xs text-muted-foreground">(enfant)</span>}
                    {g.groupName && <span className="block truncate text-xs text-muted-foreground">{g.groupName}</span>}
                  </span>
                  {canManage && tables.length > 0 && (
                    <select aria-label={`Placer ${g.firstName} ${g.lastName} à une table`} className="h-7 max-w-32 rounded-md border border-input bg-transparent px-1 text-xs" value="" onChange={(e) => e.target.value && assign(g.id, e.target.value)} data-testid={`assign-${g.id}`}>
                      <option value="">Placer à…</option>
                      {tables.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.occupancy.free} libre{t.occupancy.free > 1 ? "s" : ""})
                        </option>
                      ))}
                    </select>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
