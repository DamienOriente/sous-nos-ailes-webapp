# Matrice des permissions (RBAC + ABAC)

> Généré par `scripts/generate-permissions-matrix.ts` depuis `src/modules/authorization/domain/permissions.ts` le 2026-10-17. Ne pas éditer à la main : relancer `pnpm exec tsx scripts/generate-permissions-matrix.ts`.

## Principes

- **Deny by default** : une permission absente est refusée. Toute lecture/écriture d'une ressource privée passe par `requireEventPermission`, `requireProfessionalManage` ou `requireGlobalPermission` (`src/modules/authorization`).
- **Résolution d'une permission d'évènement** = permissions du rôle + extras du métier pratiqué (prestataire/personnel) + surcharges explicites (`event_permissions`, *deny* gagne toujours, expiration possible).
- **Anti-énumération** : un non-membre reçoit `NotFoundError` (même message qu'un identifiant inexistant) ; un membre sans la permission reçoit `ForbiddenError`.
- **Portée enfant** : pour les rôles non organisateurs, les permissions marquées « enfants affectés seulement » ne valent que pour les enfants assignés au membre (`child_care_assignments`), vérification faite par le service garde d'enfants.
- Les rôles d'évènement sont contextuels (par évènement). Les rôles globaux (`users.role`) ne donnent aucun droit implicite sur un évènement : un administrateur n'est pas membre des évènements ; l'accès de support passe par `admin.break_glass` (super_admin uniquement, journalisé).

## Permissions d'évènement par rôle

| Permission | Propriétaire | Organisateur principal | Coorganisateur | Wedding planner | Prestataire | Collaborateur | Personnel opérationnel | Invité | Portée enfant |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| `event.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |  |
| `event.edit` | ✅ | ✅ | ✅ | ✅ | · | · | · | · |  |
| `event.delete` | ✅ | · | · | · | · | · | · | · |  |
| `event.members.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | · |  |
| `event.members.manage` | ✅ | ✅ | · | ✅ | · | · | · | · |  |
| `event.permissions.manage` | ✅ | ✅ | · | ✅ | · | · | · | · |  |
| `event.tasks.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | · | · |  |
| `event.tasks.manage` | ✅ | ✅ | ✅ | ✅ | · | ✅ | · | · |  |
| `event.milestones.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | · |  |
| `event.milestones.manage` | ✅ | ✅ | ✅ | ✅ | · | · | · | · |  |
| `event.budget.view` | ✅ | ✅ | ✅ | ✅ | · | · | · | · |  |
| `event.budget.manage` | ✅ | ✅ | ✅ | ✅ | · | · | · | · |  |
| `event.documents.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | · | · |  |
| `event.documents.manage` | ✅ | ✅ | ✅ | ✅ | · | · | · | · |  |
| `event.guests.view` | ✅ | ✅ | ✅ | ✅ | · | · | · | · |  |
| `event.guests.manage` | ✅ | ✅ | ✅ | ✅ | · | · | · | · |  |
| `event.invitations.manage` | ✅ | ✅ | ✅ | ✅ | · | · | · | · |  |
| `event.invitations.checkin` | ✅ | ✅ | ✅ | ✅ | · | · | · | · |  |
| `event.seating.view` | ✅ | ✅ | ✅ | ✅ | · | · | · | · |  |
| `event.seating.manage` | ✅ | ✅ | ✅ | ✅ | · | · | · | · |  |
| `event.providers.view` | ✅ | ✅ | ✅ | ✅ | ✅ | · | · | · |  |
| `event.providers.manage` | ✅ | ✅ | ✅ | ✅ | · | · | · | · |  |
| `event.channels.view_all` | ✅ | ✅ | ✅ | ✅ | · | · | · | · |  |
| `event.channels.post` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | · |  |
| `event.channels.manage` | ✅ | ✅ | ✅ | ✅ | · | · | · | · |  |
| `event.inquiries.view` | ✅ | ✅ | ✅ | ✅ | · | · | · | · |  |
| `children.view_roster` | ✅ | ✅ | ✅ | ✅ | · | · | · | · |  |
| `children.manage` | ✅ | ✅ | ✅ | ✅ | · | · | · | · |  |
| `children.view_sensitive` | ✅ | · | · | · | · | · | · | · | enfants affectés seulement (hors organisateurs) |
| `children.record_attendance` | ✅ | · | · | · | · | · | · | · | enfants affectés seulement (hors organisateurs) |
| `children.handover` | ✅ | · | · | · | · | · | · | · | enfants affectés seulement (hors organisateurs) |
| `children.assign_staff` | ✅ | ✅ | · | ✅ | · | · | · | · |  |
| `children.view_access_logs` | ✅ | ✅ | · | · | · | · | · | · |  |
| `catering.view_dietary_counts` | ✅ | ✅ | ✅ | ✅ | · | · | · | · |  |
| `venue.view_logistics` | ✅ | ✅ | ✅ | ✅ | · | · | · | · |  |

## Extras par métier (rôles prestataire et personnel)

| Métier (catégorie) | Permissions ajoutées aux rôles prestataire / personnel |
|---|---|
| `garde-enfants-evenementielle` | `children.view_roster`, `children.record_attendance`, `children.handover`, `children.view_sensitive` |
| `baby-sitting` | `children.view_roster`, `children.record_attendance`, `children.handover`, `children.view_sensitive` |
| `animation-enfants` | `children.view_roster`, `children.record_attendance` |
| `traiteur` | `catering.view_dietary_counts`, `event.guests.view` |
| `patissier` | `catering.view_dietary_counts` |
| `domaine-reception` | `venue.view_logistics`, `event.guests.view`, `event.seating.view`, `event.providers.view` |
| `salle-evenementielle` | `venue.view_logistics`, `event.guests.view`, `event.seating.view`, `event.providers.view` |
| `wedding-planner` | `event.view`, `event.edit`, `event.members.view`, `event.members.manage`, `event.tasks.view`, `event.tasks.manage`, `event.milestones.view`, `event.milestones.manage`, `event.budget.view`, `event.budget.manage`, `event.documents.view`, `event.documents.manage`, `event.guests.view`, `event.guests.manage`, `event.invitations.manage`, `event.invitations.checkin`, `event.seating.view`, `event.seating.manage`, `event.providers.view`, `event.providers.manage`, `event.channels.view_all`, `event.channels.post`, `event.channels.manage`, `event.inquiries.view`, `children.view_roster`, `children.manage`, `children.assign_staff`, `catering.view_dietary_counts`, `venue.view_logistics` |
| `dj` | `event.milestones.view` |
| `photographe` | `event.milestones.view`, `event.guests.view` |
| `videaste` | `event.milestones.view`, `event.guests.view` |

## Permissions globales (plateforme)

| Permission | user | moderator | admin | super_admin |
|---|:---:|:---:|:---:|:---:|
| `admin.dashboard` | · | ✅ | ✅ | ✅ |
| `admin.users.view` | · | ✅ | ✅ | ✅ |
| `admin.users.manage` | · | · | ✅ | ✅ |
| `admin.roles.manage` | · | · | · | ✅ |
| `moderation.queue` | · | ✅ | ✅ | ✅ |
| `moderation.decide` | · | ✅ | ✅ | ✅ |
| `moderation.documents.view` | · | ✅ | ✅ | ✅ |
| `admin.categories.manage` | · | · | ✅ | ✅ |
| `admin.tools.manage` | · | · | ✅ | ✅ |
| `admin.plans.manage` | · | · | ✅ | ✅ |
| `admin.content.manage` | · | · | ✅ | ✅ |
| `admin.settings.manage` | · | · | ✅ | ✅ |
| `admin.billing.view` | · | · | ✅ | ✅ |
| `admin.security.view` | · | · | ✅ | ✅ |
| `admin.break_glass` | · | · | · | ✅ |

## Fiches professionnelles

| Accès | Propriétaire | Admin/owner d'organisation | Manager d'organisation | Membre d'organisation |
|---|:---:|:---:|:---:|:---:|
| Gérer la fiche (`requireProfessionalManage`) | ✅ | ✅ | ✅ | · (lecture seule) |
