import { createHash } from "node:crypto";

/**
 * Provider-agnostic representation of a calendar event used by the sync
 * engine and the adapters. Fingerprints are computed on this normalised
 * shape so an unchanged event is never re-pushed and both-sides edits are
 * detected as conflicts.
 */
export type NormalizedEvent = {
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  timezone: string;
  rrule: string | null;
};

export function fingerprint(e: NormalizedEvent): string {
  const payload = JSON.stringify({
    t: e.title.trim(),
    d: (e.description ?? "").trim(),
    l: (e.location ?? "").trim(),
    s: e.allDay ? e.startsAt.toISOString().slice(0, 10) : e.startsAt.toISOString(),
    e: e.allDay ? e.endsAt.toISOString().slice(0, 10) : e.endsAt.toISOString(),
    a: e.allDay,
    r: e.rrule ?? "",
  });
  return createHash("sha256").update(payload).digest("hex");
}

export type SyncDecision = "noop" | "push" | "pull" | "conflict_keep_internal";

/**
 * Decides what to do for a mapped pair. `origin` says which side created the
 * entry; the internal side wins conflicts (both changed since last sync).
 */
export function decideSync(input: {
  origin: "internal" | "external";
  direction: "export_only" | "import_only" | "both";
  lastSynced: string | null;
  internal: string | null; // fingerprint; null = deleted
  external: string | null; // fingerprint; null = deleted
}): SyncDecision {
  const { lastSynced, internal, external } = input;
  const internalChanged = internal !== lastSynced;
  const externalChanged = external !== lastSynced;
  const canPush = input.direction !== "import_only";
  const canPull = input.direction !== "export_only";
  if (!internalChanged && !externalChanged) return "noop";
  if (internalChanged && externalChanged) {
    if (input.origin === "internal" && canPush) return "conflict_keep_internal";
    if (input.origin === "external" && canPull) return "pull";
    return canPush ? "conflict_keep_internal" : canPull ? "pull" : "noop";
  }
  if (internalChanged) return canPush ? "push" : "noop";
  return canPull ? "pull" : "noop";
}
