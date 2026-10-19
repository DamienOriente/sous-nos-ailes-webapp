# Sécurité

Mesures implémentées, mises en regard de l'OWASP ASVS 5.0 (niveau visé : L2), du Top 10 2021 et de l'API Security Top 10 2023. « Preuve » = test ou fichier qui vérifie la mesure. Les limites connues sont listées en fin de document ; le modèle de menaces par surface est dans [threat-model.md](threat-model.md).

## Authentification (ASVS V6 · A07)

| Mesure | Implémentation | Preuve |
|---|---|---|
| Bibliothèque maintenue, pas de crypto maison | better-auth 1.7 (`src/lib/auth.ts`), adaptateur Drizzle | `tests/unit/identity/auth-domain.test.ts`, `e2e/auth.spec.ts` |
| Mot de passe 10–128 caractères, haché par better-auth | `emailAndPassword.minPasswordLength` | e2e auth |
| Vérification d'e-mail obligatoire en production, lien expirant 24 h | `emailVerification`, `requireEmailVerification: isProduction` | e2e auth (Mailpit) |
| 2FA TOTP + codes de secours, verrouillage après échecs | plugin `twoFactor`, table `two_factors` (`failed_verification_count`, `locked_until`) | e2e auth |
| Rate limiting connexion / inscription / reset / TOTP | better-auth `rateLimit` sur stockage Redis (5/min connexion, 3/5 min reset) + repli DB `login_attempts` | observé en e2e (429) |
| Réinitialisation : lien 1 h, sessions révoquées après changement | `revokeSessionsOnPasswordReset` | e2e auth |
| Journal de sécurité | `security_events` (connexions échouées, rate limit, accès refusés, signatures webhook invalides, fichiers rejetés), plugin `auth-security-plugin.ts` | admin `/admin/securite` |

## Sessions (ASVS V7)

Cookies `HttpOnly`, `SameSite=Lax`, `Secure` en production, préfixe `sna`, durée 7 j avec renouvellement glissant 24 h, cache cookie 5 min, révocation par l'utilisateur (`/app/compte/securite`) et par l'admin (`/admin/securite/sessions`). Les sessions expirées sont purgées chaque nuit. L'impersonation (plugin admin) est tracée (`sessions.impersonated_by`).

## Contrôle d'accès (ASVS V8 · A01 · API1/API5)

| Mesure | Implémentation | Preuve |
|---|---|---|
| Deny by default, vérification côté serveur à chaque accès | `modules/authorization` : `requireEventPermission`, `requireProfessionalManage`, `requireGlobalPermission` ; aucune décision prise côté client | `tests/unit/events/permissions.test.ts`, `tests/integration/*` |
| Anti-énumération (BOLA) | non-membre ⇒ `NotFoundError` identique à un id inexistant | tests d'isolation (`louis` vs `paul`) |
| RBAC par rôle d'évènement + ABAC (métier, surcharges allow/deny expirables, portée enfant) | `resolveEventPermissions`, `CHILD_ASSIGNMENT_SCOPED` | matrice [rbac-permissions.md](rbac-permissions.md) générée depuis le code |
| Rôles globaux sans droit implicite sur les évènements ; break-glass réservé `super_admin`, journalisé | `admin.break_glass`, `/admin/securite/break-glass` | `e2e/admin.spec.ts` |
| Fichiers servis uniquement après autorisation sur le scope | `/api/files/[id]` → vérification → URL signée courte ; images publiques seulement pour fiches publiées | `tests/integration/files.test.ts`, `e2e/files.spec.ts` |
| Droits Premium côté serveur | `requireFeature` / `getEffectivePlan` ; le checkout ne donne jamais un droit | `tests/integration/billing.test.ts`, `e2e/premium.spec.ts` |

## Validation et injection (ASVS V5 · A03 · API8)

- Zod 4 sur toutes les entrées (server actions, route handlers, env, contenu de page, propriétés analytiques). `safeParse` + erreurs de champ, jamais d'exception brute vers le client.
- Drizzle : requêtes paramétrées ; `sql\`\`` uniquement avec des valeurs liées.
- Pas de HTML libre : pages pro = arbre de blocs validé ; pages juridiques = Markdown restreint (titres, paragraphes, listes, gras/italique, liens `https:` / `mailto:` / internes) rendu par React sans `dangerouslySetInnerHTML` (`modules/legal/domain/markdown.ts`, `tests/unit/legal`). Le seul `dangerouslySetInnerHTML` du projet est le JSON-LD de l'accueil (constantes, `<` échappé).
- Uploads : type détecté par signature (`file-type`), extensions/MIME autorisés par finalité, taille maximale par finalité, archives Office et PDF inspectés (`tests/unit/files/*`), quarantaine + ClamAV avant mise à disposition, nom de stockage UUID.
- Limite de corps des server actions 2 Mo (`next.config.ts`).

