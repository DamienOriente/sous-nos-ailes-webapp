# Intégrations externes

Toutes les intégrations sont **optionnelles ou simulées en local** ; l'application démarre sans aucune clé tierce. Les variables sont validées par `src/lib/env.ts` ; les drapeaux `stripeConfigured`, `googleConfigured`, `microsoftConfigured` pilotent l'activation.

| Intégration | Variables | Activation | Local / CI | Testé comment |
|---|---|---|---|---|
| **PostgreSQL** | `DATABASE_URL`, `DATABASE_POOL_MAX` | toujours | docker `postgres:17-alpine` (5450) ; service GitHub Actions | tests d'intégration réels |
| **Redis** | `REDIS_URL` | toujours (queues, rate limit, cache auth) | docker `redis:7-alpine` (6390) | intégration + worker |
| **S3** | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_QUARANTINE_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_FORCE_PATH_STYLE` | toujours | MinIO (9010), buckets créés par `minio-init` ; CI `bitnami/minio` | `tests/integration/files.test.ts`, `e2e/files.spec.ts` (upload réel) |
| **ClamAV** | `CLAMAV_ENABLED`, `CLAMAV_HOST`, `CLAMAV_PORT` | `CLAMAV_ENABLED=true` ; **en production un scan impossible bloque le fichier** quoi qu'il arrive (`modules/files/infrastructure/clamav.ts`) | docker `clamav/clamav-debian:stable` ; CI `CLAMAV_ENABLED=false` (verdict `skipped`, fichier non servi comme sain) | `tests/unit/files/clamav-protocol.test.ts` (protocole INSTREAM mocké), e2e fichiers avec le démon local |
| **SMTP** | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | toujours (outbox) | Mailpit (SMTP 1027, UI 8027) | `tests/integration/outbox.test.ts`, `e2e/auth.spec.ts` lit les e-mails via l'API Mailpit |
| **Stripe** | `STRIPE_SECRET_KEY` (`sk_test_…`), `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` | clé présente ⇒ Stripe **mode test** ; absente ⇒ fournisseur `mock` : page `/app/compte/abonnement/mock-checkout` clairement étiquetée, abonnement `provider = mock` (interdit en production par `billing.live_enabled`) | mock | `tests/unit/billing/*`, `tests/integration/billing.test.ts` (client Stripe mocké), `e2e/premium.spec.ts` (mock checkout) |
| **Google Calendar** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` ; redirection `${APP_URL}/api/integrations/google/callback` | les deux variables présentes | non configuré : bouton « connecter » désactivé avec explication ; la synchro est testée avec un adaptateur en mémoire | `tests/unit/calendar/adapters.test.ts`, `tests/unit/calendar/ics-and-sync.test.ts`, `e2e/calendar.spec.ts` (connexion de démo expirée) |
| **Microsoft 365** | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT` ; redirection `${APP_URL}/api/integrations/microsoft/callback` | idem | idem | idem (Graph mocké) |

## Détails

### Stripe
- Produits/prix créés côté Stripe et renseignés dans `plans.stripe_price_id` depuis `/admin/offres`.
- Webhook : `POST /api/billing/webhooks/stripe`, signature vérifiée avec `STRIPE_WEBHOOK_SECRET`, chaque `event.id` inséré dans `billing_events` (unique) avant traitement → idempotent. En local : `stripe listen --forward-to localhost:3200/api/billing/webhooks/stripe`.
- Aucun paiement réel : `billing.live_enabled` (configuration) doit rester `false` jusqu'à la validation juridique ([legal-review.md](legal-review.md) §3) ; la clé live n'est jamais chargée dans l'environnement.

### Google / Microsoft
- OAuth 2.0 « authorization code », `state` signé lié à la session, scopes calendrier uniquement.
- Jetons chiffrés en base (`calendar_connections`), rafraîchis par le worker `calendar-sync`, direction configurable (`export_only` par défaut), curseurs incrémentaux (`syncToken` / `deltaLink`), détection de conflits par empreinte.
- Révocation depuis `/app/calendrier/connexions` (statut `revoked`, jetons effacés).

### SMTP / Brevo
- Transport nodemailer ; en production, relais SMTP authentifié (Brevo pressenti) avec SPF/DKIM/DMARC à configurer sur le domaine expéditeur (`MAIL_FROM`).
- Tous les envois passent par `email_outbox` (5 tentatives, backoff, échecs conservés) ; `List-Unsubscribe` sur les notifications optionnelles (`/api/notifications/unsubscribe`).
- Aucun e-mail marketing en V1 (`notification_preferences.marketing_emails` existe mais aucun envoi).

### S3 (production)
- Scaleway Object Storage ou OVH Object Storage, région UE, deux buckets privés (`sna-files`, `sna-quarantine`), politique de cycle de vie sur la quarantaine (24–48 h) et sur le bucket de sauvegardes (voir [backup-restore.md](backup-restore.md)).
- `S3_FORCE_PATH_STYLE=false` chez la plupart des fournisseurs (true pour MinIO).

### ClamAV
- Démon `clamd` joignable en TCP ; protocole `INSTREAM` ; signatures mises à jour par `freshclam` dans le conteneur ; premier démarrage long (jusqu'à 30 min, `start_period: 300s`).
- Monitoring : `/api/health` ne vérifie pas ClamAV (non critique pour servir le site) ; le worker journalise les scans dans `file_scan_results`.

## Ce qui n'est pas intégré en V1

Passerelle SMS, cartographie tierce (géocodage simple par département/ville en base), outil d'analytics tiers (aucun : voir [privacy.md](privacy.md)), passkeys, SSO.
