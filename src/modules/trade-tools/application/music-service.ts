import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, type DbExecutor } from "@/db/client";
import { musicBriefs, musicKeyMoments } from "@/db/schema";
import type { Actor } from "@/lib/session";
import { requireTradeToolAccess } from "./access";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal("")).transform((v) => (v ? v : null));

export const musicBriefSchema = z.object({
  preferences: optionalText(4000),
  forbidden: optionalText(4000),
  playlistText: optionalText(10_000),
  technicalNeeds: optionalText(4000),
  installationNotes: optionalText(4000),
});

export const keyMomentSchema = z.object({
  title: z.string().trim().min(1).max(160),
  songTitle: optionalText(200),
  artist: optionalText(200),
  startsAt: z.coerce.date().optional().nullable(),
  notes: optionalText(1000),
});

export async function getMusicOverview(actor: Actor, eventId: string, executor: DbExecutor = db) {
  const tool = await requireTradeToolAccess(actor, eventId, "music", executor);
  const [brief] = await executor.select().from(musicBriefs).where(eq(musicBriefs.eventId, eventId)).limit(1);
  const moments = await executor.select().from(musicKeyMoments).where(eq(musicKeyMoments.eventId, eventId)).orderBy(asc(musicKeyMoments.startsAt), asc(musicKeyMoments.sortOrder));
  return { tool, brief: brief ?? null, moments };
}

export async function upsertMusicBrief(actor: Actor, eventId: string, input: z.infer<typeof musicBriefSchema>, executor: DbExecutor = db) {
  await requireTradeToolAccess(actor, eventId, "music", executor);
  const values = { ...input, eventId, updatedByUserId: actor.userId };
  await executor.insert(musicBriefs).values(values).onConflictDoUpdate({ target: musicBriefs.eventId, set: values });
}

export async function addKeyMoment(actor: Actor, eventId: string, input: z.infer<typeof keyMomentSchema>, executor: DbExecutor = db) {
  await requireTradeToolAccess(actor, eventId, "music", executor);
  await executor.insert(musicKeyMoments).values({ ...input, eventId });
}

export async function deleteKeyMoment(actor: Actor, eventId: string, momentId: string, executor: DbExecutor = db) {
  await requireTradeToolAccess(actor, eventId, "music", executor);
  await executor.delete(musicKeyMoments).where(and(eq(musicKeyMoments.id, momentId), eq(musicKeyMoments.eventId, eventId)));
}
