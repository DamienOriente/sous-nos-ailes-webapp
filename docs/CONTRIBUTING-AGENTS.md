# Brief commun — travail en parallèle sur Sous Nos Ailes

Lis d'abord `CLAUDE.md` (racine) : conventions, commandes, architecture. Ce document précise le contrat entre modules développés en parallèle.

## Environnement déjà en place
- Infra Docker démarrée : Postgres `localhost:5450` (sna/sna/sna), Redis 6390, MinIO 9010 (sna-minio / sna-minio-local-only, buckets `sna-files`, `sna-quarantine`), Mailpit UI http://localhost:8027 (SMTP 1027), ClamAV 3310.
- `.env` copié depuis `.env.example`. Migration initiale appliquée (`src/db/migrations/0000_init.sql`, 86 tables). Seed de base exécuté : 24 catégories, 4 plans + features, catalogue d'outils, checklists, 14 comptes de démo (`src/db/seed/context.ts`, mot de passe `Demo-SousNosAiles-2026!`).
- Serveur `next dev` déjà lancé sur http://localhost:3200 par le coordinateur (HMR). **Ne lance pas un second `pnpm dev`**, n'utilise pas le panneau navigateur partagé : vérifie avec `curl`, des tests Vitest (`tests/unit`, `tests/integration`) et des specs Playwright dans `e2e/` (exécutables avec `E2E_NO_SERVER=1 pnpm playwright test e2e/<fichier> --project=desktop` contre le dev server).
- Typecheck : `pnpm tsc --noEmit` ; lint : `pnpm lint`. Les deux doivent rester verts sur l'ensemble du dépôt à la fin de ton travail.

## Fichiers partagés : interdits en écriture
`src/db/schema/*` (sauf le fichier explicitement attribué à ton module), `src/db/migrations/*`, `src/lib/*`, `src/components/ui/*`, `src/components/layout/*`, `src/components/shared/*`, `src/app/layout.tsx`, `src/app/(public)/layout.tsx`, `src/app/app/layout.tsx`, `src/app/admin/layout.tsx`, `src/proxy.ts`, `next.config.ts`, `package.json` (sauf ajout de dépendance indispensable : signale-le dans ton rapport), `CLAUDE.md`, `docs/CONTRIBUTING-AGENTS.md`, `src/db/seed/index.ts`, `src/db/seed/core.ts`, `src/db/seed/context.ts`.

Si un fichier partagé doit absolument changer, décris le diff exact dans ton rapport final ; le coordinateur l'appliquera.

## Schéma de données
- Le schéma est dans `src/db/schema/*.ts` (Drizzle, `casing: "snake_case"`). Lis les fichiers de ton module ET ceux dont tu dépends avant de coder.
- **Pas de `drizzle-kit generate`.** Si tu as besoin d'une colonne/table supplémentaire : modifie uniquement le fichier de schéma attribué à ton module, applique avec `pnpm drizzle-kit push` (additif seulement, jamais de suppression/rename de ce qui existe) et liste les changements dans ton rapport. Le coordinateur régénérera la migration unique.
- Les enums Postgres existants ne doivent pas être modifiés (ajoute une table ou une colonne `text` typée si besoin).

