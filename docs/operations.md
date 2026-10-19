# Exploitation — runbooks

Commandes à exécuter sur l'hôte Coolify (`docker exec` dans le conteneur `app` ou `worker`) ou en local. Chaque incident se termine par une note dans le journal d'exploitation (date, symptôme, cause, action, prévention).

## Santé et observabilité

- `GET /api/health` : `{ status: ok|degraded, checks: { database, redis, worker? } }` — 503 si la base est injoignable. Sonde d'uptime toutes les minutes.
- Heartbeat worker : clé Redis `worker:heartbeat` (rafraîchie toutes les 20 s). Absence > 5 min ⇒ alerte.
- Logs JSON pino (`LOG_LEVEL=info`), corrélation par `x-request-id`. Jamais de secret ni de donnée de santé dans les logs (rédaction active).
- Back-office : `/admin/securite` (évènements de sécurité, audit), `/admin/rgpd/registre` (rétention), `/admin/offres/evenements` (webhooks Stripe), Mailpit/relais SMTP pour l'outbox.

## Runbook 1 — Incident (indisponibilité, fuite suspectée)

1. Qualifier : `curl -s https://sousnosailes.fr/api/health`, logs `app` et `worker`, charge VPS (`htop`, `df -h`), Postgres (`select count(*) from pg_stat_activity`).
2. Contenir : si fuite ou compromission suspectée → arrêter `app` (page de maintenance Coolify), révoquer les sessions (`/admin/securite/sessions` ou `delete from sessions;`), faire tourner les secrets (runbook 2), bloquer l'IP au pare-feu.
3. Restaurer : image précédente (rollback Coolify) ou base depuis sauvegarde ([backup-restore.md](backup-restore.md)).
4. Notifier : si des données personnelles sont concernées, évaluer la notification CNIL sous 72 h et l'information des personnes (données d'enfants = gravité élevée) — contact `legal.dpo_email`.
5. Post-mortem sous 5 jours ouvrés.

## Runbook 2 — Rotation des secrets

| Secret | Procédure | Impact |
|---|---|---|
| `BETTER_AUTH_SECRET` | générer (`openssl rand -base64 32`), mettre à jour dans Coolify, redéployer `app` + `worker` | toutes les sessions sont invalidées (reconnexion) |
| `DATA_ENCRYPTION_KEY` | **pas de multi-version en V1** : (1) mettre l'app en maintenance ; (2) script de rechiffrement : lire chaque ligne de `child_sensitive_information` et `calendar_connections`, déchiffrer avec l'ancienne clé, rechiffrer avec la nouvelle (à écrire dans `scripts/rotate-data-key.ts` le jour venu, transaction par lot) ; (3) remplacer la variable ; (4) redéployer ; (5) régénérer les jetons d'invitation actifs (HMAC dérivé de la clé) ou accepter leur invalidation | sans script, les données de santé deviennent illisibles : **sauvegarder l'ancienne clé** jusqu'à la fin |
| Mots de passe Postgres / Redis / S3 / SMTP | changer chez le fournisseur, mettre à jour Coolify, redéployer ; pour S3 créer la nouvelle clé avant de supprimer l'ancienne | coupure brève |
| `STRIPE_WEBHOOK_SECRET`, clés Stripe | régénérer dans le dashboard Stripe (test), mettre à jour, redéployer | webhooks rejetés entre-temps (Stripe réessaie) |
| Secrets OAuth Google/Microsoft | régénérer dans la console, mettre à jour, redéployer ; les connexions existantes continuent (refresh tokens) | — |
| Clé `age` des sauvegardes | créer une nouvelle paire, mettre `BACKUP_AGE_RECIPIENT` à jour, **conserver l'ancienne clé privée** pour les sauvegardes antérieures | — |

Toutes les rotations sont consignées (date, secret, auteur) dans le coffre 1Password, jamais dans le dépôt.

## Runbook 3 — Purge et rétention

