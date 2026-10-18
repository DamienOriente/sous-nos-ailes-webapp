# État d'avancement — tableau de couverture

Statuts : ✅ Implémenté et testé · 🔶 Implémenté, vérification externe nécessaire · 🟡 Partiellement implémenté · ⬜ Non implémenté · ⛔ Bloqué par une décision ou validation externe

Dernière mise à jour : 2026-10-17 (fin de la mission V1). Preuves : `pnpm test` 287/287, `pnpm test:integration` 114/114, Playwright 55 réussis + 1 ignoré + 1 instable, détails dans `docs/testing.md`.

## Comptes, identité, autorisations

| Fonctionnalité | Statut | Preuve / limite |
|---|---|---|
| Inscription, connexion, vérification e-mail, réinitialisation, « se souvenir de moi » | ✅ | `e2e/auth.spec.ts`, Mailpit |
| 2FA TOTP + codes de secours (activation, vérification, désactivation) | ✅ | `e2e/auth.spec.ts` |
| Passkeys | ⬜ | Non implémenté en V1 (décision : bibliothèque séparée `@better-auth/passkey`, à évaluer) |
| Sessions : HttpOnly, SameSite, rotation, révocation unitaire/globale, expiration | ✅ | better-auth + Redis, `tests/integration/identity.test.ts` |
| Limitation des tentatives (429 avec compte à rebours) | ✅ | Limites de prod 10/min (connexion) et 5/min (inscription) par IP ; relâchées hors prod, test gated `E2E_STRICT_RATE_LIMIT` |
| Journal de sécurité (connexions, 2FA, sessions) | ✅ | `security_events`, plugin better-auth `auth-security-plugin.ts` |
| Rôles globaux (user, moderator, admin, super_admin) + matrice de permissions | ✅ | `docs/rbac-permissions.md` générée depuis le code |
| RBAC + ABAC évènement (rôles, métier, grants/denies explicites, expiration) | ✅ | `tests/unit/events/permissions`, `tests/integration/isolation.test.ts` (Scénario D) |
| Isolation multi-tenant, anti-IDOR (NotFound identique) | ✅ | Scénario D, tests pro/contacts/invitations/enfants |
| Exigence 2FA pour rôles privilégiés | 🟡 | Redirection bloquante en production, bannière en local/démo |

## Inscription et onboarding

| Fonctionnalité | Statut | Preuve / limite |
|---|---|---|
| Choix d'intention (organisateur / professionnel), compte unique multi-casquettes | ✅ | `/onboarding` |
| Onboarding organisateur progressif → espace évènement, checklist, canaux, budget, calendrier | ✅ | `e2e/organizer-journey.spec.ts` (Scénario A) |
| Onboarding professionnel 5 étapes, formulaire conditionnel par métier, SIRET Luhn, géo statique | ✅ | `e2e/professional-journey.spec.ts` (Scénario B) |
| Présélection de template par métier | ✅ | `categories.suggestedTemplates`, `ensurePublicProfile` |
| Statuts de fiche (brouillon → vérification → … → archivé) | ✅ | `tests/unit/professionals/status` |

## Annuaire, fiches, pages, SEO

| Fonctionnalité | Statut | Preuve / limite |
|---|---|---|
| 24 catégories admin-gérables, groupes, garde d'enfants prioritaire | ✅ | seed + CRUD admin |
| Recherche texte (tsvector français), filtres (catégorie, département, ville, rayon, date, prix, enfants, langues, vérification, favoris), pagination | ✅ | `tests/integration/professionals.test.ts` |
| Classement documenté + résultats sponsorisés étiquetés et plafonnés | ✅ | `domain/ranking.ts`, `featured_placements` |
| Niveaux de vérification précis (jamais « certifié ») | ✅ | test unitaire sur les libellés |
| Avis liés à une interaction, modération, droit de réponse, signalement | ✅ | seed + admin |
| Pages géographiques uniquement si ≥ 1 pro publié | ✅ | 404 réels sinon |
| Schéma de blocs versionné, sans HTML/JS libre | ✅ | `tests/unit/pages/page-schema` |
| 24 templates distincts (compositions, palettes AA clair/sombre) + galerie `/templates` | ✅ | 26 composants, test palettes |
| Constructeur (réordonnancement, blocs, images, thème, autosave, soumission) | ✅ | `e2e/page-builder.spec.ts` |
| Modération sans dépublication de la version en ligne | ✅ | `tests/integration/pages.test.ts`, `moderation.test.ts` |
| SEO : metadata, canonical, OG image, JSON-LD, sitemap/robots dynamiques, noindex démo/privé | ✅ | Lighthouse SEO 100 (accueil, annuaire) |
| Assistant SEO (score explicable, suggestions, aperçu Google, « conseil » vs « vérifié ») | ✅ | Premium derrière `seo.assistant` |
| Score de complétude explicable | ✅ | `tests/unit/pages/completeness` |

