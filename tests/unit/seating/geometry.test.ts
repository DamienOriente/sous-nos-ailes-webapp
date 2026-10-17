import { describe, expect, it } from "vitest";
import { CANVAS, clampPosition, parsePosition, popMove, pushMove, seatOccupancy, seatPoints, serializePosition, settlePosition, snap, tableFootprint } from "@/modules/seating/domain/geometry";

describe("positions", () => {
  it("snaps to the 10px grid", () => {
    expect(snap(123)).toBe(120);
    expect(snap(125)).toBe(130);
    expect(snap(-4)).toBe(-0);
  });
  it("clamps inside the canvas according to the footprint", () => {
    const fp = tableFootprint("round", 8);
    expect(clampPosition({ x: -50, y: 2000 }, fp)).toEqual({ x: fp.w / 2, y: CANVAS.height - fp.h / 2 });
    const settled = settlePosition({ x: 5000, y: 5000 }, "rectangle", 12);
    expect(settled.x).toBeLessThanOrEqual(CANVAS.width);
    expect(settled.y).toBeLessThanOrEqual(CANVAS.height);
    // Snapped before clamping: a free position lands on the grid.
    expect(settlePosition({ x: 333, y: 337 }, "round", 8)).toEqual({ x: 330, y: 340 });
  });
  it("parses loose inputs and serialises with 2 decimals", () => {
    expect(parsePosition({ x: "12,5", y: 7 })).toEqual({ x: 12.5, y: 7 });
    expect(parsePosition({ x: "abc", y: 1 })).toBeNull();
    expect(parsePosition({ x: null, y: 1 })).toBeNull();
    expect(serializePosition({ x: 1.23456, y: 2 })).toEqual({ x: 1.23, y: 2 });
  });
});

describe("capacity", () => {
  it("reports free seats and over-capacity", () => {
    expect(seatOccupancy(8, 6)).toEqual({ used: 6, free: 2, over: 0, isOver: false });
    expect(seatOccupancy(8, 10)).toEqual({ used: 10, free: 0, over: 2, isOver: true });
  });
  it("places exactly `capacity` seats around each shape", () => {
    for (const shape of ["round", "oval", "rectangle", "square"] as const) {
      expect(seatPoints(shape, 7)).toHaveLength(7);
    }
    expect(tableFootprint("rectangle", 10).w).toBeGreaterThan(tableFootprint("rectangle", 10).h);
    expect(tableFootprint("round", 12).w).toBeGreaterThan(tableFootprint("round", 4).w);
  });
});

describe("undo", () => {
  it("keeps only the last move", () => {
    const m1 = { tableId: "t1", from: { x: 0, y: 0 }, to: { x: 10, y: 10 } };
    const m2 = { tableId: "t2", from: { x: 5, y: 5 }, to: { x: 50, y: 50 } };
    const stack = pushMove(pushMove(null, m1), m2);
    expect(popMove(stack)).toEqual({ undo: m2, stack: null });
    expect(popMove(null)).toEqual({ undo: null, stack: null });
  });
});