## Contrats inter-modules (déjà en place, à utiliser tels quels)
- Identité : `getActor()`, `requireActor(nextPath)` (pages), `requireActorOrThrow()` (actions/routes) dans `@/lib/session`. `Actor = { userId, email, name, globalRole, emailVerified, isDemo }`.
- Autorisation : `@/modules/authorization` → `requireEventPermission(actor, eventId, permission)`, `getEventAccess`, `requireEventMember`, `isChildScopeAssignmentOnly`, `requireProfessionalManage(actor, professionalId)`, `getProfessionalAccess`, `requireGlobalPermission(actor, "moderation.decide")`, `canGlobal`. Catalogue des permissions dans `domain/permissions.ts` (ajoute une permission si nécessaire en respectant la structure ; signale-le).
- Erreurs : `@/lib/errors` (`ValidationError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `PaymentRequiredError`, `toActionError`, `ActionResult<T>`).
- DB : `import { db } from "@/db/client"`, schéma `import { events, ... } from "@/db/schema"`. Services : `async function x(actor: Actor, input: Input, executor: DbExecutor = db)`.
- Audit : insère dans `auditLogs` pour toute modification de droits, statut, suppression, décision de modération (`action`, `resourceType`, `resourceId`, `eventId`/`organizationId`, `metadata` minimale, `reason`).
- Notifications : `notify({ userId, type, title, body?, href?, eventId?, dedupeKey?, email? })` dans `@/modules/notifications/application/notification-service`. E-mails : `enqueueEmail(...)` dans `application/email-outbox` (templates `notification`, `invitation`, `inquiry`, `generic`) ; le worker draine l'outbox. Jamais de donnée de santé ni de contenu de document dans un e-mail.
- Entitlements : `getEffectivePlan(userId, audience, professionalId?)`, `hasFeature`, `requireFeature(actor, audience, featureKey)` dans `@/modules/billing/application/entitlements` ; clés dans `@/modules/billing/domain/plans` (`FEATURES`). Paywall : `<Paywall feature audience description backHref preview? />` dans `@/components/billing/paywall`. Pattern : `try { await requireFeature(...) } catch (e) { if (e instanceof PaymentRequiredError) return <Paywall .../> ; throw e }`.
- Modération : `openModerationCase({ kind, resourceType, resourceId, professionalId?, openedByUserId?, summary? })` dans `@/modules/moderation/application/moderation-service`.
- Fichiers : les autres modules stockent des `fileId` (uuid, table `files`) et utilisent `privateFileHref(fileId)` / `publicImageHref(fileId, variant)` de `@/modules/files/application/file-urls`. L'upload passe par le composant client `FileUpload` (`@/components/files/file-upload`, props `{ scope, scopeId, purpose, accept?, maxFiles?, onUploaded(file: { id, originalName, mimeType, sizeBytes, status }) }`) et la route `POST /api/files/upload` (multipart `file`, `scope`, `scopeId`, `purpose`). Ces deux éléments sont livrés par le module fichiers ; référence-les, ne les réimplémente pas. Tes tests ne doivent pas dépendre d'un upload réel.
- Calendrier : contrats `runCalendarSyncJob(connectionId)` (`modules/calendar/application/sync-engine.ts`) et `dispatchDueReminders()` (`reminders.ts`), appelés par le worker. Rétention : `runRetentionPolicies()` (`modules/privacy/application/retention.ts`).
- Worker/queues : `src/workers/*` est au module fichiers/worker. Pour un traitement asynchrone, utilise la file générique documentée par ce module (`src/workers/queues.ts` : `enqueue(queueName, jobName, data, opts)`) ; en attendant, un appel direct dans l'action est acceptable si court.
- Données de démo : chaque module expose `export async function seed(ctx: SeedContext)` dans `src/db/seed/<module>.ts` (déjà référencé dans `seed/index.ts` : professionals, pages, events, guests, children, collaboration, calendar, billing, files, admin). Idempotent (re-exécutable). Utilise `ctx.users[key]`, `ctx.categories[slug]`, `ctx.plans[key]`, et renseigne `ctx.professionals[key]`, `ctx.events[key]`, `ctx.members["eventKey:userKey"]` pour les suivants. Ordre d'exécution = ordre de la liste. Marque `isDemo: true` partout où la colonne existe.
  - Clés des professionnels de démo (module professionals) : `marie` (Marie Delcourt, garde-enfants-evenementielle, Toulouse), `camille` (wedding-planner, Toulouse), `julien` (traiteur, Albi), `helene` (domaine-reception, Lavaur), `theo` (dj, Montauban), `ines` (photographe, Toulouse), `sofia` (animation-enfants, Bordeaux) + une quinzaine de fiches fictives supplémentaires (slug = clé) sur Toulouse/Bordeaux/Montpellier/Albi.
  - Évènements de démo (module events) : `louisLisa` (Mariage de Louis et Lisa, 2027-06-12, domaine d'Hélène, propriétaire `louis`, coorganisatrice `lisa`, wedding planner `camille`, prestataires `marie` (childcare), `nora` (staff childcare), `julien`, `helene`, `theo`, `ines`), `baptemeChloe` (propriétaire `paul`, prestataire `sofia`), `seminaireDiginumia` (propriétaire `paul`). Membres dans `ctx.members`.
- Routes : espace authentifié sous `/app`, workspace évènement `/app/evenements/[id]/<section>`, workspace fiche pro `/app/pro/[id]/<section>`, admin `/admin/*`, public `/`, `/annuaire`, `/pro/[slug]`, auth `/connexion` `/inscription`…, onboarding `/onboarding/*`. Chaque module ne crée des fichiers que dans les dossiers de routes qui lui sont attribués.
- UI : shadcn (`@/components/ui/*`), kit maison `@/components/shared` (`PageHeader`, `EmptyState`, `StatusBadge`, `StatCard`, `ConfirmDialog`, `SubmitButton`, `FormMessage`, `Container`, `Section`), icônes lucide. Tokens : couleurs `primary` (sauge), `secondary` (sable), `accent` (sauge doux), `blush`, `sky`, `gold`, `success/warning/info`. Place tes composants dans `src/components/<module>/`. Mobile-first, états vides et de chargement (`loading.tsx` avec `Skeleton`), confirmation des actions destructives, labels accessibles.
- Formulaires : server action `"use server"` dans `actions.ts` à côté de la page ; validation Zod (`z.object(...)`, `safeParse`), retour `ActionResult`. Côté client, `useActionState` ou react-hook-form + `@hookform/resolvers/zod` pour les formulaires riches. Toasts via `sonner`.
- Tests attendus : unitaires sur la logique de domaine (pure), intégration sur les services avec la base locale (`tests/integration/<module>.test.ts`, import `./setup` déjà prévu : crée `tests/integration/setup.ts` seulement si absent, en vérifiant d'abord), et au moins une spec Playwright par parcours livré.

## Rapport final attendu (dans ta réponse)
1. Fonctionnalités réellement opérationnelles (testées) vs partielles vs non faites.
2. Fichiers créés (dossiers), schéma modifié (diff), dépendances ajoutées.
3. Tests écrits et résultat d'exécution réel.
4. Points de sécurité/limites connus, validations externes nécessaires.
5. Toute modification demandée sur un fichier partagé (diff exact).

## Chantier « vitalité » (2026-10-17, après la V1)

Objectif : rendre l'application vivante — images, scènes illustrées, exemples et données de démonstration riches — sans jamais inventer de témoignage, de chiffre ou de certification.

Socle disponible :
- **Photos** : `@/modules/media/demo-photos` — catalogue de 75 photos Unsplash vérifiées (`DEMO_PHOTOS`, `demoPhoto(theme, index)`, `categoryPhoto(categorySlug, index)`, `eventPhoto(eventType, index)`, `unsplashUrl(id, {w,h,q})`, `CATEGORY_PHOTO_THEMES`). Composant `DemoPhoto` (`@/components/shared/demo-photo`, `next/image` avec `fill` : donne un conteneur dimensionné, `sizes` adapté, `priority` seulement pour le LCP). Les photos sont réservées aux profils fictifs, aux pages marketing de démo et aux états vides : ne jamais les attacher à un vrai professionnel. Marque « photo de démonstration » dans l'`alt` ou une légende quand le contexte peut prêter à confusion.
- **Illustrations** : `@/components/illustrations` — `WingsScene`, `KidsCornerScene`, `TableScene`, `MusicScene`, `CameraScene`, `FlowersScene`, `CalendarScene`, `ConfettiScene`, `EmptyNestScene` (+ `ILLUSTRATIONS` map). Décoratives (`aria-hidden`) sauf `title` fourni. Tu peux en ajouter dans ce dossier (fichier à ton nom de module, ex. `events-scenes.tsx`) en suivant le même style : formes simples, tokens `--sna-*`.
- Pour mettre de vraies images dans les galeries des pros de démo, le seed `files.ts` peut télécharger les photos du catalogue (`fetch` → `createUpload(..., { process: "inline" })`) avec repli sur les visuels générés si le réseau est absent.
- Règles inchangées : fichiers partagés interdits, pas de `drizzle-kit generate`, `pnpm tsc --noEmit` et `pnpm lint` verts, tests existants verts (`pnpm test`, suites d'intégration/E2E touchées), aucune donnée inventée présentée comme réelle (démo = `isDemo`, étiquetée).

Socle « exemples » réutilisable (ajouté par le chantier vitalité) : `src/components/illustrations/{public-scenes,app-scenes,pro-scenes,event-scenes}.tsx`, `src/modules/tools/domain/tool-examples.ts` (un exemple par outil), `src/components/professionals/listing-examples.ts` (fiches d'exemple par métier), `FEATURE_PREVIEWS` dans `src/components/billing/tool-previews.tsx` (mini-rendus React des outils premium), `src/modules/identity/domain/next-actions.ts` (prochaines actions dérivées des données).

## Chantier « un site qui ne fait pas généré par IA » (2026-10-18)

Demande du propriétaire : le site ne doit pas faire « vibecodé ». Liste à faire disparaître, **dans tout ce que voit un utilisateur** (pages, composants, textes, e-mails, métadonnées, données de démonstration du seed) :

1. **Icônes Lucide décoratives** : plus d'icône dans une pastille/tuile/cercle, sur une carte, un titre de section, une étape, une liste d'avantages, un état vide, une carte de chiffre. On garde uniquement les icônes **fonctionnelles** (entrées de navigation, chevrons, fermer, recherche, menu, copier, télécharger, lien externe, case cochée/alerte d'un formulaire, bouton icône seule avec `aria-label`). À la place : typographie (étapes numérotées « 1 », « 2 »), photos, illustrations SVG existantes, texte. `CategoryIcon` / `icon` de catalogue : ne plus les afficher.
2. **Dégradés** : aucun dégradé de fond, de titre, de bouton, de carte. Aplats unis avec les tokens. Seul reste autorisé : le voile sombre derrière un texte posé sur une photo (lisibilité), le plus discret possible.
3. **Émojis et glyphes décoratifs** (✦ ⚠ ★ ↑ ↓…) dans les titres et l'interface : remplacer par des mots ou rien. (Les émojis dans les messages de conversation de démonstration restent naturels, mais pas dans des titres.)
4. **Glassmorphism** : pas de `backdrop-blur`, pas de fond translucide sur flou. Fonds opaques.
5. **Bordures colorées** : bordure neutre (`border`) uniquement ; pas de trait d'accent à gauche/en haut (`border-l-2 border-primary`…), pas de `border-blush/gold/sage…` décoratifs sur les cartes. Les états sélectionné/focus/erreur gardent leur couleur.
6. **Animations** : transitions de couleur ≤ 150 ms ; pas de zoom/translation/élévation au survol ; aucune animation d'entrée ni apparition au scroll.
7. **Surtitres/badges au-dessus des titres** : plus de petit texte en capitales espacées ou de pastille au-dessus d'un `h1`/`h2`. Le titre commence la section. (`PageHeader` ignore déjà `eyebrow` ; retire aussi les `<p className="… uppercase tracking-…">` placés avant des titres et les pastilles « Nouveau »/« Démo » collées aux titres.)
8. **Buzzwords** : français simple et concret, des faits plutôt que des promesses. Bannis : tout-en-un, révolutionner, puissant, seamless, écosystème, boostez, optimisez, propulsez, expérience inédite, solution complète, next level, « en un clin d'œil », « sereinement » en refrain, séries de trois bénéfices au même rythme. Dis ce que la fonctionnalité fait, pour qui, avec un exemple chiffré ou nommé quand il existe.
9. **Espacement régulier** : utiliser `Container`/`Section` (`src/components/shared/section.tsx`, py-14 sm:py-20) pour les sections de pages ; un seul espace titre→contenu (`mt-8`), grilles de cartes `gap-6`, padding de carte `p-6` (`p-4` pour les cartes denses de l'app). Pas de mélange de `py-8/10/12/16/24` entre sections voisines.
10. **Fade-in au scroll** : aucun (vérifier).
11. **Graphiques** : barres/séries CSS ou SVG maison avec libellés et valeurs, pas de composant de graphique générique.
12. **Polices** : Fraunces (titres) + Figtree (texte) ; Space Grotesk supprimée ; pas de nouvelle famille.
13. **Grain/dégradés texturés** : aucun.
14. **Tirets cadratins « — » (U+2014)** : interdits dans tout texte visible (titres, descriptions, `metadata`, e-mails, gabarits juridiques, données de démonstration du seed, textes d'exemple). Remplacer au cas par cas par une virgule, deux-points, point, parenthèses ou « · » ; valeur vide « — » → « Non renseigné » (texte) ou « n/d » (chiffre). Les noms d'affichage du seed (« Marie Delcourt — Garde d'enfants ») deviennent « Marie Delcourt, garde d'enfants évènementielle ». Ne touche pas aux commentaires de code ni à `docs/`.
15. **Boutons** : actions visibles = `default` (principale) ou `outline` (secondaire) ou lien texte ; `variant="ghost"` seulement pour un bouton icône seule dans une barre d'outils. Survol = changement de couleur opaque.
16. **Pas d'élévation** : aucun `hover:shadow-*`, `hover:-translate-*`, `hover:scale-*`.

Fichiers partagés (ne pas modifier, signale le diff) : `src/components/ui/*`, `src/components/shared/{page-header,stat-card,empty-state,section}.tsx`, `src/app/globals.css`, `src/app/layout.tsx`, `package.json`.
Après modification : `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test`, et mets à jour les specs Playwright dont les libellés changent (`E2E_NO_SERVER=1 pnpm playwright test <spec> --project=desktop --output <dossier isolé>`, serveur de dev déjà lancé sur 3200). Les tirets cadratins changent des libellés : cherche-les dans `e2e/`. Ne relance pas `pnpm db:seed` en parallèle d'un autre agent : seul l'agent « seeds » le fait.
Vérifie chaque point par `grep` sur ta zone avant de rendre ton rapport (donne les comptes avant/après).