## Évènements et collaboration

| Fonctionnalité | Statut | Preuve / limite |
|---|---|---|
| Tour de contrôle (KPIs, alertes, échéances, validations) | ✅ | `tests/integration/events.test.ts` |
| Tâches (sections, assignation, commentaires, visibilité équipe) | ✅ | idem |
| Planning du jour J + export ICS + notifications de changement | ✅ | idem |
| Prestataires (plateforme/externe, devis, contrat, invitation sécurisée, révocation) | ✅ | Scénario A, token usage unique |
| Budget (lignes, dépenses, justificatifs) ; comparaison/export en Plus | ✅ | Paywall `budget.advanced` |
| Équipe : rôles, grants/denies explicites avec expiration, journal d'audit, transfert | ✅ | Scénario D |
| Documents (visibilité par rôle/prestataire) | ✅ | contrat fichiers |
| Messagerie : canaux, mentions, pièces jointes, signalement, recherche, bannière de supervision | ✅ | polling 10 s (pas de websocket) |
| Demandes commerciales vues depuis l'évènement | ✅ | `/demandes` |
| Statut HTTP 404 pour un évènement inaccessible | 🟡 | Contenu 404 identique mais statut 200 (streaming avec `loading.tsx`) ; route handlers en vrai 404 |

## Invités, invitations, QR, plan de table, contacts

| Fonctionnalité | Statut | Preuve / limite |
|---|---|---|
| Contacts (CRUD, tags, import/export CSV, doublons/fusion, portée perso/organisation, limite de plan) | ✅ | `tests/unit/contacts`, intégration IDOR |
| Invités, groupes, RSVP, import CSV, export | ✅ | seed 60 invités |
| Invitations individuelles/familiales/groupe, 4 templates, e-mail, relance plafonnée, révocation, PDF | ✅ | `e2e/invitations.spec.ts` |
| Lien RSVP public sécurisé (hash en base, expiration) | ✅ | `tests/integration/invitations.test.ts` |
| QR code sans donnée personnelle, usage unique, validation serveur, doublon/révoqué/expiré, historique | ✅ | Scénario A étapes 11-13 |
| Scan caméra (`BarcodeDetector`) | 🔶 | Code prêt, non testable sans HTTPS + caméra ; saisie manuelle testée |
| Plan de table : SVG, souris + tactile, méthode accessible, capacité, undo, impression, PDF | ✅ | `e2e/seating.spec.ts` |
| Entitlements Plus (plan de table, QR, invitations personnalisées) | ✅ | `e2e/premium.spec.ts` |

## Garde d'enfants (priorité)

| Fonctionnalité | Statut | Preuve / limite |
|---|---|---|
| Enfants (minimisation : âge, pas de date de naissance), tuteurs, contacts d'urgence, personnes autorisées | ✅ | `tests/integration/childcare.test.ts` |
| Données de santé chiffrées AES-256-GCM, consentement explicite, retrait, motif + journal d'accès | ✅ | idem (refus sans consentement / permission / affectation) |
| Portée par affectation pour la team childcare, organisateurs voient tout | ✅ | Scénario D volet enfants |
| Présences (check-in/out, incidents), remise en 3 étapes sans QR, historique | ✅ | `e2e/childcare.spec.ts` |
| Procédure d'urgence, programme d'activités, décompte alimentaire anonyme (traiteur) | ✅ | |
| Anonymisation à J+30 (configurable) | ✅ | `runRetentionPolicies`, worker 03:00 |

## Calendrier et outils métier

| Fonctionnalité | Statut | Preuve / limite |
|---|---|---|
| Calendrier interne jour/semaine/mois/agenda, récurrence RRULE (DST Europe/Paris), conflits, rappels | ✅ | `tests/unit/calendar/rrule` |
| Export ICS, import ICS validé | ✅ | `e2e/calendar.spec.ts` |
| Google Calendar / Microsoft Graph : OAuth PKCE, jetons chiffrés, moteur de sync (fingerprint, conflits, suppressions, curseurs) | 🔶 | Testé avec `fetch` mocké uniquement ; aucune clé réelle disponible (`docs/integrations.md`) |
| Outils traiteur, lieu, DJ/musique, matériel, photo/vidéo | ✅ | CRUD, accès par métier |
| Catalogue d'outils admin, activation par métier/rôle/abonnement | ✅ | |

