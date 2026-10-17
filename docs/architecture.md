# Architecture — Les Petits Invités

Monolithe modulaire Next.js 16 (App Router) + PostgreSQL, sans microservice ni dépendance superflue.

## Couches

| Couche | Dossier | Rôle |
|---|---|---|
| Interface | `src/app/**`, `src/components/**` | Server Components par défaut ; composants clients uniquement pour l’interaction (formulaires `useActionState`, menu mobile, éditeur de proposition). |
| Entrées | `src/server/actions/**` | Server Actions : vérifient la session, valident avec Zod, appellent un service, `revalidatePath`. Aucune logique métier. |
| Validation | `src/validation/**` | Schémas Zod 4 (formulaire public, admin, auth). |
| Autorisations | `src/server/authz.ts`, services | `requireAdmin/requireProvider/requirePartner/requireUser` côté pages ; chaque service filtre par propriétaire (`clientId`, `providerId`, `partnerUserId`). L’identifiant venant du navigateur n’est jamais une preuve. |
| Services | `src/server/services/**` | Logique métier persistante : demandes, événements, devis versionnés, invitations, affectations (transaction + verrou), lieux, attribution, candidatures, notes, audit, paramètres. |
| Domaine pur | `src/domain/**` | Fonctions pures testées : tarification (centimes), transitions de statut, chevauchements et marge, effectifs, checklist adaptative, indicateur de préparation, libellés FR. |
| Infra | `src/lib/**` | env (lazy, garde-fous prod), Prisma (singleton lazy), auth (sessions, scrypt, liens magiques), mail (Mailpit), temps (UTC ↔ Europe/Paris), argent, rate limiting, logger. |
| Données | `prisma/schema.prisma`, `prisma/migrations` | PostgreSQL via Prisma 7 + adaptateur `pg`. Montants en centimes, instants en UTC, dates civiles en `@db.Date`. |

## Flux principaux

1. **Demande publique** : formulaire guidé (client) → `submitQuoteRequest` (action, rate limit, honeypot, temps de saisie minimal, idempotence `submissionKey`) → `submitEventRequest` (transaction : utilisateur client trouvé/créé, référence `LPI-AAAA-NNNN` via compteur verrouillé, `EventRequest` immuable + `Event`, `Referral` si apport partenaire validé côté serveur, checklist) → emails (accusé avec lien magique, notification Marie) consultables dans Mailpit.
2. **Proposition** : `getOrCreateDraft` (lignes suggérées par le moteur tarifaire) → édition du brouillon → `sendVersion` (version figée `SENT`, précédente `SUPERSEDED`, événement `PROPOSAL_SENT`, email client) → `acceptVersion` par le client (`ACCEPTED`, événement `AGREED`, email Marie). Les versions transmises ne sont jamais modifiées.
3. **Équipe** : `suggestProvidersForEvent` (critères explicites : disponibilité déclarée, vérification manuelle, secteur, qualifications vérifiées ; jamais de caractéristique personnelle) → `inviteProviders` (email + lien magique) → réponse de l’intervenant → `assignProvider` (transaction `SELECT … FOR UPDATE` sur l’intervenant, détection de chevauchement avec marge de déplacement, refus si équipe complète). Statut d’équipe calculé séparément du statut commercial.
4. **Confirmation** : `checkConfirmation` exige accord de principe sur la proposition courante, équipe complète, absence de conflit bloquant, date fixée et validation opérationnelle de Marie ; les blocages sont listés en clair.

## Sécurité

- Sessions opaques en base (hash HMAC), cookie `lpi_session` HttpOnly/SameSite=Lax/Secure en prod, expiration glissante, révocation.
- Liens de connexion : aléatoires, hachés, usage unique, 20 min, consommés par POST (pas par le GET du lien).
- CSP avec nonce par requête (`src/proxy.ts`), en-têtes HSTS (prod)/nosniff/frame DENY/Referrer-Policy/Permissions-Policy (`next.config.ts`).
- CSRF : Server Actions (contrôle Origin/Host natif de Next.js) ; aucune route de mutation GET.
- Rate limiting en mémoire par IP hachée (mono-instance ; passer à un stockage partagé en multi-instance).
- Contenus éditables stockés en texte brut, rendus via React (échappement), jamais de HTML arbitraire.
- Journal d’audit minimal (`AuditEvent`) sans payload ; logs structurés sans données utilisateur.
- `DEMO_MODE` refusé si `APP_ENV=production` ; secrets de session générés localement (`.secrets/`, 600) ou fournis par l’environnement en production.

## Exécution

- Docker Compose : `db` (PostgreSQL 17), `mailpit`, `migrate` (migrations + seed), `app` (image standalone). Ports liés à 127.0.0.1 uniquement.
- Hors Docker : `docker compose up -d db mailpit` puis `pnpm dev` (port 3100).

## Limites connues

- Rate limiting et cache en mémoire : valables pour un processus unique.
- Pas de file d’attente d’emails : l’envoi est synchrone vers Mailpit (échec journalisé dans `OutboundEmail`, jamais bloquant).
- Rendu entièrement dynamique (pas de cache de pages) : acceptable à cette échelle.
