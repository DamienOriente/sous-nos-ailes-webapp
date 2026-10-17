# Bilan des tests exécutés

> Mis à jour le 2026-10-17. Tout ce qui est listé ici a été réellement exécuté sur ce Mac (Apple Silicon) ; ce qui n’a pas pu l’être est indiqué en fin de document.

## Contrôles statiques

| Contrôle | Commande | Résultat |
|---|---|---|
| Types | `pnpm typecheck` (Prisma generate + `next typegen` + `tsc --noEmit`) | 0 erreur |
| Lint | `pnpm lint` | 0 erreur, 0 avertissement |
| Détecteur d’anti-patterns UI (Impeccable) | `impeccable detect` sur tous les fichiers `.tsx`/`.css` de `src/app` et `src/components` | 0 constat (le détecteur a été contrôlé sur un extrait volontairement fautif : 3 constats) |

## Tests métier (Vitest 5)

`pnpm test` — 6 fichiers unitaires + 1 fichier d’intégration (base PostgreSQL locale).

| Fichier | Tests | Couvre |
|---|---|---|
| `tests/unit/pricing.test.ts` | 8 | arrondi au quart d’heure, minimum d’heures, majoration de nuit, déplacement, options (forfait / par intervenant), remise, TVA, minimum de prestation, fourchette publique, entrées invalides |
| `tests/unit/workflow.test.ts` | 5 | transitions autorisées/refusées, statut d’équipe séparé, blocages de confirmation explicites, étapes client |
| `tests/unit/scheduling.test.ts` | 5 | chevauchements, marge de déplacement, événement passant minuit, couverture des disponibilités, minutes de nuit |
| `tests/unit/time.test.ts` | 7 | décalages hiver/été, conversion locale → UTC, trou de printemps, ambiguïté d’automne, nuit de changement d’heure, dates civiles, formatage |
| `tests/unit/staffing-checklist.test.ts` | 4 | suggestion d’effectif expliquée, classement des candidat·es (critères non personnels), checklist adaptative, indicateur de préparation sans « score » |
| `tests/unit/auth-money.test.ts` | 5 | scrypt aller/retour, euros ↔ centimes, refus de `DEMO_MODE` en production, défauts locaux, rate limiting |
| `tests/integration/assignments.test.ts` | 4 | conflit direct et après minuit, marge de déplacement, **deux affectations concurrentes incompatibles → une seule passe** (verrou `FOR UPDATE`), équipe complète / double affectation refusées |

Résultat : **39 tests, 39 réussis**.

## Parcours Playwright (Chromium, desktop 1440×900 et mobile 390×844)

`pnpm test:e2e` avec le serveur sur :3100, PostgreSQL et Mailpit lancés.

| Fichier | Tests | Parcours du cahier des charges |
|---|---|---|
| `e2e/public.spec.ts` | 8 | 1 (demande soumise, référence, accusé dans Mailpit), 12 (apport partenaire conservé), 17 (formulaire invalide → rien créé), 18 (démo non indexable : meta, robots, sitemap vide), en-têtes de sécurité + nonce CSP, navigation clavier + focus visible, 404 propre |
| `e2e/public.mobile.spec.ts` | 2 | pas de défilement horizontal à 390 px, menu mobile, formulaire utilisable |
| `e2e/isolation.spec.ts` | 5 | 14 (un client ne lit pas le dossier d’un autre → 404), 15 (intervenant·e non invité·e → 404), 16 (partenaire sans donnée nominative), redirections anonymes, client refusé dans l’administration |
| `e2e/portals.spec.ts` | 7 | 4 (le client ne voit que ses dossiers), 5 (accord de principe + email à Marie), questions de préparation, 7 (intervenant·e accepte sans voir l’identité du client ; refus présent dans le seed), brief opérationnel, disponibilités, partenaire (lien, QR, kit, QR anonyme refusé) |
| `e2e/admin-journey.spec.ts` | 8 (série) | sur une demande fraîche : 1 soumission ; 3 Marie retrouve la demande, transmet une proposition puis une version révisée — **13** l’ancienne version reste (« Remplacée ») ; connexion du client par le lien reçu (usage unique vérifié) et **5** accord de principe ; **6** invitations (emails) ; **7** Dorian accepte, Chloé refuse ; **8** affectation ; **11** « Confirmer la prestation » désactivé avec les blocages listés tant que l’équipe est incomplète ; **9** sur LPI-DEMO-0006, affecter Alix (déjà affectée le même soir sur LPI-DEMO-0003) est refusé avec le motif ; puis effectif ajusté, points opérationnels validés, confirmation effective |

