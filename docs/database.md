# Base de données

PostgreSQL 17, schéma Drizzle (`src/db/schema/*.ts`, un fichier par module, `casing: "snake_case"`), migrations SQL dans `src/db/migrations/` (`pnpm db:generate` → `pnpm db:migrate`). 100 tables au 2026-10-17.

## Conventions

- Clés primaires `uuid` (`gen_random_uuid()`), sauf les tables better-auth (`text`) et les tables à clé naturelle (`configuration_settings.key`, `editorial_pages.slug`, `tool_definitions.key`).
- `created_at` / `updated_at` `timestamptz` (`updated_at` mis à jour par Drizzle `$onUpdate`) ; suppression logique `deleted_at` sur `events`, `organizations`, `professionals`, `files`, `messages`.
- Dates en UTC ; `date` (texte `YYYY-MM-DD`) pour les dates calendaires ; argent en centimes entiers.
- Enums Postgres pour les statuts stables ; `text` typé TypeScript (`$type<"a" | "b">`) quand l'ensemble doit rester extensible sans migration d'enum.
- `jsonb` uniquement pour des structures validées par Zod à l'écriture (contenu de page, propriétés analytiques, préférences) — jamais pour contourner le modèle relationnel.
- Suppression en cascade depuis l'agrégat (`events` → membres, tâches, invités, enfants…) ; `restrict` sur les références qui doivent survivre à l'auteur (`events.owner_user_id`, `child_attendance.recorded_by_user_id`) ; `set null` pour les traces (qui a modéré, invité…).
- Drapeau `is_demo` sur `users`, `professionals`, `events`, `inquiries` : exclu de l'indexation et des compteurs publics « réels ».

## Tables par module

| Module | Tables |
|---|---|
| identity | `users`, `sessions`, `accounts`, `verifications`, `two_factors`, `user_profiles`, `audit_logs`, `security_events`, `login_attempts` |
| organizations | `organizations`, `organization_members` |
| professionals / directory | `professional_categories`, `professionals`, `professional_category_assignments`, `professional_services`, `professional_verifications`, `professional_documents`, `professional_availability`, `professional_reviews`, `professional_favorites`, `tool_definitions`, `professional_tool_activations` |
| pages | `public_profiles`, `profile_versions`, `media_assets` |
| events | `events`, `event_members`, `event_permissions`, `event_professionals`, `event_tasks`, `event_task_comments`, `event_milestones`, `event_budget_lines`, `event_expenses`, `event_documents`, `checklist_templates` |
| guests / invitations / seating | `contacts`, `contact_event_links`, `guest_groups`, `event_guests`, `invitations`, `invitation_tokens`, `invitation_responses`, `invitation_checkins`, `seating_tables`, `seating_assignments` |
| childcare | `event_children`, `child_sensitive_information`, `child_emergency_contacts`, `child_authorized_persons`, `child_care_assignments`, `child_attendance`, `child_handover_records`, `child_access_logs`, `childcare_activities` |
| collaboration / inquiries / notifications | `event_channels`, `channel_members`, `messages`, `message_attachments`, `inquiries`, `inquiry_events`, `notifications`, `notification_preferences`, `email_outbox` |
| calendar | `calendar_entries`, `calendar_connections`, `calendar_sync_mappings`, `calendar_sync_jobs`, `calendar_reminder_dispatches` |
| billing | `plans`, `plan_features`, `billing_customers`, `subscriptions`, `billing_events`, `promo_codes`, `featured_placements` |
| admin / moderation / legal | `moderation_cases`, `moderation_decisions`, `reports`, `appeals`, `configuration_settings`, `editorial_pages` |
| files | `files`, `file_scan_results`, `file_access_logs` |
| privacy | `consent_records`, `data_subject_requests`, `retention_jobs` |
| trade-tools | `catering_plans`, `catering_menus`, `catering_service_steps`, `venue_spaces`, `venue_space_allocations`, `venue_logistics`, `music_briefs`, `music_key_moments`, `equipment_items`, `shot_list_items`, `image_briefs` |
| analytics | `product_events` |

## Index notables

