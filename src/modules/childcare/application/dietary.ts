import { and, eq, isNull } from "drizzle-orm";
import { db, type DbExecutor } from "@/db/client";
import { eventChildren, eventGuests } from "@/db/schema";
import type { Actor } from "@/lib/session";
import { requireEventPermission } from "@/modules/authorization";
import { aggregateDietary } from "@/modules/childcare/domain/rules";

/**
 * Anonymous dietary counts for the caterer: accepted guests + registered
 * children, grouped by preference. No name ever leaves this function and
 * health data (allergies) is NOT part of it — the caterer asks the care team.
 */
export async function getDietaryCounts(actor: Actor, eventId: string, executor: DbExecutor = db) {
  await requireEventPermission(actor, eventId, "catering.view_dietary_counts", executor);
  const guests = await executor
    .select({ preference: eventGuests.dietaryPreference, isChild: eventGuests.isChild })
    .from(eventGuests)
    .where(and(eq(eventGuests.eventId, eventId), eq(eventGuests.rsvpStatus, "accepted")));
  const children = await executor
    .select({ preference: eventChildren.dietaryPreference })
    .from(eventChildren)
    .where(and(eq(eventChildren.eventId, eventId), isNull(eventChildren.anonymizedAt)));
  const rows = [...guests.map((g) => ({ preference: g.preference, isChild: g.isChild })), ...children.map((c) => ({ preference: c.preference, isChild: true }))];
  return { rows: aggregateDietary(rows), adults: guests.filter((g) => !g.isChild).length, children: guests.filter((g) => g.isChild).length + children.length };
}