- Exécution automatique : worker, cron `0 3 * * *` Europe/Paris (`src/workers/processors/retention.ts`) → `runRetentionPolicies()` (enfants, sessions, vérifications, notifications, journaux d'audit, comptes inactifs → DSR) puis politiques fichiers.
- Lancer à la main : `docker exec -it <worker> pnpm exec tsx -e "import('./src/modules/privacy/application/retention').then(m => m.runRetentionPolicies()).then(console.log)"` ou ajouter un job `retention` dans la file (`getQueue("retention").add("run", {})`).
- Vérifier : `/admin/rgpd/registre` (statut, lignes affectées, erreurs) ou `select * from retention_jobs order by created_at desc limit 20;`.
- Une politique en échec n'empêche pas les autres ; corriger la cause (souvent un verrou ou une contrainte) et relancer.
- Modifier un délai : `/admin/parametres` (`retention.*`). Une valeur invalide est ignorée (défaut documenté).

## Runbook 4 — Files bloquées (BullMQ)

1. Diagnostiquer : `docker exec -it <worker> pnpm exec tsx -e "..."` ou `redis-cli --scan --pattern 'bull:*:failed'` ; état d'une file : `LLEN bull:<queue>:wait`, `ZCARD bull:<queue>:delayed`, `LLEN bull:<queue>:failed`.
2. E-mails : `select status, count(*) from email_outbox group by 1;` ; les lignes `failed` (5 tentatives) se relancent avec `update email_outbox set status='pending', attempts=0 where status='failed' and created_at > now() - interval '1 day';` après correction du SMTP.
3. Fichiers coincés en `scanning` : vérifier ClamAV (runbook 5) ; la politique `files_stuck_scanning` rejette après 24 h, l'utilisateur ré-envoie.
4. Jobs répétés en échec : `worker.on("failed")` les journalise ; `removeOnFail` les garde 7 jours. Vider une file : `getQueue(name).drain()` puis `obliterate({ force: true })` uniquement si l'on sait ce que l'on perd (les jobs e-mail sont rejouables depuis l'outbox, les scans depuis `files.status`).
5. Redis plein (`noeviction`) : augmenter `maxmemory` ou purger les jobs complétés (`clean(0, 1000, 'completed')`).

## Runbook 5 — ClamAV

- Statut : `docker exec <clamav> clamdcheck.sh` ; version des signatures : `docker exec <clamav> sigtool --version` / logs `freshclam`.
- Premier démarrage ou mise à jour : jusqu'à 30 min ; pendant ce temps les scans échouent → fichiers restent `quarantined` et sont réessayés (`files-scan` avec backoff).
- Test : envoyer le fichier EICAR via l'interface ; attendu `infected` + `security_events` `upload_rejected`.
- Ne jamais mettre `CLAMAV_ENABLED=false` en production (le code bloque de toute façon un scan impossible en production).

## Runbook 6 — Montée de version

1. Lire le CHANGELOG / notes de la release ; vérifier les migrations (`src/db/migrations`, additives ?).
2. Sauvegarde manuelle avant déploiement : `scripts/backup.sh` (hors site) + vérifier la présence du dump.
3. Déployer via Coolify : build → `migrate` → `app` → `worker`. Surveiller `/api/health` et les logs 10 min.
4. Vérifications : connexion, ouverture d'un évènement, upload, e-mail de test, une page publique, `/admin/rgpd/registre`.
5. Rollback : redéployer l'image précédente ; si une migration non rétro-compatible a été appliquée, restaurer la base depuis la sauvegarde de l'étape 2.
6. Dépendances : Dependabot hebdomadaire ; majeures revues à la main ; `pnpm audit` en CI ; images Docker mises à jour mensuellement (`postgres`, `redis`, `clamav`, `node`).

## Runbook 7 — Demande d'une autorité ou d'un parent

- Autorité (réquisition) : vérifier l'authenticité, transmettre au conseil juridique, utiliser le break-glass (`/admin/securite/break-glass`) avec motif, exporter uniquement ce qui est demandé, journaliser.
- Parent sans compte demandant l'accès/suppression des données de son enfant : identifier l'évènement (organisateur), traiter comme DSR (`/admin/rgpd`), impliquer l'organisateur responsable, répondre sous un mois.

## Runbook 8 — Capacité

- Postgres : `DATABASE_POOL_MAX` × réplicas `app` + worker < `max_connections` ; surveiller `pg_stat_activity`, `pg_stat_user_tables` (seq scans), taille de `audit_logs`, `product_events`, `email_outbox`.
- S3 : taille des buckets, objets en quarantaine > 48 h (anomalie).
- Redis : mémoire utilisée, `bull:*` clés.
- Next.js : temps de réponse p95 sur `/`, `/annuaire`, `/app/evenements/[id]` ; `scripts/load-test.ts` pour un test de charge simple avant un pic (saison des mariages).