## Fichiers, notifications, workers

| Fonctionnalité | Statut | Preuve / limite |
|---|---|---|
| Pipeline d'upload : auth → scope → limites/quotas → quarantaine → type réel → ClamAV → heuristiques PDF/zip → optimisation sharp/EXIF → UUID → bucket privé → URL signée | ✅ | Scénario E (`tests/integration/files.test.ts`, EICAR) |
| Réception en streaming vers S3 | 🟡 | Lecture en mémoire bornée (20 Mo) puis PutObject |
| Accès signé court, 404 sans fuite, journal d'accès, limitation des téléchargements | ✅ | |
| Notifications in-app, préférences, dédup, outbox e-mail avec retry, séparation marketing | ✅ | `tests/integration/outbox.test.ts` |
| Workers BullMQ (scan, e-mails, rappels, synchro calendriers, rétention), heartbeat dans `/api/health` | ✅ | vérifié en prod locale |

## Monétisation et administration

| Fonctionnalité | Statut | Preuve / limite |
|---|---|---|
| Offres configurables (4 plans, matrice de features/limites, promos, sponsorisés) | ✅ | admin `/admin/offres` |
| Stripe Checkout / portail / webhooks signés, idempotents, état des abonnements | 🔶 | Scénario C vérifié avec SDK mocké ; parcours réel à rejouer avec des clés de test (`docs/billing.md`) |
| Provider mock étiqueté sans clé Stripe | ✅ | `e2e/premium.spec.ts` |
| Droits vérifiés côté serveur, maintien jusqu'à échéance, expiration | ✅ | `tests/integration/billing.test.ts` |
| Paiement réel | ⛔ | `billing.live_enabled`, clés live, CGV/médiateur/mentions à valider |
| Tableau de bord admin (données réelles, démo étiquetée) | ✅ | |
| Utilisateurs (suspension, rôles, sessions, historique, recours) | ✅ | `e2e/admin.spec.ts` |
| File de modération, décisions motivées, vérifications par `kind`, justificatifs, avis, messages signalés | ✅ | `tests/integration/moderation.test.ts` |
| Signalements publics et recours | ✅ | |
| Break-glass super_admin (motif, durée ≤ 4 h, notification du propriétaire, expiration automatique) | ✅ | worker `retention` |
| Contenus éditoriaux (Markdown restreint, variables légales) | ✅ | |

## Conformité et site public

| Fonctionnalité | Statut | Preuve / limite |
|---|---|---|
| Accueil, pages organiser/professionnels/à propos/contact/accessibilité/signalement | ✅ | `e2e/public*.spec.ts`, axe 0 violation |
| Documents juridiques (10) en brouillons à variables, mention de validation juridique | ⛔ | Validation par un professionnel du droit requise (`docs/legal-review.md`) |
| Bannière cookies (refus = accepter, preuve en base, aucun traceur) | ✅ | |
| Droits RGPD : export JSON, DSR (30 j), consentements, suppression via DSR | ✅ | `tests/integration/privacy.test.ts` |
| Rétention automatisée journalisée | ✅ | |
| Registre des traitements, AIPD initiale mineurs | 🔶 | Rédigés, à valider (`docs/privacy.md`) |
| Analytique produit minimisée, consent-aware | 🟡 | Catalogue + métriques ; instrumentation partielle des modules |
| Accessibilité WCAG 2.2 AA | 🟡 | axe + Lighthouse 100 sur les pages publiques testées ; audit manuel complet non réalisé |

## Infrastructure et qualité

| Élément | Statut | Preuve / limite |
|---|---|---|
| Docker Compose dev (Postgres, Redis, MinIO, Mailpit, ClamAV) + images runner/worker/migrator non-root | ✅ | images construites localement |
| CI GitHub Actions (typecheck, lint, unit, build, intégration + E2E, audit, gitleaks, CodeQL) | 🔶 | Rédigée, non exécutée sur GitHub (pas de push) |
| Sauvegarde chiffrée + restauration testée | ✅ | drill réel consigné dans `docs/backup-restore.md` |
| Test de charge et Lighthouse | ✅ | `docs/testing.md` ; LCP mobile simulé 2,9–3,4 s (objectif 2,5 s non atteint) |
| Audit dépendances | 🟡 | 1 alerte « high » restante sans correctif publié (`braces` via eslint-config-next, outil de dev uniquement) |
| RLS PostgreSQL | ⬜ | Étudiée, non activée (`docs/security.md`) |
| Pentest indépendant | ⬜ | À planifier avant ouverture commerciale |

