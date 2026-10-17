# Avancement — Les Petits Invités (reprise après interruption)

> Fichier de suivi. Mettre à jour à chaque jalon. Dernière mise à jour : 2026-10-17 (02:15).

## Reprise rapide

Livraison V1 terminée le 2026-10-17 : pile Docker (`docker compose up --build`) sur http://localhost:3100, Mailpit sur :8026, comptes démo dans le README. Prochaines étapes réelles : `docs/avant-mise-en-service.md`.

## État global

- [x] Inspection du dossier (vide, dépôt git sans commit), outils : Node 22.22, pnpm 12.4, Docker 29.8, Compose 5.5, arm64
- [x] Ports choisis (3000/5433 pris par un autre projet) : app 3100, PostgreSQL 5440, Mailpit UI 8026 / SMTP 1026
- [x] Versions vérifiées sur npm + docs officielles (Context7) : Next 16.4.2, React 19.3.1, Prisma 7.10.1 (stable, pas la RC 8), Tailwind 4.3.3, Zod 4.6.7, Vitest 5.0.5, Playwright 1.64.1, TS 5.9.3
- [x] Skills lus : Impeccable (PRODUCT.md écrit, seed 7857a10e, surface brief écrit), UI UX Pro Max (checklist UX retenue ; palette proposée rejetée car contraire au brief)
- [x] Fondation : package.json, tsconfig, eslint, next.config, Docker (Dockerfile multi-stage, compose db+mailpit+migrate+app), prisma.config.ts, schema.prisma
- [x] Installation des dépendances + génération Prisma + migration initiale (`20261016233438_init`)
- [x] Librairies : env, db, auth (sessions, mots de passe scrypt, liens magiques), mail (Mailpit), time (Europe/Paris), money, rate-limit, audit
- [x] Domaine pur + tests Vitest (35 tests) : tarification, transitions, chevauchements/marge, checklist, préparation, suggestion ; test d’intégration concurrence (4 tests, base réelle)
- [x] Services (Prisma) : demandes, événements, devis versionnés, intervenants, invitations, affectations (transaction + verrou), lieux, attribution partenaire, candidatures, paramètres, contenus, notes, audit, dashboard
- [x] Site public (15 pages) + SEO (metadata, JSON-LD, sitemap, robots, 404) + route d’apport `/p/[code]`
- [x] Formulaire de devis guidé multi-étapes (5 étapes, récap, retour, anti-double-soumission, honeypot)
- [x] Espace Marie (admin) : 46 fichiers (agent), intégré, scénario de bout en bout Playwright (8 étapes) vert
- [x] Espaces client / intervenant / partenaire (26 fichiers, agent), vérifiés : 12 tests Playwright (isolation + parcours) + revue 390/1440
- [x] Seed de démonstration (reproductible, non destructif) + `pnpm db:reset -- --yes`
- [x] Tests Playwright : 30/30 (publics 10, isolation 5, portails 7, admin 8), rejoués contre l’image Docker de production
- [x] Pile Docker complète (`docker compose up --build`) validée, persistance après redémarrage vérifiée
- [x] Revue visuelle 390 / 1440, détecteur Impeccable (0 constat), revue finale Impeccable (7 corrections appliquées en trois passes, verdict final « ship »), DESIGN.md + .impeccable/design.json écrits par le documenteur
- [x] README, AGENTS.md, docs/architecture.md, docs/decisions.md, docs/avant-mise-en-service.md, docs/donnees-personnelles.md, docs/assets.md — [x] docs/tests.md

## Décisions prises en cours de route (détail dans docs/decisions.md)

- Auth maison (sessions en base, scrypt node:crypto, liens magiques hachés) plutôt qu’une lib tierce — voir decisions.md.
- `cacheComponents` désactivé, rendu dynamique global (`force-dynamic`) : app pilotée par la base, pas de prérendu au build.
- Migrations exécutées par un service Compose `migrate` (image `migrator`) avant le démarrage de l’app.
