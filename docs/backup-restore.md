# Sauvegarde et restauration

Objectif : perdre au plus 24 h de données (RPO 24 h) et remettre le service en route en moins de 4 h (RTO) à partir d'une copie **chiffrée et hors site**. Les scripts vivent dans `scripts/` et fonctionnent en local (docker compose) comme en production.

## Ce qui est sauvegardé

| Donnée | Méthode | Destination | Rétention |
|---|---|---|---|
| PostgreSQL (100 tables, dont données de santé chiffrées) | `pg_dump --format=custom` → chiffrement `age` (clé publique, recommandé) ou `openssl enc -aes-256-cbc -pbkdf2` | `BACKUP_DIR` local (staging) puis `offsite/<bucket>/db/` (Scaleway Object Storage) | 14 jours en local (`BACKUP_RETENTION_DAYS`), hors site selon le cycle de vie du bucket (**[À COMPLÉTER] — 30 jours quotidiens + 12 mensuels proposés**) |
| Fichiers S3 (`sna-files`) | `mc mirror --overwrite` | `offsite/<bucket>/files/` | miroir (les suppressions ne sont pas propagées : `--remove` volontairement absent) |
| Redis | non sauvegardé (files de jobs rejouables, cache) | — | AOF local uniquement |
| Secrets (`BETTER_AUTH_SECRET`, `DATA_ENCRYPTION_KEY`, clé privée `age`) | **1Password** — jamais dans la sauvegarde | — | — |

Une sauvegarde non chiffrée est **refusée** par le script (`BACKUP_AGE_RECIPIENT` ou `BACKUP_PASSPHRASE` obligatoire). Sans `DATA_ENCRYPTION_KEY`, un dump restauré contient des colonnes de santé illisibles : la clé fait partie du plan de reprise.

## Scripts

### `scripts/backup.sh`
1. `pg_dump` (binaire local, `docker exec $PG_CONTAINER`, ou `docker run postgres:17-alpine` sur le réseau Docker).
2. Chiffrement + somme de contrôle `.sha256`.
3. Copie hors site avec le client MinIO `mc` (binaire `MC_BIN`, `mc` dans le PATH, ou `docker run --entrypoint mc minio/minio --config-dir /cfg`) : alias `offsite`, `mc cp` du dump, `mc mirror` du bucket fichiers (alias `source`).
4. Purge locale au-delà de `BACKUP_RETENTION_DAYS`.

Variables : `DATABASE_URL` ou `PG_CONTAINER`/`PG_USER`/`PG_DB`, `BACKUP_DIR`, `BACKUP_AGE_RECIPIENT` | `BACKUP_PASSPHRASE`, `BACKUP_S3_ALIAS_URL`, `BACKUP_S3_ACCESS_KEY`, `BACKUP_S3_SECRET_KEY`, `BACKUP_S3_BUCKET` (défaut `sna-backups`), `S3_ENDPOINT`/`S3_ACCESS_KEY`/`S3_SECRET_KEY`/`S3_BUCKET` (source à mirrorer), `DOCKER_NETWORK`, `MC_CONFIG_DIR`. Lues depuis l'environnement ou `.env.backup` (ignoré par git).

