/**
 * Permission catalogue. Every server-side check names one of these keys.
 * Keep this file free of IO: it is imported by the UI to decide what to render,
 * but rendering is never the enforcement point.
 */
export const EVENT_PERMISSIONS = [
  "event.view",
  "event.edit",
  "event.delete",
  "event.members.view",
  "event.members.manage",
  "event.permissions.manage",
  "event.tasks.view",
  "event.tasks.manage",
  "event.milestones.view",
  "event.milestones.manage",
  "event.budget.view",
  "event.budget.manage",
  "event.documents.view",
  "event.documents.manage",
  "event.guests.view",
  "event.guests.manage",
  "event.invitations.manage",
  "event.invitations.checkin",
  "event.seating.view",
  "event.seating.manage",
  "event.providers.view",
  "event.providers.manage",
  "event.channels.view_all",
  "event.channels.post",
  "event.channels.manage",
  "event.inquiries.view",
  // Children — the sensitive area. Roster = names/ages/guardian; sensitive = health data.
  "children.view_roster",
  "children.manage",
  "children.view_sensitive",
  "children.record_attendance",
  "children.handover",
  "children.assign_staff",
  "children.view_access_logs",
  // Trade data scopes
  "catering.view_dietary_counts",
  "venue.view_logistics",
] as const;

export type EventPermission = (typeof EVENT_PERMISSIONS)[number];

export const EVENT_ROLES = ["owner", "lead_organizer", "co_organizer", "wedding_planner", "provider", "collaborator", "staff", "guest"] as const;
export type EventRole = (typeof EVENT_ROLES)[number];

export const EVENT_ROLE_LABELS: Record<EventRole, string> = {
  owner: "Propriétaire",
  lead_organizer: "Organisateur principal",
  co_organizer: "Coorganisateur",
  wedding_planner: "Wedding planner",
  provider: "Prestataire",
  collaborator: "Collaborateur",
  staff: "Personnel opérationnel",
  guest: "Invité",
};

const ORGANIZER_BASE: EventPermission[] = [
  "event.view",
  "event.edit",
  "event.members.view",
  "event.members.manage",
  "event.tasks.view",
  "event.tasks.manage",
  "event.milestones.view",
  "event.milestones.manage",
  "event.budget.view",
  "event.budget.manage",
  "event.documents.view",
  "event.documents.manage",
  "event.guests.view",
  "event.guests.manage",
  "event.invitations.manage",
  "event.invitations.checkin",
  "event.seating.view",
  "event.seating.manage",
  "event.providers.view",
  "event.providers.manage",
  "event.channels.view_all",
  "event.channels.post",
  "event.channels.manage",
  "event.inquiries.view",
  "children.view_roster",
  "children.manage",
  "children.assign_staff",
  "catering.view_dietary_counts",
  "venue.view_logistics",
];

/**
 * Default permissions by role. Explicit grants/denies in event_permissions
 * refine these (deny always wins). Note: health data ("children.view_sensitive")
 * is granted by default only to the owner (who registers the children) and to
 * the childcare team for the children assigned to them (ABAC rule in the
 * childcare service). Wedding planners and co-organisers need an explicit grant.
 */
export const EVENT_ROLE_PERMISSIONS: Record<EventRole, readonly EventPermission[]> = {
  owner: [...ORGANIZER_BASE, "event.delete", "event.permissions.manage", "children.view_sensitive", "children.view_access_logs", "children.record_attendance", "children.handover"],
  lead_organizer: [...ORGANIZER_BASE, "event.permissions.manage", "children.view_access_logs"],
  co_organizer: ORGANIZER_BASE.filter((p) => p !== "event.members.manage" && p !== "children.assign_staff"),
  wedding_planner: [...ORGANIZER_BASE, "event.permissions.manage"],
  provider: ["event.view", "event.members.view", "event.milestones.view", "event.tasks.view", "event.channels.post", "event.documents.view", "event.providers.view"],
  collaborator: ["event.view", "event.members.view", "event.tasks.view", "event.tasks.manage", "event.milestones.view", "event.channels.post", "event.documents.view"],
  staff: ["event.view", "event.members.view", "event.milestones.view", "event.channels.post"],
  guest: ["event.view"],
};

