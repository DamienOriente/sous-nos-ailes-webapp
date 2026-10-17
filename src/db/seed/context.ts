import type { Db } from "@/db/client";

/**
 * Shared state between seed modules. Core seed fills users/categories/plans/
 * tools; module seeds (events, professionals, ...) add their own ids so later
 * seeds can reference them.
 */
export type SeedContext = {
  db: Db;
  now: Date;
  users: Record<string, string>; // key → user id
  categories: Record<string, string>; // slug → id
  plans: Record<string, string>; // key → id
  professionals: Record<string, string>; // key → id
  events: Record<string, string>; // key → id
  members: Record<string, string>; // `${eventKey}:${userKey}` → member id
};

/** Shared demo password. Only used when DEMO_MODE is on; documented in README. */
export const DEMO_PASSWORD = "Demo-SousNosAiles-2026!";

export const DEMO_USERS = [
  { key: "louis", name: "Louis Marchand", email: "louis@sousnosailes.test", role: "user", intent: "organizer" },
  { key: "lisa", name: "Lisa Marchand", email: "lisa@sousnosailes.test", role: "user", intent: "organizer" },
  { key: "camille", name: "Camille Ferrand", email: "camille.planner@sousnosailes.test", role: "user", intent: "professional" }, // wedding planner
  { key: "marie", name: "Marie Delcourt", email: "marie.garde@sousnosailes.test", role: "user", intent: "professional" }, // childcare
  { key: "nora", name: "Nora Benali", email: "nora.nounou@sousnosailes.test", role: "user", intent: "professional" }, // childcare staff
  { key: "julien", name: "Julien Rossi", email: "julien.traiteur@sousnosailes.test", role: "user", intent: "professional" }, // caterer
  { key: "helene", name: "Hélène Vasseur", email: "helene.domaine@sousnosailes.test", role: "user", intent: "professional" }, // venue
  { key: "theo", name: "Théo Lambert", email: "theo.dj@sousnosailes.test", role: "user", intent: "professional" }, // dj
  { key: "ines", name: "Inès Garnier", email: "ines.photo@sousnosailes.test", role: "user", intent: "professional" }, // photographer
  { key: "paul", name: "Paul Nguyen", email: "paul@sousnosailes.test", role: "user", intent: "organizer" }, // second organizer (isolation tests)
  { key: "sofia", name: "Sofia Martins", email: "sofia.anim@sousnosailes.test", role: "user", intent: "professional" }, // animation, second event provider
  { key: "moderator", name: "Modération SNA", email: "moderateur@sousnosailes.test", role: "moderator", intent: "organizer" },
  { key: "admin", name: "Administration SNA", email: "admin@sousnosailes.test", role: "admin", intent: "organizer" },
  { key: "superadmin", name: "Super Admin SNA", email: "superadmin@sousnosailes.test", role: "super_admin", intent: "organizer" },
] as const;

export type DemoUserKey = (typeof DEMO_USERS)[number]["key"];
