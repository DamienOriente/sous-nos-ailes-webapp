# Sous Nos Ailes — sousnosailes.fr

Plateforme de mise en relation et de coordination pour évènements privés et professionnels (mariages, baptêmes, anniversaires, séminaires), spécialisée **garde d'enfants et animation**. Les organisateurs trouvent des professionnels vérifiés, réunissent leur équipe et pilotent le jour J depuis un seul espace ; les professionnels publient une page, reçoivent des demandes et disposent d'outils métier.

Monolithe modulaire **Next.js 16 (App Router)** · **PostgreSQL 17** (Drizzle) · **Redis** (BullMQ, rate limiting) · **S3** (MinIO en local) · **ClamAV** · **Mailpit** (SMTP local). UI en français, code en anglais.

Documentation détaillée dans [`docs/`](docs/) : [architecture](docs/architecture.md), [modèle de domaine](docs/domain-model.md), [base de données](docs/database.md), [sécurité](docs/security.md), [modèle de menaces](docs/threat-model.md), [permissions](docs/rbac-permissions.md), [RGPD](docs/privacy.md), [revue juridique](docs/legal-review.md), [intégrations](docs/integrations.md), [déploiement](docs/deployment.md), [sauvegardes](docs/backup-restore.md), [tests](docs/testing.md), [guide utilisateur](docs/user-guide.md), [guide admin](docs/admin-guide.md), [exploitation](docs/operations.md).

## Prérequis

- Node.js ≥ 22.12, pnpm 12 (`corepack enable`)
- Docker Desktop (Postgres, Redis, MinIO, Mailpit, ClamAV)
- Ports libres : **3200** (app), 5450 (Postgres), 6390 (Redis), 9010/9011 (MinIO API/console), 8027 (Mailpit UI) / 1027 (SMTP), 3310 (ClamAV)

## Installation

```bash
git clone <repo> sous-nos-ailes && cd sous-nos-ailes
cp .env.example .env                       # valeurs locales par défaut, aucun secret réel
docker compose up -d db redis minio minio-init mailpit clamav
pnpm install
pnpm db:migrate                            # applique src/db/migrations
pnpm db:seed                               # données de référence + comptes/fiches/évènements de démo (DEMO_MODE=true)
pnpm dev                                   # http://localhost:3200
pnpm worker                                # dans un second terminal : files, e-mails, rappels, synchro agenda, rétention
```

ClamAV met plusieurs minutes à charger ses signatures au premier démarrage ; les envois de fichiers restent « en quarantaine » tant que le démon n'est pas prêt. En local on peut mettre `CLAMAV_ENABLED=false` (jamais en production).

Stack complète en conteneurs (build inclus) : `docker compose --profile app up --build` (app sur 3200, migrations + seed automatiques).

## Configuration

Toutes les variables sont documentées dans [`.env.example`](.env.example) et validées au démarrage par `src/lib/env.ts` (Zod). Points clés :

| Variable | Rôle |
|---|---|
| `APP_ENV` | `local` / `test` / `production`. En production : `DEMO_MODE` refusé, `BETTER_AUTH_SECRET`, `DATA_ENCRYPTION_KEY` et `APP_URL` en https obligatoires |
| `DEMO_MODE` | comptes et données fictives, bannière « démonstration », paiement simulé |
| `INDEXING_ENABLED` | `robots` index/noindex — reste `false` jusqu'à la checklist de mise en ligne |
| `DATABASE_URL`, `REDIS_URL` | Postgres et Redis |
| `S3_*` | stockage objet (MinIO local, Scaleway/OVH en prod), deux buckets : fichiers et quarantaine |
| `CLAMAV_*` | antivirus (clamd) |
| `SMTP_*`, `MAIL_FROM` | e-mails transactionnels (Mailpit local, relais SMTP en prod) |
| `STRIPE_*` | facturation — **mode test uniquement** ; absent ⇒ fournisseur `mock` étiqueté |
| `GOOGLE_*`, `MICROSOFT_*` | synchronisation d'agenda (optionnelle) |

Secrets locaux : sans `BETTER_AUTH_SECRET` / `DATA_ENCRYPTION_KEY`, des clés aléatoires sont générées dans `.secrets/` (ignoré par git). En production ils viennent de l'environnement (Coolify).

## Services et composants

