import { describe, expect, it } from "vitest";
import { canTransitionEventStatus, countdownLabel, daysUntil, isEventLive, nextEventStatuses, toLocalDateString } from "@/modules/events/domain/event-status";

describe("event status state machine", () => {
  it("follows planning → confirmed → in_progress → completed → archived", () => {
    expect(canTransitionEventStatus("planning", "confirmed")).toBe(true);
    expect(canTransitionEventStatus("confirmed", "in_progress")).toBe(true);
    expect(canTransitionEventStatus("in_progress", "completed")).toBe(true);
    expect(canTransitionEventStatus("completed", "archived")).toBe(true);
  });
  it("allows cancellation from live states only", () => {
    expect(canTransitionEventStatus("planning", "cancelled")).toBe(true);
    expect(canTransitionEventStatus("in_progress", "cancelled")).toBe(true);
    expect(canTransitionEventStatus("completed", "cancelled")).toBe(false);
    expect(canTransitionEventStatus("archived", "cancelled")).toBe(false);
  });
  it("archived is terminal and completed cannot go back", () => {
    expect(nextEventStatuses("archived")).toEqual([]);
    expect(canTransitionEventStatus("completed", "planning")).toBe(false);
    expect(canTransitionEventStatus("completed", "in_progress")).toBe(false);
  });
  it("a cancelled event can be reopened", () => {
    expect(canTransitionEventStatus("cancelled", "planning")).toBe(true);
  });
  it("isEventLive", () => {
    expect(isEventLive("planning")).toBe(true);
    expect(isEventLive("completed")).toBe(false);
  });
});

describe("countdown", () => {
  it("computes days until the event date", () => {
    expect(daysUntil("2027-06-12", "2027-06-10")).toBe(2);
    expect(daysUntil("2027-06-12", "2027-06-12")).toBe(0);
    expect(daysUntil("2027-06-12", "2027-06-13")).toBe(-1);
    expect(daysUntil("2027-03-28", "2027-03-27")).toBe(1); // DST switch weekend
  });
  it("labels", () => {
    expect(countdownLabel(0)).toBe("C'est aujourd'hui !");
    expect(countdownLabel(1)).toBe("C'est demain");
    expect(countdownLabel(12)).toBe("J-12");
    expect(countdownLabel(240)).toMatch(/^J-240 · environ 8 mois$/);
    expect(countdownLabel(-3)).toBe("Il y a 3 jours");
  });
  it("local date string respects the timezone", () => {
    // 23:30 UTC on 2027-06-11 is already the 12th in Paris (UTC+2).
    expect(toLocalDateString(new Date("2027-06-11T23:30:00Z"), "Europe/Paris")).toBe("2027-06-12");
    expect(toLocalDateString(new Date("2027-06-11T23:30:00Z"), "UTC")).toBe("2027-06-11");
  });
});
