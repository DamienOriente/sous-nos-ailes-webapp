# CLAUDE.md — Sous Nos Ailes (sousnosailes.fr)

Plateforme SaaS de mise en relation et de coordination pour évènements privés et professionnels, spécialisée garde d'enfants / animation. Monolithe modulaire Next.js 16 (App Router) + PostgreSQL 17 (Drizzle) + Redis (BullMQ) + S3 (MinIO en local) + ClamAV + Mailpit.

Langue : UI en français, code/commentaires/commits en anglais.

## Commandes

```bash
docker compose up -d db redis minio minio-init mailpit clamav   # infra locale
pnpm install
pnpm db:migrate && pnpm db:seed                                  # schéma + données de démo
pnpm dev                                                         # http://localhost:3200
pnpm worker                                                      # BullMQ (emails, fichiers, sync calendriers, rétention)
pnpm typecheck && pnpm lint && pnpm test                         # vérifs
pnpm test:integration                                            # tests DB (base locale, serial)
pnpm build && pnpm test:e2e                                      # Playwright contre le build
```

Ports : app 3200, Postgres 5450, Redis 6390, MinIO 9010 (console 9011), Mailpit 8027 (SMTP 1027), ClamAV 3310. Sous-réseau Compose 10.213.45.0/24 (les pools Docker par défaut sont épuisés sur ce poste).

## Architecture (contrat pour tous les contributeurs, humains ou agents)

```
src/app/            Presentation : routes, layouts, server actions (fichiers actions.ts "use server"), route handlers
src/modules/<m>/    Un module métier = domain/ (pur, zéro IO) + application/ (cas d'usage, services) + infrastructure/ (adapters)
src/db/schema/      Schéma Drizzle par module ; src/db/migrations/ généré par drizzle-kit ; src/db/seed/ données de démo
src/lib/            Transverse : env, logger, errors, crypto, session, auth (better-auth), redis, utils
src/components/ui   shadcn (ne pas modifier à la main sauf nécessité) ; src/components/shared kit maison ; src/components/<module>
src/workers/        Consommateurs BullMQ (process séparé : pnpm worker)
tests/unit, tests/integration, e2e/
```

Règles :
- **Pas de logique métier dans les routes/actions** : une action valide (Zod), récupère l'`Actor` via `requireActorOrThrow()`, appelle un service, mappe l'erreur avec `toActionError`, retourne `ActionResult<T>`.
- **Toute lecture/écriture d'une ressource privée passe par `src/modules/authorization`** : `requireEventPermission(actor, eventId, "x.y")`, `requireProfessionalManage`, `requireGlobalPermission`. Deny by default. Ressource inaccessible ⇒ `NotFoundError` (même message qu'un id inexistant, anti-énumération).
- Les services acceptent `executor: DbExecutor = db` pour tourner dans une transaction.
- Dates stockées en UTC (`timestamptz`), fuseau d'affichage = `users.timezone` (défaut Europe/Paris). Argent en centimes entiers.
- Zod 4 (`import { z } from "zod"`). TypeScript strict, pas de `any`.
- Jamais de secret/donnée de santé dans les logs, les notifications e-mail, les QR codes, les URLs.
- Fichiers : jamais servis directement ; `files` + URL signée courte après autorisation. Nom de stockage = UUID.
- Données de démo : `isDemo = true`, e-mails en `@sousnosailes.test`, mot de passe commun documenté dans le README ; seed refusé si `APP_ENV=production`.
- Composants serveur par défaut ; `"use client"` seulement pour l'interactivité. Formulaires : server actions + `useActionState` ou react-hook-form + Zod pour les formulaires riches.
- Accessibilité : labels explicites, focus visible, états vides/chargement, confirmation des actions destructives (`ConfirmDialog`).

## Décisions d'archi (datées)

- 2026-10-17 — better-auth (email/password, vérification e-mail, 2FA TOTP, plugin admin) plutôt qu'une auth maison ; sessions cookie HttpOnly, rate-limit Redis. Passkeys non implémentées en V1.
- 2026-10-17 — RBAC + ABAC applicatif (`modules/authorization`) ; pas de RLS PostgreSQL en V1 (étudié dans docs/security.md), isolation garantie par les requêtes filtrées sur event_id/owner et les tests multi-tenant.
- 2026-10-17 — Pages pro = arbre de blocs JSON validé (Zod) + templates définis en code (`modules/pages/templates`) ; jamais de HTML/JS libre.
- 2026-10-17 — Stripe en mode test uniquement ; sans clé, provider `mock` explicitement étiqueté. Droits Premium vérifiés côté serveur via `modules/billing/application/entitlements`.
- 2026-10-17 — Données de santé des enfants chiffrées AES-256-GCM colonne par colonne (`lib/crypto`), accès journalisé dans `child_access_logs`.

