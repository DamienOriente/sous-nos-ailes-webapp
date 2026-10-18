import type { EventAccess } from "@/modules/authorization";
import type { EventNavItem } from "@/components/events/event-nav";

const MUSIC_TRADES = new Set(["dj", "musicien"]);
const EQUIPMENT_TRADES = new Set(["dj", "musicien", "location-materiel", "location-mobilier", "location-photobooth", "magicien", "animateur"]);
const IMAGE_TRADES = new Set(["photographe", "videaste"]);

/** Navigation filtered by the member's effective permissions (rendering is never the enforcement point: pages re-check). */
export function buildEventNav(eventId: string, access: EventAccess): EventNavItem[] {
  const base = `/app/evenements/${eventId}`;
  const has = (p: Parameters<EventAccess["permissions"]["has"]>[0]) => access.permissions.has(p);
  const items: EventNavItem[] = [];
  if (has("event.view")) items.push({ href: base, label: "Tableau de bord", exact: true });
  if (has("event.tasks.view")) items.push({ href: `${base}/taches`, label: "Tâches" });
  if (has("event.milestones.view")) items.push({ href: `${base}/planning`, label: "Planning" });
  if (has("event.providers.view")) items.push({ href: `${base}/prestataires`, label: "Prestataires" });
  if (has("event.inquiries.view")) items.push({ href: `${base}/brief`, label: "Brief" });
  if (has("event.inquiries.view")) items.push({ href: `${base}/devis`, label: "Devis" });
  if (has("event.budget.view")) items.push({ href: `${base}/budget`, label: "Budget" });
  if (has("event.guests.view")) items.push({ href: `${base}/invites`, label: "Invités" });
  if (has("event.invitations.manage")) items.push({ href: `${base}/invitations`, label: "Invitations" });
  if (has("event.seating.view")) items.push({ href: `${base}/plan-de-table`, label: "Plan de table" });
  if (has("event.invitations.checkin")) items.push({ href: `${base}/checkin`, label: "Contrôle d'accès" });
  if (has("children.view_roster")) items.push({ href: `${base}/enfants`, label: "Enfants" });
  const slug = access.categorySlug;
  if (has("catering.view_dietary_counts")) items.push({ href: `${base}/traiteur`, label: "Traiteur", group: "tools" });
  if (has("venue.view_logistics")) items.push({ href: `${base}/lieu`, label: "Lieu", group: "tools" });
  if (access.isOrganizer || (slug && MUSIC_TRADES.has(slug))) items.push({ href: `${base}/musique`, label: "Brief musical", group: "tools" });
  if (access.isOrganizer || (slug && EQUIPMENT_TRADES.has(slug))) items.push({ href: `${base}/materiel`, label: "Matériel", group: "tools" });
  if (access.isOrganizer || (slug && IMAGE_TRADES.has(slug))) items.push({ href: `${base}/images`, label: "Images", group: "tools" });
  if (has("event.documents.view")) items.push({ href: `${base}/documents`, label: "Documents" });
  items.push({ href: `${base}/messages`, label: "Messages" });
  if (has("event.members.view")) items.push({ href: `${base}/equipe`, label: "Équipe" });
  if (has("event.inquiries.view")) items.push({ href: `${base}/demandes`, label: "Demandes" });
  if (has("event.edit")) items.push({ href: `${base}/parametres`, label: "Paramètres" });
  return items;
}
