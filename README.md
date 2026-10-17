# Les Petits Invités — avec Marie

Application web de garde d’enfants événementielle (mariages, fêtes privées, événements professionnels) : site public éditorial, demande de devis guidée, espace de gestion pour Marie, espace client, espace intervenant·e, espace partenaire.

> **Mode démonstration.** Le nom est provisoire, toutes les données sont fictives (adresses `example.test`), aucun email réel n’est envoyé : ils sont consultables dans Mailpit. Voir [docs/avant-mise-en-service.md](docs/avant-mise-en-service.md) avant toute exploitation réelle.

## Prérequis

- macOS Apple Silicon (testé), Docker Desktop avec Docker Compose v2.
- Pour le mode développement hors Docker : Node.js ≥ 22.12 et pnpm 12 (`corepack enable` ou `npm i -g pnpm@12`). Note : pnpm 12 peut exécuter les scripts avec un Node géré par lui-même (ici 26.5.1) ; l’image Docker utilise Node 22.

Ports utilisés (tous liés à `127.0.0.1`) : application **3100**, PostgreSQL **5440**, Mailpit **8026** (interface) / **1026** (SMTP).

## Démarrer tout avec Docker (recommandé)

```bash
docker compose up --build
```

Le service `migrate` applique les migrations et le seed de démonstration, puis l’application démarre.

- Application : http://localhost:3100
- Boîte email locale (Mailpit) : http://localhost:8026
- Arrêt : `docker compose down` (les données sont conservées dans un volume) · remise à zéro complète : `docker compose down -v`

## Développement hors Docker

Le conteneur `app` et `pnpm dev` écoutent tous deux sur le port 3100 : arrêtez l’un avant de lancer l’autre (`docker compose stop app`).

```bash
docker compose up -d db mailpit
cp .env.example .env
pnpm install
pnpm db:deploy      # migrations
pnpm db:seed        # données de démonstration (idempotent, non destructif)
pnpm dev            # http://localhost:3100
```

Le secret de session est généré au premier lancement dans `.secrets/session.key` (ignoré par git, permissions 600).

## Comptes de démonstration (mode local uniquement)

| Rôle | Email | Mot de passe |
|---|---|---|
| Marie (administration) | marie@example.test | demo-marie-2026 |
| Client 1 | camille.durand@example.test | demo-client-2026 |
| Client 2 | thomas.lefevre@example.test | demo-client-2026 |
| Intervenant·es | alix.moreau@, berenice.petit@, chloe.garnier@, dorian.robin@, elsa.nguyen@example.test | demo-intervenant-2026 |
| Partenaire (Domaine des Tilleuls) | contact@domaine-des-tilleuls.example.test | demo-partenaire-2026 |

Les comptes réels (clients, intervenants, partenaires) se connectent par **lien magique** envoyé par email (page `/connexion`). Le formulaire mot de passe n’apparaît qu’en `DEMO_MODE`, lui-même refusé si `APP_ENV=production`.

## Commandes

| Commande | Rôle |
|---|---|
| `pnpm dev` | serveur de développement (port 3100) |
| `pnpm build` / `pnpm start` | build et serveur de production |
| `pnpm typecheck` | génération Prisma + types Next + `tsc` |
| `pnpm lint` | ESLint |
| `pnpm test` | tests Vitest (unitaires + intégration sur la base locale) |
| `pnpm test:e2e` | parcours Playwright (serveur sur 3100 + Mailpit requis ; `E2E_BASE_URL=http://localhost:3101 pnpm test:e2e` pour viser un autre serveur) |
| `pnpm db:migrate` | créer/appliquer une migration en dev |
| `pnpm db:deploy` | appliquer les migrations |
| `pnpm db:seed` | seed reproductible, non destructif |
| `pnpm db:reset -- --yes` | **détruit toutes les données** puis re-seed (refusé en production) |

## Parcours de visite (5 minutes)

1. Accueil → « Parler de mon événement » : remplir la demande guidée (5 étapes, récapitulatif). Noter la référence `LPI-…`, ouvrir Mailpit : accusé de réception + notification à Marie.
2. Se connecter en Marie → Tableau de bord → ouvrir la demande → préparer une proposition (lignes calculées par le moteur tarifaire), la transmettre.
3. Se connecter en client (camille.durand@example.test) → espace client → « Cette proposition me convient ».
4. Marie → fiche événement → proposer la mission à des intervenant·es (suggestions expliquées) ; se connecter en Alix pour accepter, en Chloé pour refuser.
5. Marie → affecter les personnes acceptantes ; tenter d’affecter Alix sur `LPI-DEMO-0006` (même soir) : le conflit bloque. Confirmer `LPI-DEMO-0003` est impossible tant que l’équipe est incomplète.
6. Lieux partenaires → fiche publique, lien d’apport `/p/tilleuls` (dépose un cookie technique, préremplit le formulaire) ; espace partenaire (statistiques agrégées, QR, kit imprimable).

## Documentation

- [docs/architecture.md](docs/architecture.md) — couches, flux, sécurité
- [docs/decisions.md](docs/decisions.md) — décisions techniques et sources consultées
- [docs/avant-mise-en-service.md](docs/avant-mise-en-service.md) — validations nécessaires avant exploitation réelle
- [docs/donnees-personnelles.md](docs/donnees-personnelles.md) — inventaire, conservation, export, suppression
- [docs/tests.md](docs/tests.md) — bilan des tests exécutés
- [docs/assets.md](docs/assets.md) — provenance des visuels
- [docs/progress.md](docs/progress.md) — avancement

## Périmètre exclu (V1)

Paiement en ligne, signature électronique certifiée, facturation comptable, chat temps réel, application mobile, géolocalisation, dossiers médicaux ou suivi nominatif d’enfants, marketplace ouverte, scraping, prospection automatisée, chatbot, intégration Odoo.
