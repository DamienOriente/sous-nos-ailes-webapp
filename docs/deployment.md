# Déploiement (VPS OVH + Coolify + Docker)

Cible V1 : un VPS OVH (Ubuntu LTS) avec Coolify auto-hébergé, Postgres et stockage objet **externalisés** (service managé ou conteneurs dédiés avec volumes sauvegardés), application et worker en conteneurs sans état.

## Topologie

```
Internet ─▶ Cloudflare (DNS, proxy) ─▶ Traefik (Coolify, TLS Let's Encrypt)
                                          ├─▶ app  (Next.js standalone, port 3000, N réplicas)
                                          └─▶ (rien d'autre exposé)
app / worker ─▶ Postgres 17 (managé ou conteneur, volume + sauvegardes)
             ─▶ Redis 7 (conteneur, AOF)
             ─▶ S3 (Scaleway / OVH Object Storage)
             ─▶ ClamAV (conteneur, non exposé)
             ─▶ SMTP relais (Brevo)
worker       ─▶ BullMQ (process séparé, 1 instance suffit, plusieurs possibles)
```

Images : `Dockerfile` multi-étapes (`deps → builder → migrator | worker | runner`), utilisateur `node` non root, `output: "standalone"`. Le build ne touche jamais la base (`APP_ENV=build`, `SKIP_ENV_VALIDATION=1`).

## Services Coolify

| Service | Image / cible | Commande | Notes |
|---|---|---|---|
| `app` | `Dockerfile` target `runner` | `node server.js` (port 3000) | healthcheck `GET /api/health` ; 1–3 réplicas |
| `worker` | target `worker` | `pnpm worker` | pas de port ; redémarrage automatique ; heartbeat Redis lu par `/api/health` |
| `migrate` | target `migrator` | `pnpm db:migrate` (+ `pnpm db:seed` si `SEED_DEMO=true`, **jamais en production**) | job « one-shot » exécuté **avant** chaque déploiement de `app` |
| `redis` | `redis:7-alpine` | `--appendonly yes --maxmemory-policy noeviction` | volume persistant |
| `clamav` | `clamav/clamav-debian:stable` | défaut | volume signatures ; démarrage long |
| `postgres` | managé OVH **ou** `postgres:17-alpine` | — | volume + sauvegarde quotidienne hors site |

## Variables d'environnement (production)

Toutes dans Coolify (chiffrées), jamais dans l'image ni dans git. Obligatoires :

```
APP_ENV=production            DEMO_MODE=false            INDEXING_ENABLED=false   # true après checklist
APP_URL=https://sousnosailes.fr
DATABASE_URL=postgresql://…   DATABASE_POOL_MAX=10       REDIS_URL=redis://redis:6379
BETTER_AUTH_SECRET=<openssl rand -base64 32>
DATA_ENCRYPTION_KEY=<openssl rand -base64 32>            # perte = données de santé illisibles : sauvegarder dans 1Password
SMTP_HOST / SMTP_PORT / SMTP_SECURE / SMTP_USER / SMTP_PASSWORD / MAIL_FROM
S3_ENDPOINT / S3_REGION / S3_BUCKET / S3_QUARANTINE_BUCKET / S3_ACCESS_KEY / S3_SECRET_KEY / S3_FORCE_PATH_STYLE=false
CLAMAV_ENABLED=true  CLAMAV_HOST=clamav  CLAMAV_PORT=3310
LOG_LEVEL=info
# optionnels : STRIPE_* (test uniquement), GOOGLE_*, MICROSOFT_*
```

`src/lib/env.ts` refuse de démarrer si `APP_ENV=production` avec `DEMO_MODE=true`, sans secrets, ou avec `APP_URL` non https.

## Reverse proxy et HTTPS

- Traefik (intégré à Coolify) termine TLS (Let's Encrypt) et transmet `X-Forwarded-For` / `X-Real-IP` (better-auth et le rate limiting lisent ces en-têtes : **ne pas exposer `app` sans proxy**, sinon l'IP cliente est usurpable).
- Cloudflare en proxy : mode SSL « Full (strict) », pas de cache sur `/app`, `/admin`, `/api` ; HSTS déjà émis par l'application.
- En-têtes de sécurité et CSP générés par l'application (`proxy.ts`, `next.config.ts`) — ne pas les dupliquer dans Traefik.
- Taille de corps : 2 Mo pour les server actions ; les uploads passent par `/api/files/upload` (limite par finalité dans le module fichiers) — aligner `client_max_body_size`/Traefik `maxRequestBodyBytes` en conséquence (≥ 25 Mo).

## Sans état et réplication

Les instances `app` ne stockent rien localement (`.secrets/` n'est utilisé qu'en local). Sessions en base + cache Redis, fichiers en S3, jobs en Redis. Mise à l'échelle : augmenter les réplicas `app` ; le worker peut être dupliqué (BullMQ verrouille les jobs). `upsertJobScheduler` rend les plannings idempotents entre instances.

## Migrations au déploiement

1. Consolider les changements locaux (`drizzle-kit push` des modules) : `pnpm db:generate` → relire le SQL → commit (`src/db/migrations/000x_*.sql`).
2. Pipeline Coolify : build → `migrate` (one-shot, échoue = déploiement annulé) → `app` et `worker` redéployés.
3. Migrations additives et compatibles avec la version précédente (déploiement sans interruption : l'ancienne app tourne pendant la migration).
4. Rollback : redéployer l'image précédente ; ne jamais `DROP` dans la même release que le code qui cesse d'utiliser une colonne.

## Checklist go-live

### Infrastructure
- [ ] Postgres externalisé, sauvegarde quotidienne chiffrée vers Scaleway + exercice de restauration réussi ([backup-restore.md](backup-restore.md))
- [ ] Buckets S3 privés, cycle de vie quarantaine et sauvegardes
- [ ] Redis avec AOF et `noeviction`
- [ ] ClamAV opérationnel (`clamdcheck`), `CLAMAV_ENABLED=true`
- [ ] Secrets générés, stockés dans 1Password, injectés par Coolify ; `.env` absent du serveur
- [ ] DNS : A/AAAA, SPF, DKIM, DMARC pour le domaine expéditeur ; HSTS preload soumis après validation
- [ ] Supervision : `/api/health` sondé (uptime), logs JSON collectés, alerte si heartbeat worker absent > 5 min
- [ ] Firewall : seuls 80/443 (et SSH restreint) exposés

### Application
- [ ] `APP_ENV=production`, `DEMO_MODE=false`, seed de démo jamais exécuté
- [ ] Données de référence seedées (catégories, offres, outils, check-lists, `configuration_settings`)
- [ ] Variables `legal.*` renseignées dans `/admin/parametres` ; pages juridiques validées et `published` ([legal-review.md](legal-review.md))
- [ ] Comptes staff créés avec 2FA activée ; aucun compte `@sousnosailes.test`
- [ ] `billing.live_enabled=false` tant que CGV/médiateur non validés ; Stripe en test ou absent
- [ ] `INDEXING_ENABLED=true` seulement après validation du contenu public
- [ ] CI verte (typecheck, lint, unit, intégration, e2e, axe), `pnpm audit` revu

### Vérifications post-déploiement
- [ ] `curl -I https://sousnosailes.fr` : HSTS, CSP, `X-Frame-Options`
- [ ] Inscription + vérification e-mail réelle, connexion 2FA
- [ ] Upload d'un fichier (EICAR rejeté, PDF sain servi)
- [ ] Un job de rétention exécuté (`/admin/rgpd/registre`)
- [ ] Sauvegarde du soir présente hors site