Cron production (sur l'hôte Coolify, utilisateur dédié) :
```
0 3 * * * cd /opt/sna && ./scripts/backup.sh >> /var/log/sna-backup.log 2>&1
```
Alerte si le log ne contient pas `done` chaque matin (ou si `mc ls offsite/sna-backups/db/` n'a pas d'objet du jour).

### `scripts/restore.sh <fichier | offsite:latest> [url-cible]`
Récupère éventuellement le dump le plus récent hors site, vérifie la somme de contrôle, déchiffre (`BACKUP_AGE_IDENTITY` ou `BACKUP_PASSPHRASE`), `pg_restore --clean --if-exists --no-owner`. **Garde-fou** : refuse une base dont le nom ne contient ni `restore` ni `test` sans `RESTORE_CONFIRM=yes`.

### `scripts/test-restore.sh`
Exercice complet : sauvegarde → base `sna_restore_test` recréée → restauration → comparaison du nombre de tables et de quelques comptages de lignes → suppression de la base de test (`KEEP_TEST_DB=1` pour la garder).

## Résultats d'exécution réels (local, 2026-10-17)

Environnement : docker compose local (`sous-nos-ailes-db-1` Postgres 17, MinIO local comme « hors site »), macOS sans `pg_dump` ni `mc` (chemins `docker exec` / `docker run … mc` exercés).

```
$ scripts/test-restore.sh
2026-10-17T12:50:10Z 1/4 backup
2026-10-17T12:50:10Z database dump written: ./backups/sna-db-20261017T125010Z.dump.enc (296K)
2026-10-17T12:50:10Z BACKUP_S3_ALIAS_URL not set: off-site copy skipped (local backup only)
2026-10-17T12:50:10Z 2/4 recreate sna_restore_test
2026-10-17T12:50:10Z 3/4 restore
2026-10-17T12:50:10Z checksum ok
2026-10-17T12:50:10Z restoring sna-db-20261017T125010Z.dump.enc into sna_restore_test
2026-10-17T12:50:10Z restore finished
2026-10-17T12:50:10Z 4/4 compare
tables: source=100 restored=100
rows users                    source=20     restored=20     ok
rows professional_categories  source=24     restored=24     ok
rows plans                    source=4      restored=4      ok
rows configuration_settings   source=16     restored=16     ok
rows professionals            source=0      restored=0      ok
rows events                   source=0      restored=0      ok
2026-10-17T12:50:10Z dropped sna_restore_test
2026-10-17T12:50:10Z RESTORE DRILL OK
```

Copie hors site et restauration depuis le bucket (MinIO local joue Scaleway) :
```
$ BACKUP_S3_ALIAS_URL=http://minio:9000 BACKUP_S3_ACCESS_KEY=… S3_ENDPOINT=http://minio:9000 … scripts/backup.sh
2026-10-17T12:50:06Z database dump written: ./backups/sna-db-20261017T125005Z.dump.enc (296K)
2026-10-17T12:50:07Z dump copied to offsite/sna-backups/db/
2026-10-17T12:50:07Z files bucket mirrored to offsite/sna-backups/files
2026-10-17T12:50:07Z done
$ scripts/restore.sh offsite:latest postgresql://sna:sna@localhost:5432/sna_restore_test
2026-10-17T12:50:08Z fetched sna-db-20261017T125005Z.dump.enc
2026-10-17T12:50:08Z checksum ok
2026-10-17T12:50:09Z restore finished            → tables restored: 100
```

À refaire **chaque mois** en production (cible : `sna_restore_test` sur l'instance Postgres de pré-production), résultat consigné ici avec la date.

## Procédure de reprise (production)

1. Déclarer l'incident ([operations.md](operations.md)), geler les déploiements, mettre l'application en maintenance (Coolify : arrêter `app` et `worker`).
2. Provisionner/vider la base cible ; exporter `DATABASE_URL` de la cible, `BACKUP_AGE_IDENTITY` (clé privée depuis 1Password), identifiants du bucket hors site.
3. `RESTORE_CONFIRM=yes scripts/restore.sh offsite:latest "$DATABASE_URL"` ; vérifier `select count(*) from information_schema.tables where table_schema='public'` (= 100 + tables ajoutées depuis) et quelques comptages.
4. Fichiers : `mc mirror offsite/sna-backups/files source/sna-files` (sens inverse) si le bucket principal est perdu.
5. Redémarrer `migrate` (no-op si à jour), `app`, `worker` ; vérifier `/api/health`, une connexion, l'ouverture d'un fichier, un e-mail.
6. Rédiger le post-mortem (cause, données perdues entre la sauvegarde et l'incident, actions).

## Limites

- Pas de sauvegarde en continu (WAL archiving / PITR) : RPO 24 h. Si l'activité le justifie, activer les sauvegardes managées OVH avec PITR ou `wal-g` vers le même bucket.
- Les suppressions dans `sna-files` ne sont pas propagées au miroir : prévoir une purge périodique du miroir après exercice de restauration.
- La clé privée `age` et `DATA_ENCRYPTION_KEY` sont des points uniques de défaillance : conserver deux copies hors ligne (1Password + support physique chiffré).
