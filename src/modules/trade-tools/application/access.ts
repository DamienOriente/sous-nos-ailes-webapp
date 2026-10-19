import { db, type DbExecutor } from "@/db/client";
import { NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { requireEventMember, type EventAccess } from "@/modules/authorization";

/**
 * Trade tools access matrix. Organisers (ORGANIZER_ROLES) read and write
 * every tool. A provider/staff member reads and writes the tool of their own
 * trade. Anyone else gets NotFound (anti-enumeration), like any private
 * resource.
 *
 * | tool      | permission / trade                                   |
 * | catering  | catering.view_dietary_counts (traiteur, patissier)    |
 * | venue     | venue.view_logistics (domaine, salle, hébergement)   |
 * | music     | trade dj / musicien                                  |
 * | equipment | any provider or staff (own lines), organisers (all)  |
 * | images    | trade photographe / videaste                         |
 */
export const TRADE_TOOLS = ["catering", "venue", "music", "equipment", "images"] as const;
export type TradeTool = (typeof TRADE_TOOLS)[number];

const TRADE_SLUGS: Record<Exclude<TradeTool, "catering" | "venue" | "equipment">, readonly string[]> = {
  music: ["dj", "musicien"],
  images: ["photographe", "videaste"],
};

export type TradeToolAccess = { access: EventAccess; canEdit: boolean; isTradeProvider: boolean };

export async function requireTradeToolAccess(actor: Actor, eventId: string, tool: TradeTool, executor: DbExecutor = db): Promise<TradeToolAccess> {
  const access = await requireEventMember(actor, eventId, executor);
  if (access.isOrganizer) return { access, canEdit: true, isTradeProvider: false };
  const isProviderRole = access.role === "provider" || access.role === "staff";
  let allowed = false;
  switch (tool) {
    case "catering":
      allowed = access.permissions.has("catering.view_dietary_counts");
      break;
    case "venue":
      allowed = access.permissions.has("venue.view_logistics");
      break;
    case "equipment":
      allowed = isProviderRole;
      break;
    default:
      allowed = isProviderRole && Boolean(access.categorySlug) && TRADE_SLUGS[tool].includes(access.categorySlug!);
  }
  if (!allowed) throw new NotFoundError();
  return { access, canEdit: true, isTradeProvider: true };
}

/** Which tools the member may open (for the workspace navigation). Pure given an access. */
export function availableTradeTools(access: EventAccess): TradeTool[] {
  if (access.isOrganizer) return [...TRADE_TOOLS];
  const isProviderRole = access.role === "provider" || access.role === "staff";
  const out: TradeTool[] = [];
  if (access.permissions.has("catering.view_dietary_counts")) out.push("catering");
  if (access.permissions.has("venue.view_logistics")) out.push("venue");
  if (isProviderRole && access.categorySlug && TRADE_SLUGS.music.includes(access.categorySlug)) out.push("music");
  if (isProviderRole) out.push("equipment");
  if (isProviderRole && access.categorySlug && TRADE_SLUGS.images.includes(access.categorySlug)) out.push("images");
  return out;
}
