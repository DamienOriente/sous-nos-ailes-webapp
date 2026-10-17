# AGENTS.md — Les Petits Invités (mémoire projet)

Lire aussi : `README.md`, `docs/architecture.md`, `docs/decisions.md`, `docs/progress.md`.

## Décisions d’architecture (2026-10-17)

- Next.js 16.4 App Router, React 19, TypeScript 5.9 strict, Tailwind 4 (`@theme` dans `src/app/globals.css`), Prisma 7.10 + `@prisma/adapter-pg`, Zod 4, Vitest 5, Playwright 1.64, pnpm 12.
- Rendu dynamique global (`force-dynamic` dans le layout racine) : tout lit la base ; `cacheComponents` désactivé.
- Auth maison : sessions en base (hash HMAC avec `SESSION_SECRET`), scrypt pour les mots de passe (démo uniquement), liens magiques hachés à usage unique consommés par POST.
- Séparation stricte : `src/app` (UI) → `src/server/actions` (validation Zod, session) → `src/server/services` (métier + Prisma) ; `src/domain` = fonctions pures testées.
- Montants en centimes, instants UTC, dates civiles `@db.Date`, affichage Europe/Paris (`src/lib/time.ts`).
- Affectation d’intervenant : transaction avec `SELECT … FOR UPDATE` sur le profil + détection de chevauchement avec marge ; statut d’équipe distinct du statut commercial.
- Versions de proposition immuables après envoi (`SENT` → `SUPERSEDED` à la version suivante).
- `DEMO_MODE` interdit en `APP_ENV=production` (`src/lib/env.ts`).

## Pièges rencontrés

- `prisma.config.ts` : `env("DATABASE_URL")` lève une erreur dès le chargement si la variable manque → repli explicite sur l’URL locale.
- Les types `PageProps`/`LayoutProps` n’existent qu’après `next typegen` (inclus dans `pnpm typecheck`).
- JSX n’accepte pas `\"` dans un attribut : les `url("data:…")` Tailwind vont dans une constante JS.
- `promisify(scrypt)` perd la surcharge avec options : wrapper manuel.
- Docker : pools d’adresses épuisés sur ce Mac → sous-réseau fixe `10.213.44.0/24` dans `docker-compose.yml`.
- Ports 3000/5433 occupés par un autre projet → 3100/5440/8026/1026.
- pnpm 12 exécute scripts et `pnpm exec` avec son propre Node (26.5.1 ici), pas celui de nvm (22.22.3) : le projet a été validé sur Node 26 en local et Node 22 dans Docker.
- Cookies Next : la valeur est URL-encodée (`:` → `%3A`) ; utiliser un séparateur non encodé (`.`) et `decodeURIComponent` à la lecture.
- Tailwind : `hidden` + `inline-flex` dans la même liste de classes → `inline-flex` gagne ; envelopper dans un conteneur `hidden sm:block`.

- Tests Playwright : `E2E_BASE_URL` pilote l’URL cible (défaut 3100) ; les helpers n’ont plus de port codé en dur. Les captures de revue (`scripts/capture-review.ts`) se font depuis un build de production (`next start -p 3101`), le dev server rend les navigations flaky.
- Rate limiting : seuls les échecs de connexion comptent ; les limites des formulaires publics sont relevées en `DEMO_MODE` (sinon les suites e2e s’auto-bloquent).

## État d’avancement

Voir `docs/progress.md` (mis à jour à chaque jalon).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
