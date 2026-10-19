import { z } from "zod";

/**
 * Agency members (2026-10-18). Pure rules, no IO: who may manage the team, which roles
 * can be granted, how an invitation token is evaluated.
 */
export type OrganizationRole = "owner" | "admin" | "manager" | "collaborator" | "contributor";

/** Roles an owner or admin can grant. `owner` is never transferable through this flow. */
export const INVITABLE_ROLES = ["admin", "manager"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export const ORGANIZATION_ROLE_LABELS: Record<OrganizationRole, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  manager: "Gestionnaire des fiches",
  collaborator: "Collaborateur",
  contributor: "Contributeur",
};

export const ORGANIZATION_ROLE_DESCRIPTIONS: Record<InvitableRole, string> = {
  admin: "Gère les fiches de l'agence et l'équipe (invitations, rôles, retraits).",
  manager: "Gère les fiches de l'agence, sans accès à l'équipe.",
};

/** Single-use invitation links stay valid this long. */
export const ORGANIZATION_INVITATION_TTL_DAYS = 7;
/** Invitations an agency may send per rolling 24 hours (abuse guard, e-mails cost reputation). */
export const ORGANIZATION_INVITATIONS_PER_DAY = 30;

export function canManageMembers(role: OrganizationRole | null): boolean {
  return role === "owner" || role === "admin";
}

/** The owner keeps their seat: they can neither be removed nor have their role changed. */
export function canEditMember(target: { role: OrganizationRole; isOrganizationOwner: boolean }): boolean {
  return target.role !== "owner" && !target.isOrganizationOwner;
}

export type OrganizationInvitationLike = { expiresAt: Date; acceptedAt: Date | null; revokedAt: Date | null };
export type OrganizationInvitationState = "valid" | "expired" | "revoked" | "used";

export function evaluateOrganizationInvitation(row: OrganizationInvitationLike, now: Date = new Date()): OrganizationInvitationState {
  if (row.revokedAt) return "revoked";
  if (row.acceptedAt) return "used";
  if (row.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}

export const inviteMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Adresse e-mail invalide." })),
  role: z.enum(INVITABLE_ROLES, { error: "Choisissez un rôle." }),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const changeMemberRoleSchema = z.object({
  memberId: z.uuid(),
  role: z.enum(INVITABLE_ROLES, { error: "Choisissez un rôle." }),
});