- Isolation : toutes les tables d'évènement sont indexées sur `event_id` (souvent composé : `(event_id, status)`, `(event_id, created_at)`), les tables de fiche sur `professional_id`, les tables utilisateur sur `user_id`.
- Unicité métier : `users.email`, `professionals.slug`, `public_profiles.slug`, `plans.key`, `event_members (event_id, user_id)`, `event_permissions (member_id, permission)`, `invitation_tokens.token_hash`, `calendar_entries (owner_user_id, ical_uid)`, `calendar_connections (user_id, provider)`, `billing_events (provider, external_event_id)`, `subscriptions.stripe_subscription_id`, `seating_assignments.guest_id`, `professional_reviews (professional_id, author_user_id, event_id)`.
- Recherche annuaire : `professionals (status)`, `(department, city)`, `(latitude, longitude)`, `(primary_category_id)` ; `featured_placements (category_slug, department, starts_at, ends_at)`.
- Files et journaux : `email_outbox (status, created_at)`, `notifications (user_id, read_at, created_at)`, `audit_logs (created_at)`, `(actor_user_id, created_at)`, `(resource_type, resource_id)`, `product_events (name, created_at)`, `data_subject_requests (status, due_at)`, `retention_jobs (policy, created_at)`.
- Fichiers : `files (sha256, scope, scope_id)` — le dédoublonnage par empreinte est volontairement **limité au même scope** pour qu'une empreinte ne révèle jamais l'existence d'un fichier chez un autre tenant.

## Isolation multi-tenant

Il n'y a pas de colonne `tenant_id` globale : le « tenant » est l'évènement (ou la fiche, ou l'utilisateur). L'isolation repose sur trois mécanismes testés :

1. **Autorisation obligatoire** avant toute requête sur une ressource privée (`requireEventPermission`, `requireProfessionalManage`), qui résout l'appartenance via `event_members` / `professionals.owner_user_id` / `organization_members`.
2. **Requêtes toujours filtrées** par `event_id` / `professional_id` / `owner_user_id` dans les services (jamais de `select … where id = $1` seul sur une table d'évènement).
3. **Tests d'isolation** : `tests/integration/*` (accès croisés entre `louis` et `paul`, membres révoqués, portée enfant) et specs e2e.

### Position sur le Row-Level Security

RLS PostgreSQL n'est **pas activé en V1**. Raisons : (a) les règles sont contextuelles (rôle × métier × surcharges expirables × portée enfant) et seraient dupliquées entre SQL et application ; (b) la connexion applicative est un seul rôle Postgres (pool partagé), il faudrait propager l'identité par `SET LOCAL` à chaque transaction, ce que Drizzle supporte mais qui complexifie workers et scripts ; (c) le gain réel serait un filet de sécurité contre une requête mal filtrée.

Plan si le filet devient souhaitable (V2) : rôle `sna_app` sans `BYPASSRLS`, policies `USING (event_id IN (select event_id from event_members where user_id = current_setting('app.user_id')))` sur les tables d'évènement, `SET LOCAL app.user_id` dans un wrapper `withActor(actor, fn)` autour de `db.transaction`, workers via un rôle de service. À coupler avec un test qui vérifie que chaque table d'évènement a une policy.

## Chiffrement et secrets en base

- `child_sensitive_information.allergies_encrypted` / `health_notes_encrypted` : AES-256-GCM (`lib/crypto`, format `v1.iv.tag.ciphertext`), clé `DATA_ENCRYPTION_KEY`.
- `calendar_connections.access_token_encrypted` / `refresh_token_encrypted` : même mécanisme.
- `invitation_tokens.token_hash` : HMAC-SHA256 du jeton (clé dérivée de `DATA_ENCRYPTION_KEY`) ; le jeton clair n'est jamais stocké.
- Mots de passe : hachés par better-auth (`accounts.password`), secrets TOTP gérés par le plugin `two_factor`.
- Aucun secret applicatif (clés API, mots de passe SMTP) en base : variables d'environnement uniquement.

## Données de référence et de démo

`pnpm db:seed` est idempotent (upserts). Référence : catégories, offres + fonctionnalités, catalogue d'outils, modèles de check-lists, `configuration_settings` (`legal.*`, `retention.*`, `billing.live_enabled`, `sponsored.max_per_query`, `moderation.*`). Démo (`DEMO_MODE=true`) : 14 comptes, ~20 fiches, 3 évènements, invités, enfants, messages, abonnements simulés, pages éditoriales. Refusé en production.

## Migrations

- Une seule migration initiale `0000_init.sql` ; les ajouts des modules (tables outils métier, `product_events`, `professional_favorites`, `calendar_reminder_dispatches`) ont été appliqués en local avec `drizzle-kit push` et doivent être consolidés par `pnpm db:generate` avant le premier déploiement (voir `deployment.md`).
- Au déploiement, le conteneur `migrator` applique les migrations puis (hors production) le seed ; l'app ne démarre qu'après son succès.
- Règles : migrations additives et rétro-compatibles (ajouter une colonne nullable, remplir, puis contraindre) ; jamais de `DROP` sans sauvegarde vérifiée (`backup-restore.md`).
