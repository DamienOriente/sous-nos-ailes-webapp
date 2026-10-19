import { and, eq, isNull } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { calendarConnections, calendarEntries, calendarSyncJobs, calendarSyncMappings } from "@/db/schema";
import { ForbiddenError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { decideSync, fingerprint, type NormalizedEvent } from "@/modules/calendar/domain/sync";
import { getProviderAdapter } from "@/modules/calendar/infrastructure/adapters";
import { ProviderAuthError, ProviderCursorError, type CalendarProviderAdapter, type ExternalEvent } from "@/modules/calendar/infrastructure/provider-adapter";
import { getFreshAccessToken, type SyncDirection } from "./connections-service";

export type SyncResult = { pushed: number; pulled: number; conflicts: number };

/** Window pulled from the provider on the initial (cursor-less) sync. */
const PULL_WINDOW = { pastDays: 30, futureDays: 400 };

/**
 * Runs one synchronisation job for a connection. Source of truth: internal
 * for entries created here, external for entries imported from the
 * provider. Changes are detected with fingerprints stored on the mapping, so
 * nothing is pushed twice and both-sides edits are reported as conflicts
 * (internal version kept). Failures mark the job `failed` and the connection
 * `error` / `expired`, then rethrow so the queue can retry.
 *
 * `adapterOverride` lets tests inject an adapter with a mocked fetch.
 */
export async function runCalendarSyncJob(connectionId: string, adapterOverride?: CalendarProviderAdapter, executor: DbExecutor = db): Promise<SyncResult> {
  const [connection] = await executor.select().from(calendarConnections).where(eq(calendarConnections.id, connectionId)).limit(1);
  if (!connection) throw new Error(`calendar connection ${connectionId} not found`);
  const adapter = adapterOverride ?? getProviderAdapter(connection.provider);
  const direction = connection.syncDirection as SyncDirection;
  const [job] = await executor.insert(calendarSyncJobs).values({ connectionId, status: "running", direction, attempts: 1, startedAt: new Date() }).returning({ id: calendarSyncJobs.id });
  const jobId = job!.id;
  const result: SyncResult = { pushed: 0, pulled: 0, conflicts: 0 };
  try {
    if (!adapter) throw new Error("Intégration non activée sur cette instance.");
    if (connection.status === "revoked") throw new ForbiddenError("Connexion révoquée.");
    if (!connection.externalCalendarId) throw new Error("Aucun calendrier cible sélectionné.");
    const accessToken = await getFreshAccessToken(connection, adapter, executor);
    const calendarId = connection.externalCalendarId;

    if (direction !== "export_only") {
      await pull(executor, adapter, accessToken, connection.id, connection.userId, calendarId, connection.syncCursor, direction, result);
    }
    if (direction !== "import_only") {
      await push(executor, adapter, accessToken, connection.id, connection.userId, calendarId, direction, result);
    }
    await executor.update(calendarSyncJobs).set({ status: "succeeded", pushed: result.pushed, pulled: result.pulled, conflicts: result.conflicts, finishedAt: new Date() }).where(eq(calendarSyncJobs.id, jobId));
    await executor.update(calendarConnections).set({ status: "active", lastSyncAt: new Date(), lastError: null }).where(eq(calendarConnections.id, connectionId));
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const expired = err instanceof ProviderAuthError || err instanceof ForbiddenError;
    await executor.update(calendarSyncJobs).set({ status: "failed", error: message.slice(0, 1000), pushed: result.pushed, pulled: result.pulled, conflicts: result.conflicts, finishedAt: new Date() }).where(eq(calendarSyncJobs.id, jobId));
    await executor.update(calendarConnections).set({ status: expired ? "expired" : "error", lastError: message.slice(0, 1000) }).where(eq(calendarConnections.id, connectionId));
    logger.warn({ connectionId, err: message }, "calendar sync failed");
    throw err;
  }
}

function toNormalized(e: typeof calendarEntries.$inferSelect): NormalizedEvent {
  return { title: e.title, description: e.description, location: e.location, startsAt: e.startsAt, endsAt: e.endsAt, allDay: e.allDay, timezone: e.timezone, rrule: e.rrule };
}

async function pull(executor: DbExecutor, adapter: CalendarProviderAdapter, accessToken: string, connectionId: string, userId: string, calendarId: string, cursor: string | null, direction: SyncDirection, result: SyncResult) {
  const now = Date.now();
  const window = { from: new Date(now - PULL_WINDOW.pastDays * 86_400_000), to: new Date(now + PULL_WINDOW.futureDays * 86_400_000) };
  let changes: Awaited<ReturnType<CalendarProviderAdapter["listChanges"]>>;
  try {
    changes = await adapter.listChanges(accessToken, calendarId, cursor, window);
  } catch (err) {
    if (!(err instanceof ProviderCursorError)) throw err;
    // Cursor expired at the provider: full resync once.
    changes = await adapter.listChanges(accessToken, calendarId, null, window);
  }
  for (const ext of changes.events) await applyExternalChange(executor, connectionId, userId, ext, direction, result, adapter.provider);
  await executor.update(calendarConnections).set({ syncCursor: changes.nextCursor }).where(eq(calendarConnections.id, connectionId));
}

async function applyExternalChange(executor: DbExecutor, connectionId: string, userId: string, ext: ExternalEvent, direction: SyncDirection, result: SyncResult, provider: string) {
  const [mapping] = await executor
    .select()
    .from(calendarSyncMappings)
    .where(and(eq(calendarSyncMappings.connectionId, connectionId), eq(calendarSyncMappings.externalId, ext.externalId)))
    .limit(1);

  if (ext.deleted) {
    if (!mapping) return;
    if (mapping.origin === "external" && mapping.entryId) {
      await executor.delete(calendarEntries).where(eq(calendarEntries.id, mapping.entryId));
      await executor.delete(calendarSyncMappings).where(eq(calendarSyncMappings.id, mapping.id));
      result.pulled++;
    } else {
      // Internal entry is the source of truth: remember the external deletion, keep the internal entry.
      await executor.update(calendarSyncMappings).set({ externalDeletedAt: new Date() }).where(eq(calendarSyncMappings.id, mapping.id));
    }
    return;
  }
  if (!ext.event) return;
  const extFp = fingerprint(ext.event);

  if (!mapping) {
    // New external event → new internal entry owned by the provider.
    const icalUid = ext.icalUid ?? `${ext.externalId}@${provider}`;
    const [entry] = await executor
      .insert(calendarEntries)
      .values({ ownerUserId: userId, kind: "other", ...ext.event, exdates: [], icalUid, sourceConnectionId: connectionId })
      .onConflictDoUpdate({ target: [calendarEntries.ownerUserId, calendarEntries.icalUid], set: { ...ext.event, sourceConnectionId: connectionId } })
      .returning({ id: calendarEntries.id });
    await executor.insert(calendarSyncMappings).values({ connectionId, entryId: entry!.id, externalId: ext.externalId, externalEtag: ext.etag, lastSyncedFingerprint: extFp, origin: "external" });
    result.pulled++;
    return;
  }

  const entry = mapping.entryId ? (await executor.select().from(calendarEntries).where(eq(calendarEntries.id, mapping.entryId)).limit(1))[0] : undefined;
  if (!entry) {
    // Internal entry deleted meanwhile → handled by push (delete externally) when direction allows; nothing to pull.
    return;
  }
  const decision = decideSync({ origin: mapping.origin as "internal" | "external", direction, lastSynced: mapping.lastSyncedFingerprint, internal: fingerprint(toNormalized(entry)), external: extFp });
  if (decision === "pull") {
    await executor.update(calendarEntries).set({ ...ext.event }).where(eq(calendarEntries.id, entry.id));
    await executor.update(calendarSyncMappings).set({ lastSyncedFingerprint: extFp, externalEtag: ext.etag, externalDeletedAt: null }).where(eq(calendarSyncMappings.id, mapping.id));
    result.pulled++;
  } else if (decision === "conflict_keep_internal") {
    result.conflicts++;
    // Mark the mapping stale so the push phase re-pushes the internal version.
    await executor.update(calendarSyncMappings).set({ lastSyncedFingerprint: `conflict:${extFp}` }).where(eq(calendarSyncMappings.id, mapping.id));
  }
}

async function push(executor: DbExecutor, adapter: CalendarProviderAdapter, accessToken: string, connectionId: string, userId: string, calendarId: string, _direction: SyncDirection, result: SyncResult) {
  const mappings = await executor.select().from(calendarSyncMappings).where(eq(calendarSyncMappings.connectionId, connectionId));
  const byEntry = new Map(mappings.filter((m) => m.entryId).map((m) => [m.entryId!, m]));

  // 1. Internal entries deleted since the last sync → delete externally.
  for (const m of mappings) {
    if (m.entryId) continue;
    if (m.origin === "internal" && !m.externalDeletedAt) await adapter.deleteEvent(accessToken, calendarId, m.externalId);
    await executor.delete(calendarSyncMappings).where(eq(calendarSyncMappings.id, m.id));
    result.pushed++;
  }

  // 2. Owner's entries not sourced from another connection.
  const entries = await executor
    .select()
    .from(calendarEntries)
    .where(and(eq(calendarEntries.ownerUserId, userId), isNull(calendarEntries.sourceConnectionId)));
  for (const entry of entries) {
    const normalized = toNormalized(entry);
    const fp = fingerprint(normalized);
    const mapping = byEntry.get(entry.id);
    if (!mapping) {
      const created = await adapter.createEvent(accessToken, calendarId, normalized, entry.icalUid);
      await executor.insert(calendarSyncMappings).values({ connectionId, entryId: entry.id, externalId: created.externalId, externalEtag: created.etag, lastSyncedFingerprint: fp, origin: "internal" });
      result.pushed++;
      continue;
    }
    if (mapping.lastSyncedFingerprint === fp) continue;
    if (mapping.externalDeletedAt) {
      const created = await adapter.createEvent(accessToken, calendarId, normalized, entry.icalUid);
      await executor.update(calendarSyncMappings).set({ externalId: created.externalId, externalEtag: created.etag, lastSyncedFingerprint: fp, externalDeletedAt: null }).where(eq(calendarSyncMappings.id, mapping.id));
    } else {
      const updated = await adapter.updateEvent(accessToken, calendarId, mapping.externalId, normalized);
      await executor.update(calendarSyncMappings).set({ externalEtag: updated.etag, lastSyncedFingerprint: fp }).where(eq(calendarSyncMappings.id, mapping.id));
    }
    result.pushed++;
  }

  // 3. Entries imported from THIS connection and edited internally (direction both) → push back.
  const imported = await executor
    .select()
    .from(calendarEntries)
    .where(and(eq(calendarEntries.ownerUserId, userId), eq(calendarEntries.sourceConnectionId, connectionId)));
  for (const entry of imported) {
    const mapping = byEntry.get(entry.id);
    if (!mapping || mapping.origin !== "external") continue;
    const normalized = toNormalized(entry);
    const fp = fingerprint(normalized);
    if (mapping.lastSyncedFingerprint === fp) continue;
    const updated = await adapter.updateEvent(accessToken, calendarId, mapping.externalId, normalized);
    await executor.update(calendarSyncMappings).set({ externalEtag: updated.etag, lastSyncedFingerprint: fp }).where(eq(calendarSyncMappings.id, mapping.id));
    result.pushed++;
  }
}
