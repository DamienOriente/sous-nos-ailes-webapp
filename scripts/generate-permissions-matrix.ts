import { writeFileSync } from "node:fs";
import {
  EVENT_PERMISSIONS,
  EVENT_ROLE_LABELS,
  EVENT_ROLE_PERMISSIONS,
  EVENT_ROLES,
  GLOBAL_PERMISSIONS,
  GLOBAL_ROLE_PERMISSIONS,
  CHILD_ASSIGNMENT_SCOPED,
  TRADE_PERMISSIONS,
  type GlobalRole,
} from "../src/modules/authorization/domain/permissions";

/**
 * Generates docs/rbac-permissions.md from the permission catalogue so the
 * documentation can never drift from the code. Run: pnpm exec tsx scripts/generate-permissions-matrix.ts
 */
const GLOBAL_ROLES: GlobalRole[] = ["user", "moderator", "admin", "super_admin"];
const yes = "✅";
const no = "·";

function eventMatrix(): string {
  const head = `| Permission | ${EVENT_ROLES.map((r) => EVENT_ROLE_LABELS[r]).join(" | ")} | Portée enfant |`;
  const sep = `|---|${EVENT_ROLES.map(() => ":---:").join("|")}|---|`;
  const rows = EVENT_PERMISSIONS.map((p) => {
    const cells = EVENT_ROLES.map((r) => (EVENT_ROLE_PERMISSIONS[r].includes(p) ? yes : no));
    const scope = CHILD_ASSIGNMENT_SCOPED.has(p) ? "enfants affectés seulement (hors organisateurs)" : "";
    return `| \`${p}\` | ${cells.join(" | ")} | ${scope} |`;
  });
  return [head, sep, ...rows].join("\n");
}

function tradeMatrix(): string {
  const rows = Object.entries(TRADE_PERMISSIONS).map(([slug, perms]) => `| \`${slug}\` | ${perms.map((p) => `\`${p}\``).join(", ")} |`);
  return ["| Métier (catégorie) | Permissions ajoutées aux rôles prestataire / personnel |", "|---|---|", ...rows].join("\n");
}

function globalMatrix(): string {
  const head = `| Permission | ${GLOBAL_ROLES.join(" | ")} |`;
  const sep = `|---|${GLOBAL_ROLES.map(() => ":---:").join("|")}|`;
  const rows = GLOBAL_PERMISSIONS.map((p) => `| \`${p}\` | ${GLOBAL_ROLES.map((r) => (GLOBAL_ROLE_PERMISSIONS[r].includes(p) ? yes : no)).join(" | ")} |`);
  return [head, sep, ...rows].join("\n");
}

const doc = `# Matrice des permissions (RBAC + ABAC)

> Généré par \`scripts/generate-permissions-matrix.ts\` depuis \`src/modules/authorization/domain/permissions.ts\` le ${new Date().toISOString().slice(0, 10)}. Ne pas éditer à la main : relancer \`pnpm exec tsx scripts/generate-permissions-matrix.ts\`.

## Principes

- **Deny by default** : une permission absente est refusée. Toute lecture/écriture d'une ressource privée passe par \`requireEventPermission\`, \`requireProfessionalManage\` ou \`requireGlobalPermission\` (\`src/modules/authorization\`).
- **Résolution d'une permission d'évènement** = permissions du rôle + extras du métier pratiqué (prestataire/personnel) + surcharges explicites (\`event_permissions\`, *deny* gagne toujours, expiration possible).
- **Anti-énumération** : un non-membre reçoit \`NotFoundError\` (même message qu'un identifiant inexistant) ; un membre sans la permission reçoit \`ForbiddenError\`.
- **Portée enfant** : pour les rôles non organisateurs, les permissions marquées « enfants affectés seulement » ne valent que pour les enfants assignés au membre (\`child_care_assignments\`), vérification faite par le service garde d'enfants.
- Les rôles d'évènement sont contextuels (par évènement). Les rôles globaux (\`users.role\`) ne donnent aucun droit implicite sur un évènement : un administrateur n'est pas membre des évènements ; l'accès de support passe par \`admin.break_glass\` (super_admin uniquement, journalisé).

## Permissions d'évènement par rôle

${eventMatrix()}

## Extras par métier (rôles prestataire et personnel)

${tradeMatrix()}

## Permissions globales (plateforme)

${globalMatrix()}

## Fiches professionnelles

| Accès | Propriétaire | Admin/owner d'organisation | Manager d'organisation | Membre d'organisation |
|---|:---:|:---:|:---:|:---:|
| Gérer la fiche (\`requireProfessionalManage\`) | ${yes} | ${yes} | ${yes} | ${no} (lecture seule) |
`;

writeFileSync(new URL("../docs/rbac-permissions.md", import.meta.url), doc);
process.stdout.write(`docs/rbac-permissions.md written (${EVENT_PERMISSIONS.length} event permissions, ${GLOBAL_PERMISSIONS.length} global permissions)\n`);