## Cryptographie (ASVS V11)

AES-256-GCM colonne par colonne pour les données de santé et jetons OAuth ; HMAC-SHA256 des jetons d'invitation ; `timingSafeEqual` pour les comparaisons ; `randomBytes` pour les jetons ; clés via `BETTER_AUTH_SECRET` / `DATA_ENCRYPTION_KEY` (obligatoires en production, générées dans `.secrets/` en local). Rotation : [operations.md](operations.md).

## En-têtes, CSP, transport (ASVS V3/V14 · A05)

- `proxy.ts` : CSP par requête avec nonce et `strict-dynamic` en production (`script-src 'self' 'nonce-…' https://js.stripe.com`), `frame-ancestors 'none'`, `form-action` limité, `object-src 'none'`, `upgrade-insecure-requests`, HSTS 2 ans preload.
- `next.config.ts` : `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restrictive, `poweredByHeader: false`.
- `trustedOrigins` better-auth = `APP_URL` ; `APP_URL` doit être https en production (validation env).
- Preuve : `curl -I` sur n'importe quelle page ; `e2e/public.spec.ts` charge les pages avec la CSP active (un script inline non nonce casserait le rendu).

## Logs, audit, secrets (ASVS V7.1/V16 · A09)

- pino avec rédaction (`authorization`, `cookie`, `password`, `token`, `secret`, `email`, `healthNotes`) ; JSON en production.
- `audit_logs` pour les changements de droits, statuts, suppressions, décisions de modération, demandes RGPD, exports ; `child_access_logs` pour chaque lecture de donnée de santé ; `file_access_logs` pour les téléchargements sensibles.
- Aucun secret en dépôt : `.env` ignoré, `gitleaks` en CI, `pnpm audit` rapporté, CodeQL.
- Jamais de donnée de santé, de secret ni de contenu de document dans les e-mails, notifications, QR codes, URLs, logs.

## Dépendances et chaîne logicielle (A06 · A08)

`pnpm install --frozen-lockfile`, `minimumReleaseAge` 24 h (pnpm 12), Dependabot hebdomadaire groupé, `pnpm audit --audit-level=high` en CI (non bloquant mais rapporté), CodeQL JS/TS, images Docker épinglées (`node:22-alpine`, `postgres:17-alpine`), conteneurs non-root.

## Intégrations tierces (API2/API10)

- Stripe : webhooks vérifiés par signature (`STRIPE_WEBHOOK_SECRET`), idempotents (`billing_events.external_event_id` unique), mode test uniquement.
- Google / Microsoft : OAuth 2.0 avec `state` signé, scopes minimaux calendrier, jetons chiffrés, révocation depuis `/app/calendrier/connexions`.
- SMTP : transport nodemailer sans pièce jointe, `List-Unsubscribe` pour les notifications optionnelles.

## Formulaires publics et abus (API4)

Rate limit Redis (fail-closed) sur contact (5/h/IP), signalement (10/h/IP), demandes publiques et check-in ; champ pot de miel ; messages d'erreur génériques ; e-mails de confirmation uniquement vers l'adresse saisie par le déclarant.

## Conformité données (A04)

Minimisation (âge sans date de naissance, décomptes alimentaires anonymisés, IP tronquée dans les preuves de consentement), chiffrement, rétention automatisée journalisée, export et droits en libre-service : voir [privacy.md](privacy.md).

## Limites connues et travail restant

| Limite | Impact | Piste |
|---|---|---|
| Pas de RLS PostgreSQL | une requête mal filtrée dans un service n'a pas de second filet | plan V2 dans [database.md](database.md) |
| Pas de passkeys / WebAuthn | 2FA TOTP seulement | plugin better-auth passkey |
| Rate limiting par IP | partagé derrière un NAT, contournable avec des IP multiples | ajouter des limites par compte/e-mail (déjà le cas pour la connexion) et un captcha accessible si abus constaté |
| Audit d'accessibilité et test d'intrusion non réalisés | voir `/accessibilite`, [legal-review.md](legal-review.md) | prestataires externes avant ouverture commerciale |
| `CLAMAV_ENABLED=false` possible hors production | les scans sont marqués `skipped` en local/CI ; en production le code bloque tout fichier dont le scan échoue | conserver ; tester EICAR à chaque montée de version |
| Contrastes : `--warning-foreground` en mode sombre et badges `success`/`info` à 12 px | violations axe « serious » sur la bannière de démo et les badges | diff proposé dans le rapport de livraison (tokens partagés) |
| `drizzle-kit push` utilisé en local par les modules | migration unique à régénérer avant déploiement | `pnpm db:generate` |