| Composant | Commande | Rôle |
|---|---|---|
| Application Next.js | `pnpm dev` / `pnpm start` | routes publiques, espace `/app`, back-office `/admin`, route handlers `/api/*` |
| Worker BullMQ | `pnpm worker` | files `files-scan`, `email-outbox`, `reminders`, `calendar-sync`, `retention` (cron 03:00 Europe/Paris), `generic` |
| Postgres 17 | docker | 100 tables, schéma Drizzle `src/db/schema/*` |
| Redis 7 | docker | queues, rate limiting, cache de session better-auth |
| MinIO | docker | buckets `sna-files` (fichiers sains) et `sna-quarantine` |
| ClamAV | docker | analyse antivirus de chaque fichier déposé |
| Mailpit | docker | boîte de réception locale http://localhost:8027 |

## Migrations et seed

- `pnpm db:migrate` applique `src/db/migrations/*.sql` (drizzle-orm migrator, table `drizzle.__drizzle_migrations`).
- `pnpm db:generate` génère une migration depuis le schéma (`drizzle-kit generate`). Ne jamais utiliser `drizzle-kit push` ailleurs qu'en local.
- `pnpm db:seed` : données de référence idempotentes (24 catégories de métiers, 4 offres + fonctionnalités, catalogue d'outils, modèles de check-lists, clés `configuration_settings`), puis, si `DEMO_MODE=true`, les comptes et données de démo (`src/db/seed/*.ts`). Refusé si `APP_ENV=production`.
- `pnpm db:reset` : vide le schéma puis migre et seed (local uniquement).

## Comptes de démonstration

Mot de passe commun : **`Demo-SousNosAiles-2026!`** (défini dans `src/db/seed/context.ts`). Tous les e-mails sont en `@sousnosailes.test` et marqués `is_demo`.

En mode démo (`DEMO_MODE=true`, jamais en production), la page `/connexion` propose un bouton par compte : un clic ouvre la session sans saisie. Le bandeau de démonstration contient un lien « Changer de compte » pour passer d'un rôle à l'autre.

| Compte | E-mail | Rôle / usage |
|---|---|---|
| Louis Marchand | louis@sousnosailes.test | organisateur, propriétaire du mariage de démo |
| Lisa Marchand | lisa@sousnosailes.test | coorganisatrice |
| Paul Nguyen | paul@sousnosailes.test | second organisateur (baptême, séminaire) — tests d'isolation |
| Camille Ferrand | camille.planner@sousnosailes.test | wedding planner |
| Marie Delcourt | marie.garde@sousnosailes.test | garde d'enfants évènementielle |
| Nora Benali | nora.nounou@sousnosailes.test | personnel de garde |
| Sofia Martins | sofia.anim@sousnosailes.test | animation pour enfants |
| Julien Rossi · Hélène Vasseur · Théo Lambert · Inès Garnier | julien.traiteur@ · helene.domaine@ · theo.dj@ · ines.photo@sousnosailes.test | traiteur, domaine, DJ, photographe |
| Modération | moderateur@sousnosailes.test | rôle `moderator` |
| Administration | admin@sousnosailes.test | rôle `admin` |
| Super admin | superadmin@sousnosailes.test | rôle `super_admin` (break-glass) |

## Vérifications

```bash
pnpm typecheck           # next typegen + tsc --noEmit
pnpm lint                # eslint
pnpm test                # unitaires (vitest, projet "unit")
pnpm test:integration    # services contre la base locale (sériel)
pnpm build && pnpm test:e2e   # Playwright (desktop + mobile), axe-core sur les pages publiques
pnpm check               # typecheck + lint + test
```

Contre un `pnpm dev` déjà lancé : `E2E_NO_SERVER=1 pnpm playwright test e2e/public.spec.ts --project=desktop`.

## Scripts utiles

| Script | Rôle |
|---|---|
| `scripts/backup.sh` | pg_dump chiffré (age ou openssl) + copie hors site S3 + miroir du bucket fichiers |
| `scripts/restore.sh <fichier\|offsite:latest> [url]` | restauration (refuse une base qui n'est pas `*restore*`/`*test*` sans `RESTORE_CONFIRM=yes`) |
| `scripts/test-restore.sh` | exercice de restauration dans `sna_restore_test` + comparaison des tables |
| `scripts/generate-permissions-matrix.ts` | régénère `docs/rbac-permissions.md` depuis le catalogue de permissions |
| `scripts/load-test.ts` | charge simple sur les routes publiques |

## Licence et statut

Projet privé en phase de lancement. Les documents juridiques servis par le site sont des **brouillons à valider par un professionnel du droit** (liste des points ouverts dans [docs/legal-review.md](docs/legal-review.md)).