/** Extra permissions granted to providers/staff depending on the trade they practise in the event. */
export const TRADE_PERMISSIONS: Record<string, readonly EventPermission[]> = {
  "garde-enfants-evenementielle": ["children.view_roster", "children.record_attendance", "children.handover", "children.view_sensitive"],
  "baby-sitting": ["children.view_roster", "children.record_attendance", "children.handover", "children.view_sensitive"],
  "animation-enfants": ["children.view_roster", "children.record_attendance"],
  traiteur: ["catering.view_dietary_counts", "event.guests.view"],
  patissier: ["catering.view_dietary_counts"],
  "domaine-reception": ["venue.view_logistics", "event.guests.view", "event.seating.view", "event.providers.view"],
  "salle-evenementielle": ["venue.view_logistics", "event.guests.view", "event.seating.view", "event.providers.view"],
  "wedding-planner": ORGANIZER_BASE,
  dj: ["event.milestones.view"],
  photographe: ["event.milestones.view", "event.guests.view"],
  videaste: ["event.milestones.view", "event.guests.view"],
};

/**
 * Permissions a childcare provider/staff member only holds for the children
 * assigned to them (not the whole roster). Enforced by the childcare service.
 */
export const CHILD_ASSIGNMENT_SCOPED: ReadonlySet<EventPermission> = new Set(["children.view_sensitive", "children.record_attendance", "children.handover"]);

export const ORGANIZER_ROLES: ReadonlySet<EventRole> = new Set(["owner", "lead_organizer", "co_organizer", "wedding_planner"]);

// ── Global (platform) permissions ───────────────────────────────────────────
export const GLOBAL_PERMISSIONS = [
  "admin.dashboard",
  "admin.users.view",
  "admin.users.manage",
  "admin.roles.manage",
  "moderation.queue",
  "moderation.decide",
  "moderation.documents.view",
  "admin.categories.manage",
  "admin.tools.manage",
  "admin.plans.manage",
  "admin.content.manage",
  "admin.settings.manage",
  "admin.billing.view",
  "admin.security.view",
  "admin.break_glass",
] as const;
export type GlobalPermission = (typeof GLOBAL_PERMISSIONS)[number];
export type GlobalRole = "user" | "moderator" | "admin" | "super_admin";

export const GLOBAL_ROLE_PERMISSIONS: Record<GlobalRole, readonly GlobalPermission[]> = {
  user: [],
  moderator: ["admin.dashboard", "moderation.queue", "moderation.decide", "moderation.documents.view", "admin.users.view"],
  admin: [
    "admin.dashboard",
    "admin.users.view",
    "admin.users.manage",
    "moderation.queue",
    "moderation.decide",
    "moderation.documents.view",
    "admin.categories.manage",
    "admin.tools.manage",
    "admin.plans.manage",
    "admin.content.manage",
    "admin.settings.manage",
    "admin.billing.view",
    "admin.security.view",
  ],
  super_admin: [...GLOBAL_PERMISSIONS],
};

export function hasGlobalPermission(role: GlobalRole, permission: GlobalPermission): boolean {
  return GLOBAL_ROLE_PERMISSIONS[role].includes(permission);
}

export type PermissionEffect = "allow" | "deny";

/**
 * Pure resolution: role defaults + trade extras + explicit overrides.
 * Returns the effective set for a member.
 */
export function resolveEventPermissions(input: {
  role: EventRole;
  categorySlug: string | null;
  overrides: ReadonlyArray<{ permission: string; effect: PermissionEffect; expiresAt: Date | null }>;
  now?: Date;
}): Set<EventPermission> {
  const now = input.now ?? new Date();
  const set = new Set<EventPermission>(EVENT_ROLE_PERMISSIONS[input.role]);
  if (input.categorySlug && (input.role === "provider" || input.role === "staff")) {
    for (const p of TRADE_PERMISSIONS[input.categorySlug] ?? []) set.add(p);
  }
  const active = input.overrides.filter((o) => !o.expiresAt || o.expiresAt > now);
  for (const o of active) if (o.effect === "allow" && (EVENT_PERMISSIONS as readonly string[]).includes(o.permission)) set.add(o.permission as EventPermission);
  for (const o of active) if (o.effect === "deny") set.delete(o.permission as EventPermission);
  return set;
}