Résultat : **30 parcours, 30 réussis** (`pnpm test:e2e`, 59 s).

Parcours 2 (persistance après redémarrage) : vérifié manuellement avec la pile Docker (voir ci-dessous). Parcours 10 (deux affectations concurrentes) : couvert par le test d’intégration sur la base.

## Exécution Docker et persistance

- `docker compose build` : images `migrate` (toolchain, 1,78 Go) et `app` (Next standalone, 313 Mo) construites sur Apple Silicon ; `next build` passe sans base de données.
- `docker compose up -d` : `migrate` applique les migrations et le seed puis s’arrête ; `app` saine (`/api/health`) en ~6 s ; secret de session généré au premier lancement dans le volume `app-secrets` (mode 600) et réutilisé ensuite.
- **Les 30 parcours Playwright ont été rejoués contre l’image de production** (CSP sans `unsafe-eval`, serveur standalone, Mailpit via le réseau Docker) : 30 réussis en 42 s.
- **Parcours 2 — persistance** : 16 demandes `LPI-2026-*` et dernière référence `LPI-2026-0016` identiques avant et après `docker compose down` puis `up` (volumes conservés) ; page d’accueil servie après redémarrage.

## Revue visuelle et accessibilité de base

- Captures pleine page de toutes les pages publiques et des espaces privés à 1440 et 390 px (`pnpm tsx scripts/capture-review.ts --private`, dossier `.impeccable/review/`), relues ; défauts corrigés : nom de marque insécable (public et privé), bouton d’en-tête masqué sous 640 px, planche d’herbier densifiée, étiquette de planche sous l’illustration sur mobile, journal d’audit en français.
- Revue finale Impeccable (agent relecteur indépendant, captures + contrat de direction) : premier verdict « fix » avec sept corrections matérielles (planche tronquée, étiquette en double, composition trop plate, recadrage mobile 4:3, étape en « kicker » sous 768 px, « Version N » en sur-titre, relevés de lieux en pictogrammes), appliquées puis recapturées depuis un build de production ; deux passes de verdict supplémentaires sur la composition du héros (légende numérotée, étiquette ancrée sous la planche) ; verdict final **« ship »** sur l’ensemble des corrections. DESIGN.md et `.impeccable/design.json` produits par l’agent documenteur à partir du système réellement construit.
- Après le dernier lot : 30 parcours rejoués contre le build de production local, puis contre l’image Docker finale (30/30 à chaque fois).
- Bugs trouvés par les parcours automatisés et corrigés : taux de TVA absent du formulaire quand le mode « aucune TVA » désactive le champ ; limite de connexions comptant les succès (désormais seuls les échecs comptent) ; limites anti-abus trop strictes pour une démonstration locale (assouplies en `DEMO_MODE` uniquement) ; `DATABASE_URL` exigée au chargement des modules (désormais seulement à la connexion, ce qui permet `next build` sans base).
- Console navigateur sans erreur ni violation CSP sur le site public (après rechargement complet).
- Navigation clavier et focus visible vérifiés par test automatisé ; labels de formulaires exigés par les sélecteurs `getByLabel` des tests ; `prefers-reduced-motion` désactive l’animation du héros (CSS global).
- Contrastes des paires de couleurs principales calculés à la conception (texte sur ivoire ≥ 5:1, ivoire sur sauge ≥ 7:1, bouton argile ≥ 4.9:1) ; non mesurés par un outil automatique.

## Non exécuté ou non mesurable ici

- Aucun audit Lighthouse ni validateur WCAG complet n’a été lancé : aucune conformité n’est revendiquée.
- Les tests tournent avec Chromium uniquement (WebKit non installé pour éviter un téléchargement supplémentaire).
