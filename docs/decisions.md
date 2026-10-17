# Décisions techniques et sources

> Chaque décision est datée. Les sources consultées le 2026-10-17 via Context7 (docs officielles) sont indiquées.

## 2026-10-17 — Stack et versions

- **Next.js 16.4.2 (App Router), React 19.3.1, TypeScript 5.9.3 (strict).** TypeScript 7.0 (compilateur natif) est publié mais trop récent pour l’écosystème ESLint/Next ; on reste sur 5.9.
  Source : docs Next.js 16 (`docs/01-app/02-guides/upgrading/version-16.mdx`) : `middleware.ts` est remplacé par `proxy.ts` (runtime Node uniquement) ; `cookies()`/`headers()`/`params` sont asynchrones.
- **Prisma 7.10.1** (stable). Le tag npm `latest` pointe sur une RC 8.0 : évitée.
  Source : changelog Prisma 7 (`2025-11-19.mdx`) : générateur `prisma-client` avec `output` obligatoire, import depuis `…/client`, adaptateur `@prisma/adapter-pg` requis (client « Rust-free »), `prisma.config.ts` porte l’URL de la base (`import "dotenv/config"` nécessaire côté CLI).
- **Tailwind CSS 4.3.3** via `@tailwindcss/turbopack` (loader Turbopack généré par `create-next-app@16.4.2`), tokens déclarés en CSS avec `@theme`. Source : tailwindcss.com/docs/theme.
- **Zod 4.6.7** : `z.email()`, `z.flattenError()` ; `z.coerce` n’accepte plus une clé absente (utiliser `.default()`). Source : zod.dev/v4/changelog.
- **Vitest 5.0.5** (logique métier, environnement node) et **Playwright 1.64.1** (parcours critiques).
- **pnpm 12.4.2** avec lockfile versionné. Node 22 LTS (image `node:22-alpine`).
- **Polices auto-hébergées** via `@fontsource/young-serif` et `@fontsource-variable/figtree` (licence OFL-1.1, fichiers copiés dans le bundle, aucun appel réseau au runtime).

## 2026-10-17 — Authentification maison plutôt qu’une bibliothèque tierce

Choix : sessions opaques en base (`Session.tokenHash` = HMAC-SHA256(secret, token aléatoire 32 octets)), cookie `lpi_session` HttpOnly/SameSite=Lax/Secure en production, expiration glissante, révocation serveur ; mots de passe hachés avec `scrypt` de `node:crypto` (N=2^15, r=8, p=1, sel 16 octets, comparaison en temps constant) ; liens de connexion aléatoires, hachés, à usage unique, valables 20 minutes.

Pourquoi : Auth.js v5 reste en beta ; Better Auth impose son propre schéma et ses plugins pour un besoin ici très simple (4 rôles, pas d’OAuth, pas de SaaS). Les exigences (liens hachés, isolation par rôle, journal d’audit) tiennent en ~300 lignes lisibles et testables. Référence suivie : *The Copenhagen Book* (recommandations de l’auteur de Lucia) — scrypt figure parmi les KDF recommandés.

À valider avant production : revue de sécurité externe du module `src/lib/auth`.

## 2026-10-17 — Rendu dynamique global, `cacheComponents` désactivé

Le template `create-next-app@16` active `cacheComponents`. Ici, toutes les pages publiques lisent des paramètres éditables en base (nom, textes, lieux publiés) et le mode démo : on force `dynamic = "force-dynamic"` dans le layout racine. Le build n’a ainsi besoin d’aucune base de données et le contenu reste toujours à jour. Coût : pas de prérendu statique ; acceptable à cette échelle. Le cache pourra être réintroduit page par page plus tard.

## 2026-10-17 — Docker Compose : service `migrate` séparé

L’image `runner` (sortie `standalone` de Next) ne contient pas la CLI Prisma. Un service `migrate` (cible `migrator` du Dockerfile, toolchain complète) exécute `prisma migrate deploy` puis le seed, et l’app ne démarre qu’après `service_completed_successfully`. Source : exemple officiel `examples/with-docker/Dockerfile` (Next.js) pour la cible `runner`.

## 2026-10-17 — Direction artistique

- Brief pinné : ivoire chaud, vert sauge profond, accents argile, titres éditoriaux, lecture très lisible.
- Skill Impeccable : PRODUCT.md écrit à partir du brief (pas d’entretien possible, substitution signalée), tirage `concept-seed` clé `7857a10e`, index 5 → **planche d’herbier** (spécimens pressés, étiquettes, calme catalogué). Les six challengers du catalogue sont déclinés sur les deux axes ; trois disciplines retenues (état porté par la forme et non la seule couleur ; une étape par ligne pleine largeur ; régions stables à toutes les largeurs). Contrat de direction dans `.impeccable/` (surface brief de la page d’accueil).
- Skill UI UX Pro Max : la proposition automatique (rose/doré, script « Great Vibes », style Aurora) contredit le brief et est rejetée ; sa checklist (contraste 4.5:1, focus visible, cibles 44 px, reduced-motion, 375/768/1024/1440) est conservée comme critère de recette.
- Polices : Young Serif (titres) et Figtree (texte/UI), choisies hors des « polices par défaut » listées par Impeccable.

## 2026-10-17 — Politique `minimumReleaseAge` de pnpm 12 et versions épinglées

pnpm 12 refuse par défaut d’installer une version publiée depuis moins de 24 h (protection contre les paquets compromis). Le build Docker a échoué sur `nodemailer@10.1.2` publié la veille : la dépendance est épinglée à `10.1.0` plutôt que d’assouplir la politique. Règle retenue : toutes les versions du `package.json` sont exactes (pas de `^`), et une version doit avoir plus de 24 h pour entrer dans le lockfile.

## 2026-10-17 — `DATABASE_URL` facultative au chargement, obligatoire à la connexion

`next build` évalue les modules de pages (dont `metadata` statique) sans base de données disponible dans l’image Docker. `getEnv()` ne valide donc plus `DATABASE_URL` ; `getDatabaseUrl()` la réclame au moment de créer le client Prisma, dans le seed et dans le reset. Les limites anti-abus des formulaires publics sont relevées en `DEMO_MODE` (100/h) et seules les connexions échouées comptent dans la limite de connexion.
