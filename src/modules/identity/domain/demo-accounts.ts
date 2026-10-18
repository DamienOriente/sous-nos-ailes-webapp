import { DEMO_USERS, type DemoUserKey } from "@/db/seed/context";

export type DemoAccountGroup = "organizer" | "professional" | "staff";

export type DemoAccount = {
  key: DemoUserKey;
  name: string;
  email: string;
  group: DemoAccountGroup;
  /** What this account shows in the demo, in one short line. */
  role: string;
  /** Where the account lands after a one-click sign-in. */
  landing: string;
};

const ROLES: Record<DemoUserKey, { group: DemoAccountGroup; role: string; landing: string }> = {
  louis: { group: "organizer", role: "Organise le mariage de démonstration", landing: "/app" },
  lisa: { group: "organizer", role: "Coorganisatrice du mariage", landing: "/app" },
  paul: { group: "organizer", role: "Autre organisateur, offre gratuite", landing: "/app" },
  camille: { group: "professional", role: "Wedding planner", landing: "/app/pro" },
  marie: { group: "professional", role: "Garde d'enfants, responsable", landing: "/app/pro" },
  nora: { group: "professional", role: "Garde d'enfants, intervenante", landing: "/app" },
  julien: { group: "professional", role: "Traiteur", landing: "/app/pro" },
  helene: { group: "professional", role: "Lieu de réception", landing: "/app/pro" },
  theo: { group: "professional", role: "DJ, offre gratuite", landing: "/app/pro" },
  ines: { group: "professional", role: "Photographe", landing: "/app/pro" },
  sofia: { group: "professional", role: "Animation enfants", landing: "/app/pro" },
  moderator: { group: "staff", role: "Modération des fiches et des avis", landing: "/admin" },
  admin: { group: "staff", role: "Administration", landing: "/admin" },
  superadmin: { group: "staff", role: "Super administration", landing: "/admin" },
};

export const DEMO_ACCOUNTS: readonly DemoAccount[] = DEMO_USERS.map((u) => ({ key: u.key, name: u.name, email: u.email, ...ROLES[u.key] }));

export const DEMO_GROUP_LABELS: Record<DemoAccountGroup, string> = {
  organizer: "Organisateurs",
  professional: "Professionnels",
  staff: "Équipe Sous Nos Ailes",
};

export function findDemoAccount(key: string): DemoAccount | null {
  return DEMO_ACCOUNTS.find((a) => a.key === key) ?? null;
}
