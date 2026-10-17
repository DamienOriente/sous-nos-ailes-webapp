/**
 * Seating plan geometry on a normalised 1000x700 canvas. Pure helpers used by
 * the SVG editor, the service and the PDF export.
 */
export const CANVAS = { width: 1000, height: 700 } as const;
export const GRID = 10;

export const TABLE_SHAPES = ["round", "rectangle", "square", "oval"] as const;
export type TableShape = (typeof TABLE_SHAPES)[number];
export const TABLE_SHAPE_LABELS: Record<TableShape, string> = { round: "Ronde", rectangle: "Rectangulaire", square: "Carrée", oval: "Ovale" };

export type Position = { x: number; y: number };

export function snap(value: number, grid = GRID): number {
  return Math.round(value / grid) * grid;
}

/** Keeps a table centre inside the canvas with a margin for its footprint. */
export function clampPosition(p: Position, footprint: { w: number; h: number }): Position {
  const hw = footprint.w / 2;
  const hh = footprint.h / 2;
  return {
    x: Math.min(CANVAS.width - hw, Math.max(hw, p.x)),
    y: Math.min(CANVAS.height - hh, Math.max(hh, p.y)),
  };
}

/** Parses a loosely typed position (form values, JSON) into finite numbers. */
export function parsePosition(input: { x: unknown; y: unknown }): Position | null {
  const x = typeof input.x === "number" ? input.x : typeof input.x === "string" ? Number.parseFloat(input.x.replace(",", ".")) : NaN;
  const y = typeof input.y === "number" ? input.y : typeof input.y === "string" ? Number.parseFloat(input.y.replace(",", ".")) : NaN;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

export function serializePosition(p: Position): { x: number; y: number } {
  return { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 };
}

/** Footprint grows gently with capacity so a 12-seat table reads bigger than a 4-seat one. */
export function tableFootprint(shape: TableShape, capacity: number): { w: number; h: number } {
  const base = 70 + Math.min(Math.max(capacity, 2), 20) * 3.5;
  switch (shape) {
    case "round":
      return { w: base, h: base };
    case "square":
      return { w: base, h: base };
    case "rectangle":
      return { w: base * 1.7, h: base * 0.75 };
    case "oval":
      return { w: base * 1.6, h: base * 0.85 };
  }
}

export type Occupancy = { used: number; free: number; over: number; isOver: boolean };

export function seatOccupancy(capacity: number, assignedCount: number): Occupancy {
  const over = Math.max(0, assignedCount - capacity);
  return { used: assignedCount, free: Math.max(0, capacity - assignedCount), over, isOver: over > 0 };
}

/** Snap + clamp a dragged position; the one place that defines where a table may land. */
export function settlePosition(p: Position, shape: TableShape, capacity: number): Position {
  return clampPosition({ x: snap(p.x), y: snap(p.y) }, tableFootprint(shape, capacity));
}

export type MoveRecord = { tableId: string; from: Position; to: Position };

/** Single-level undo: remembers only the last move. */
export function pushMove(_stack: MoveRecord | null, move: MoveRecord): MoveRecord {
  return move;
}

export function popMove(stack: MoveRecord | null): { undo: MoveRecord | null; stack: MoveRecord | null } {
  return { undo: stack, stack: null };
}

/** Positions of seats around a table (for the PDF and the SVG dots). */
export function seatPoints(shape: TableShape, capacity: number): Position[] {
  const { w, h } = tableFootprint(shape, capacity);
  const pts: Position[] = [];
  if (shape === "round" || shape === "oval") {
    const rx = w / 2 + 8;
    const ry = h / 2 + 8;
    for (let i = 0; i < capacity; i += 1) {
      const a = (i / capacity) * Math.PI * 2 - Math.PI / 2;
      pts.push({ x: Math.cos(a) * rx, y: Math.sin(a) * ry });
    }
    return pts;
  }
  const perLong = Math.ceil(capacity / 2);
  const stepX = w / (perLong + 1);
  for (let i = 0; i < capacity; i += 1) {
    const row = i < perLong ? -1 : 1;
    const idx = i < perLong ? i : i - perLong;
    pts.push({ x: -w / 2 + stepX * (idx + 1), y: row * (h / 2 + 8) });
  }
  return pts;
}