- 2026-10-17 — Documents juridiques = gabarits à variables (`{{legal.*}}`) en brouillon par défaut, jamais de fait inventé ; bannière cookies sans traceur avec preuve en base ; analytique produit interne à catalogue fermé (`modules/analytics`).

- 2026-10-17 — Chantier « vitalité » : photos de démonstration Unsplash (catalogue vérifié `modules/media/demo-photos.ts`, réservé aux profils fictifs et pages marketing, à remplacer avant commercialisation, cf. docs/assets.md) + illustrations SVG originales (`components/illustrations/*`) ; états vides illustrés (`IllustratedEmpty`), exemples intégrés réels (`modules/events/domain/suggestions.ts`, `modules/tools/domain/tool-examples.ts`, `components/professionals/listing-examples.ts`, `modules/identity/domain/next-actions.ts`) ; couverture d'évènement (`events.cover_photo_id` / `cover_file_id`, migration 0001).

## Pièges rencontrés

- pnpm 12 applique `minimumReleaseAge` (24 h) : un paquet publié le jour même est refusé → reculer d'une version, ne pas désactiver la politique.
- shadcn CLI 4.22 échoue sur le même contrôle ; 4.21.5 fonctionne. Les composants importent `cn` depuis le paquet npm `cn` (ajouté par shadcn), notre `@/lib/utils` expose aussi `cn`.
- `server-only` ne doit pas être importé par les modules utilisés par les scripts/workers (tsx) : réservé à `lib/session.ts` et aux fichiers Next.
- better-auth avec `secondaryStorage` (Redis) : `storeSessionInDatabase: true` est activé, sinon les sessions ne vivent que dans Redis et un `FLUSHALL`/redémarrage déconnecte tout le monde (vécu le 2026-10-17). Lire les sessions via `auth.api.listSessions`, jamais la table directement.
- Zod 4 : `z.email().trim()` valide avant de trimmer → utiliser `z.string().trim().pipe(z.email())`.
- BullMQ 6 : un `jobId` ne doit pas contenir `:`.
- better-auth rate-limit `/sign-in/email` 5/min/IP compte aussi les connexions réussies : derrière un NAT, à revoir avant prod (clé e-mail+IP ou max plus élevé).
- `DemoBanner` (lit `@/lib/env` → `node:fs`) n'est pas exporté par le barrel `@/components/shared` : l'importer depuis `@/components/shared/demo-banner` (serveur seulement). Un composant client qui tirerait `env` via un barrel fait planter Turbopack.
- Drizzle : dans une sous-requête `sql`…`` corrélée, référencer la table externe par `${table}.col`, pas `${table.col}` (rendu non qualifié dans un select mono-table, donc masqué par l'alias interne → compteur à 0).
- Next 16 `next/image` : une URL locale avec query string (`/api/files/<id>/public?v=medium`) exige `images.localPatterns`, sinon 500 ; les images du pipeline fichiers sont rendues `unoptimized` (variantes WebP déjà produites côté serveur).
- Photos de démo : une photo n'est attribuée qu'à une seule fiche, uniquement dans les thèmes de son métier, et les photos vitrine (`RESERVED_PHOTO_IDS`) ne sont jamais données aux fiches ; vérifier toute nouvelle photo à l'œil avant de la cataloguer (docs/assets.md).
- Images Docker : `minio/minio` doit être pré-tiré (quay.io inaccessible depuis ce poste) ; `clamav/clamav-debian:stable` pour arm64.

## État d'avancement

V1 livrée le 2026-10-17 : 9 modules intégrés, 100 tables, 287 tests unitaires, 114 d'intégration, 14 suites Playwright. Tableau de couverture détaillé dans docs/progress.md. Reste à faire avant ouverture : validations juridiques (docs/legal-review.md), clés Stripe/Google/Microsoft de test puis live, pentest, LCP mobile, passkeys, RLS.
