# Administration et modération

Routes `/admin/*` (layout partagé : navigation, garde `admin.dashboard`). Chaque page appelle `requireAdminPage(permission, path)` (`src/app/admin/_lib/admin-page.ts`) : authentification, permission globale (`GLOBAL_ROLE_PERMISSIONS`, deny by default — un modérateur sur une page admin est renvoyé vers `/admin`) et exigence 2FA.

## Exigence 2FA pour les rôles privilégiés

`checkPrivilegedTwoFactor(actor)` (`modules/admin/application/privileged-guard.ts`) : si `users.two_factor_enabled` est faux pour `moderator | admin | super_admin` :

- `APP_ENV=production` → redirection vers `/app/compte/securite?required=2fa` ;
- local/demo → bannière d'avertissement persistante (`<TwoFactorBanner />`) sur chaque page admin, sinon les comptes de démonstration seraient inutilisables.

## Séparation des responsabilités

| Rôle | Permissions |
|---|---|
| `moderator` | tableau de bord, file de modération, décisions, justificatifs, lecture des utilisateurs |
| `admin` | + gestion des utilisateurs (suspension), catégories, outils, offres, contenus, paramètres, facturation, sécurité |
| `super_admin` | + `admin.roles.manage` (rôles globaux) et `admin.break_glass` |

Les administrateurs n'ont **aucun accès** au contenu des évènements (invités, enfants, messages). Exceptions : le message signalé (lecture de ce seul message, `getReportedMessage`) et le break-glass.

### Break-glass (`modules/admin/application/break-glass.ts`)

Super admin uniquement. Formulaire : identifiant d'évènement, **motif juridique** (≥ 20 caractères, conservé dans l'audit), durée ≤ 4 h, droits choisis parmi une liste fermée. Mécanisme : membre `collaborator` titré « Assistance exceptionnelle » + grants explicites `event_permissions` avec `expires_at` (+ deny des droits par défaut du rôle collaborateur), audit `admin.break_glass`, évènement de sécurité `critical`, notification e-mail au propriétaire de l'évènement. Le module autorisation ignore les grants expirés ; `revokeExpiredBreakGlass()` révoque ensuite le membre — **à appeler depuis le worker** (job rétention quotidien ou toutes les heures). Révocation manuelle immédiate possible.

## Modération

- File (`/admin/moderation`) : cas `open | in_review`, filtres type/assignation. `openModerationCase` est idempotent par (kind, resource) ouvert.
- Détail : fiche pro complète en lecture, versions de page (soumise / publiée), justificatifs (`moderation.documents.view`, `privateFileHref`), vérifications par `kind` avec **statement obligatoire** (≥ 15 caractères), documents conformes/non conformes, assignation, historique.
- Décisions (`decideCase`) : `approve` (→ `published`, version soumise approuvée et publiée, précédente `superseded`), `request_changes` (→ `changes_requested`, version soumise rejetée avec note, **la version publiée reste visible**), `reject`, `suspend`, `reinstate`, `dismiss`, `escalate`, `note` (interne). Motif ≥ 10 caractères, « ok »/« approuvé » refusés. Transaction unique : décision + statut (`setListingStatusAsModerator` du module professionnels, qui notifie `profile_approved | changes_requested | profile_rejected` et audite) + version de page.
- Niveau de vérification : `computeVerificationLevel` (module professionnels) — 1 identité, 2 immatriculation ou contrôle administratif, 3 justificatifs examinés, 4 assurance vérifiée, 5 qualifications vérifiées ; recalculé par `setVerification`.
- Avis (`/admin/moderation/avis`) : publier / masquer / refuser avec motif, note de modération, notification à l'auteur, recalcul de la note moyenne.
- Signalements (`/admin/signalements`) : contrat `fileReport(...)` pour les autres modules ; liaison à un cas ; réponse motivée au signalant (notification si compte). Recours (`fileAppeal`, `decideAppeal`) : l'acceptation ne renverse pas silencieusement la décision — elle rouvre le cas pour une nouvelle décision motivée.

## Utilisateurs

Recherche e-mail/nom ; fiche : rôle, 2FA, sessions (révocation unitaire/globale), fiches pro, évènements (noms et rôles uniquement), historique de modération, recours, audit. Suspension/réactivation via `auth.api.banUser / unbanUser` (motif obligatoire, durée optionnelle, sessions révoquées, audit + évènement de sécurité). Rôle global : super admin seulement, pas de promotion en `super_admin` depuis l'interface, impossible de rétrograder le dernier super admin.

## Catalogue, offres, contenus, paramètres, sécurité

- Catégories : CRUD complet ; désactivation = masquage (jamais de suppression si des fiches l'utilisent). Outils : CRUD + usage agrégé (`professional_tool_activations`).
- Offres : plans, matrice fonctionnalités/limites, codes promo, placements sponsorisés (éligibilité vérifiée), liste des abonnements, journal des évènements de facturation. Voir `docs/billing.md`.
- Contenus : pages éditoriales en Markdown restreint (titres `##`/`###`, listes, liens `https:`/`mailto:`/internes, gras/italique, encadrés `>`), validation serveur (aucun HTML, variables `{{legal.*}}` / `{{retention.*}}` seulement), aperçu avec les variables courantes, brouillon/publié. Le rendu public et les textes par défaut viennent du module `legal`.
- Paramètres : variables légales, rétention, `billing.live_enabled`, `sponsored.max_per_query`, `moderation.require_review_on_major_update` ; `INDEXING_ENABLED`, `DEMO_MODE`, Stripe en lecture seule.
- Sécurité : audit filtrable (acteur, action, ressource, dates) + export CSV (audité), évènements de sécurité, sessions actives, files BullMQ (`@/workers/health`), break-glass.

## Données de démonstration

`src/db/seed/billing.ts` : abonnements mock (camille, helene Premium ; louis Plus ; theo Premium résilié ; paul gratuit), `BIENVENUE20`, journal. `src/db/seed/admin.ts` : cas ouverts pour les fiches `pending_review` / `changes_requested`, décisions historisées, 2 signalements, 1 recours, pages éditoriales publiées **avec la mention « Brouillon à valider par un professionnel du droit »** (textes structurés du module legal + `classements-sponsorises` + `faq`), jamais écrasées si l'équipe les a modifiées.
