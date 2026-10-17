# Stratégie de tests

Trois niveaux, tous exécutés en CI (`.github/workflows/ci.yml`) et localement.

| Niveau | Outil | Portée | Commande | Durée indicative |
|---|---|---|---|---|
| Unitaire | Vitest (projet `unit`) | logique de domaine pure : permissions, règles de garde, RRULE, tokens, CSV, Markdown restreint, consentement, catalogue analytique, complétude, classement | `pnpm test` | < 5 s |
| Intégration | Vitest (projet `integration`, sériel) | services contre la **base locale réelle** (Postgres + Redis + MinIO) : auth, fichiers (upload + scan), outbox, fiches, pages, modération, garde d'enfants, invitations, calendrier, billing, confidentialité | `pnpm test:integration` | ~1 min |
| End-to-end | Playwright (`desktop` = Chrome, `mobile` = Pixel 7, specs `*.mobile.spec.ts`) + `@axe-core/playwright` | parcours complets contre le build (`pnpm start`) ou le dev server | `pnpm build && pnpm test:e2e` | 5–10 min |

Règles : un service a au moins un test d'intégration ; chaque parcours livré a une spec Playwright ; la logique métier est testée sans IO ; les tests d'intégration nettoient leurs lignes (préfixe `itest-`) ; aucune dépendance à un service externe (Stripe/Google mockés, ClamAV réel en local, désactivé en CI).

## Commandes utiles

```bash
pnpm vitest run --project unit tests/unit/privacy            # un dossier
pnpm vitest run --project integration tests/integration/privacy.test.ts
E2E_NO_SERVER=1 pnpm playwright test e2e/public.spec.ts --project=desktop   # contre pnpm dev déjà lancé
pnpm playwright test --project=mobile                         # specs mobiles seulement
pnpm playwright show-report                                   # rapport HTML (CI : artefact playwright-report)
```

En CI, `webServer` lance `pnpm start` sur le build téléchargé et attend `/api/health`.

## Parcours E2E couverts

| Spec | Parcours |
|---|---|
| `auth.spec.ts` | inscription, e-mail de vérification (Mailpit), connexion, 2FA, réinitialisation, sessions |
| `professional-journey.spec.ts` | onboarding professionnel, fiche, soumission, modération, publication, annuaire |
| `page-builder.spec.ts` | éditeur de page par blocs, templates, aperçu, SEO |
| `admin.spec.ts` | back-office : modération, catégories, offres, rôles, break-glass |
| `invitations.spec.ts` | invitations, RSVP par lien, QR, check-in |
| `seating.spec.ts` | plan de table, export PDF |
| `childcare.spec.ts` | inscription d'enfants, consentement santé, affectation, présences, remise, journal d'accès, portée par affectation |
| `calendar.spec.ts` | agenda, import ICS, export, connexion externe expirée |
| `files.spec.ts` | upload, quarantaine, EICAR rejeté, téléchargement signé |
| `premium.spec.ts` | paywall, mock checkout, résiliation à fin de période |
| `public.spec.ts` | accueil (promesse, recherche, JSON-LD), navigation, pages juridiques (brouillon, sommaire, pas de donnée inventée), bannière cookies (refus = accept en un clic, persistance), préférences `/cookies`, signalement, contact |
| `public.mobile.spec.ts` | accueil mobile sans débordement, menu, bannière, page juridique, signalement |
| `accessibility.spec.ts` | axe-core (WCAG 2.x A/AA + bonnes pratiques) sur accueil, annuaire, connexion, tarifs, page légale, signalement — en clair **et** en sombre ; 0 violation `serious`/`critical` exigée |

## Données

Les tests d'intégration et e2e utilisent la base locale seedée (`pnpm db:seed`, `DEMO_MODE=true`) : comptes `@sousnosailes.test`, mot de passe de démo, évènements `louisLisa`, `baptemeChloe`, `seminaireDiginumia`. Les specs e2e authentifiées réutilisent des états de session (`e2e/.auth/*.json`, ignorés par git) pour ne pas déclencher le rate limit de connexion (5/min/IP).

## État au 2026-10-17 (module conformité)

- `tests/unit/{legal,privacy,analytics}` : 22 tests ✅
- `tests/integration/privacy.test.ts` : 5 tests ✅ (export sans données tierces ni enfants, anonymisation + idempotence, journal `retention_jobs`, DSR +30 j / doublon / transitions / audit, consentement + gate analytique)
- `e2e/public.spec.ts` + `public.mobile.spec.ts` : ✅ contre le dev server
- `e2e/accessibility.spec.ts` : ✅ en mode clair sur les pages du module ; ❌ violations de contraste **héritées de composants partagés** (bannière de démo `text-warning-foreground` en mode sombre ; badges `success`/`info` à 12 px sur l'annuaire et les pages publiées) — correctifs proposés dans le rapport de livraison, la spec reste exigeante pour les faire corriger.

## Ce qui n'est pas testé automatiquement

Envoi SMTP réel, Stripe réel, OAuth Google/Microsoft réel, restauration de sauvegarde (script manuel exécuté et consigné dans [backup-restore.md](backup-restore.md)), audit d'accessibilité manuel (lecteur d'écran), charge (`scripts/load-test.ts` existe mais hors CI).


## Limites de débit et tests

Hors production, les limites d'authentification sont relâchées (300 connexions ou inscriptions par minute et par IP) pour que les suites puissent enchaîner les connexions. Le test `e2e/auth.spec.ts` « 6 mauvais mots de passe → 429 » est ignoré par défaut : lancez le serveur avec `AUTH_RATE_LIMIT_STRICT=true` et la suite avec `E2E_STRICT_RATE_LIMIT=1` pour l'exercer (limites de production : 10 connexions et 5 inscriptions par minute et par IP).

## Résultats de la dernière exécution complète (2026-10-17, build de production local)

- Unitaires : 287/287 (`pnpm test`). Intégration : 114/114 (`pnpm test:integration`, Postgres/Redis/MinIO/ClamAV/Mailpit locaux).
- E2E : 55 réussis, 1 ignoré (429, voir ci-dessus), 1 instable sous charge de la suite complète (`organizer-journey`, étape messagerie ; passe seul).
- Charge (`scripts/load-test.ts`, 30 connexions simultanées, 15 s, build de prod) : 166 req/s, 0 erreur ; p95 accueil 212 ms, annuaire 348 ms, page pro 297 ms.
- Lighthouse mobile (Chrome headless, build de prod, indexation activée) : accueil perf 92 / accessibilité 100 / bonnes pratiques 100 / SEO 100 ; annuaire 91 / 100 / 92 / 100 ; page pro de démo 87 / 100 / 96 / 66 (SEO 66 = `noindex` volontaire des fiches de démonstration). LCP simulé 2,9–3,4 s sur mobile lent : objectif 2,5 s non atteint, à travailler (polices variables, hero).