## Vitalité (images, exemples, données de démo) — 2026-10-17

| Élément | Statut | Preuve / limite |
|---|---|---|
| Catalogue de 74 photos de démonstration vérifiées + composant `DemoPhoto` | ✅ | `docs/assets.md` ; à remplacer par des visuels sous licence avant commercialisation |
| Illustrations SVG originales (9 scènes de base + scènes public/app/pro/évènements) | ✅ | `src/components/illustrations/*` |
| Accueil, organiser, professionnels, annuaire illustrés avec exemples réels (évènement et fiches de démo étiquetés) | ✅ | `e2e/public*.spec.ts`, `e2e/accessibility.spec.ts` |
| Fiches de démo avec vraies photos (couverture, galerie), 48 avis publiés liés à des demandes, pages et 24 templates avec photos | ✅ | seed `files.ts`/`professionals-data.ts`/`pages.ts`, `e2e/page-builder.spec.ts` |
| Espaces évènements : couverture, tableau de bord visuel, états vides illustrés, chips d'exemples réels, seed riche | ✅ | `e2e/vitality.spec.ts`, intégration events |
| Onboarding illustré avec « Utiliser cet exemple », pages auth en écran partagé, `/app` avec prochaines actions, paywalls avec aperçus React, admin avec sparklines | ✅ | `e2e/auth`, `premium`, `admin` |
| Images du pipeline fichiers via `next/image` optimisé | 🟡 | rendues `unoptimized` (variantes WebP côté serveur) ; `images.localPatterns` à évaluer |


## Vitesse des pages (2026-10-18)

Lighthouse mobile (4G lente simulée, build de production, Chrome headless), avant puis après :

| Page | Score | LCP | CLS |
|------|-------|-----|-----|
| / | 91 puis 92 | 3,3 s puis 3,3 s | 0 |
| /annuaire | 94 puis 93 | 2,9 s puis 3,2 s | 0 |
| /annuaire/traiteur | 90 puis 93 | 3,5 s puis 3,2 s | 0 |
| /pro/marie-delcourt-garde-enfants | 79 puis 88 | 5,1 s puis 3,8 s | 0,083 puis 0 |
| /organiser | 89 puis 93 | 3,6 s puis 3,2 s | 0 |
| /tarifs | 93 puis 92 | 3,1 s puis 3,4 s | 0,055 puis 0 |

Les mesures varient de quelques points d'un passage à l'autre. L'objectif de 2,5 s pour le LCP n'est pas atteint en mobile simulé ; le reste du temps est le coût du premier octet de CSS et de la photo principale.

## Fiches et agences (2026-10-18)

| Élément | État |
|---|---|
| Une fiche par indépendant (création, onboarding, soumission) | Fait, testé (intégration + E2E) |
| Statut agence demandé, relu par la modération | Fait, testé |
| Abonnement agence à paliers dégressifs, quantité synchronisée | Fait en mode simulé, testé ; Stripe test à valider avec de vraies clés |
| Retenue des fiches en cas d'impayé et retour au paiement | Fait, testé |
| Paliers modifiables dans l'admin, barème sur /tarifs | Fait, testé |
| Invitation de collaborateurs dans une agence | Non fait (hors périmètre de cette itération) |
| Vérification automatique du SIRET (API Sirene) | Non fait, contrôle manuel par la modération |

## Brief, disponibilité réelle et comparateur de devis (2026-10-18)

| Élément | État |
|---|---|
| Brief de l'évènement édité une fois, budget envoyé seulement si l'organisateur le choisit | Fait, testé (intégration + E2E) |
| Envoi du brief à plusieurs pros (liste de l'évènement et favoris), sans doublon | Fait, testé |
| Brief joint depuis la page publique d'un pro, instantané visible côté pro | Fait, testé |
| Recherche par date sur la disponibilité réelle (grille, indisponibilités, réservations, agendas synchronisés, options) | Fait, testé ; les récurrences (RRULE) des entrées d'agenda ne sont pas dépliées |
| Option de 48 h : pose, confirmation ou libération par le pro, expiration automatique (worker, toutes les 15 min) | Fait, testé |
| Devis au format commun (lignes, inclus, non inclus, acompte, solde, annulation, validité), versionné | Fait, testé |
| Comparateur côte à côte par métier, acceptation et refus par l'organisateur | Fait, testé |

