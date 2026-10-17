# Modèle de menaces (STRIDE par surface)

Hypothèses : attaquant externe anonyme, utilisateur authentifié malveillant (organisateur ou professionnel), membre d'un évènement cherchant à dépasser son rôle, personnel interne (modérateur) curieux, compromission d'un sous-traitant. Les actifs les plus précieux sont, dans l'ordre : les données des enfants (santé, personnes autorisées), les identités et coordonnées des invités, les justificatifs des professionnels, les comptes administrateurs.

Légende : **S**poofing · **T**ampering · **R**epudiation · **I**nformation disclosure · **D**enial of service · **E**levation of privilege. Statut : ✅ mitigé · 🟡 partiellement · ⬜ accepté/à faire.

## 1. Authentification et comptes

| Menace | Scénario | Mitigation | Statut |
|---|---|---|---|
| S | Bourrage d'identifiants, force brute | rate limit Redis 5/min + repli DB, hachage better-auth, 2FA TOTP, verrouillage TOTP, journal `security_events` | ✅ |
| S | Vol de cookie de session | `HttpOnly`, `Secure`, `SameSite=Lax`, HSTS, CSP stricte (pas de XSS exploitable), révocation, durée 7 j | ✅ |
| S | Réinitialisation détournée | lien 1 h, usage unique, sessions révoquées, rate limit 3/5 min | ✅ |
| E | Changement de rôle global par l'utilisateur | `users.role` non exposé en entrée (`input: false`), seul le plugin admin (rôles `admin`/`super_admin`) le modifie, audit | ✅ |
| R | Action admin niée | `audit_logs` avec acteur, IP, request-id ; impersonation tracée | ✅ |
| S | Prise de contrôle via e-mail non vérifié | vérification obligatoire en production avant accès aux zones sensibles | ✅ |
| E | Phishing d'un admin (pas de passkeys) | 2FA TOTP obligatoire pour les rôles staff : **à imposer par politique** (non forcé par le code) | 🟡 |

## 2. Multi-tenant (évènements, fiches, organisations)

| Menace | Scénario | Mitigation | Statut |
|---|---|---|---|
| I / E | Énumération d'identifiants d'évènement ou de fichier | UUID v4, `NotFoundError` indistinguable, tests d'isolation | ✅ |
| E | Membre qui s'attribue une permission (`event_permissions`) | écriture réservée à `event.permissions.manage` (owner, lead, planner), *deny* prioritaire, expiration, audit | ✅ |
| E | Prestataire qui accède aux données de tout l'évènement | permissions par rôle + extras limités au métier (`TRADE_PERMISSIONS`), portée enfant par affectation | ✅ |
| I | Membre révoqué conservant l'accès | `event_members.status` vérifié à chaque requête (`active` uniquement) | ✅ |
| T | Requête de service oubliant le filtre `event_id` | revue de code, tests d'intégration ; pas de RLS (filet absent) | 🟡 |
| I | Organisation : membre simple lisant les justificatifs | `requireProfessionalManage` refuse `org_member` ; justificatifs réservés à `moderation.documents.view` | ✅ |

## 3. Données des enfants

| Menace | Scénario | Mitigation | Statut |
|---|---|---|---|
| I | Lecture des allergies par un membre non autorisé | chiffrement colonne, permission `children.view_sensitive`, portée par affectation, consentement explicite requis | ✅ |
| I | Fuite par e-mail, notification, export, log, QR | règle de conception : aucune donnée de santé hors de la page dédiée ; export utilisateur exclut les enfants (`tests/integration/privacy.test.ts`) ; logger rédige `healthNotes` | ✅ |
| R | Consultation niée | `child_access_logs` (qui, quel enfant, pourquoi, quand), visible par `children.view_access_logs` | ✅ |
| T | Remise d'un enfant à une personne non autorisée | liste de personnes autorisées + indication de vérification d'identité, confirmation humaine tracée (`child_handover_records`), jamais par QR seul | ✅ |
| I | Conservation au-delà du besoin | anonymisation automatique N jours après l'évènement (`retention.children_days_after_event`), journalisée | ✅ |
| I | Compromission de la base | données de santé chiffrées ; clé hors base ; sauvegardes chiffrées (age/openssl) | ✅ |
| I | Compromission de la clé `DATA_ENCRYPTION_KEY` | rotation documentée ([operations.md](operations.md)), clé dans Coolify uniquement | 🟡 (pas de versioning de clé en V1) |
| I | Modérateur / admin curieux | les admins ne sont pas membres des évènements ; break-glass réservé `super_admin`, motif obligatoire, journalisé | ✅ |

## 4. Uploads et fichiers

| Menace | Scénario | Mitigation | Statut |
|---|---|---|---|
| T | Malware déposé puis servi | quarantaine séparée, ClamAV (fail-closed : rejet si scan impossible en 24 h), copie vers `sna-files` seulement si sain | ✅ |
| T | Polyglotte / MIME menteur | type par signature `file-type`, liste blanche par finalité, inspection PDF (JS, formulaires) et Office (macros) | ✅ |
| I | Accès direct au bucket | buckets privés (`mc anonymous set none`), URL signées courtes émises après autorisation, clé de stockage UUID | ✅ |
| I | Dédoublonnage par empreinte révélant un fichier d'un autre tenant | index `(sha256, scope, scope_id)` : dédoublonnage intra-scope seulement | ✅ |
| D | Upload massif | taille max par finalité, rate limit upload, quota implicite par scope | 🟡 (pas de quota global par compte) |
| I | Images publiques exposant une fiche non publiée | `/api/files/[id]/public` vérifie finalité publique **et** fiche publiée | ✅ |

## 5. Webhooks et intégrations

| Menace | Scénario | Mitigation | Statut |
|---|---|---|---|
| S | Webhook Stripe forgé | signature vérifiée, secret dédié, mode test | ✅ |
| T | Rejeu de webhook | `billing_events.external_event_id` unique, traitement idempotent | ✅ |
| E | Droit Premium obtenu sans paiement | droits calculés depuis `subscriptions` écrites uniquement par le webhook ou le mock local (hors production) | ✅ |
| S | CSRF sur le démarrage OAuth calendrier | `state` signé et lié à la session, callback vérifie l'utilisateur | ✅ |
| I | Jetons OAuth en clair | chiffrés en base, scopes minimaux, révocation | ✅ |
| D | Synchronisation en boucle avec un agenda externe | empreinte du dernier état synchronisé, origine du mapping, curseur provider | ✅ |

## 6. Invitations, QR codes, check-in

| Menace | Scénario | Mitigation | Statut |
|---|---|---|---|
| S | QR copié / photographié | jeton opaque à usage limité (`max_uses`), détection `duplicate` au scan, révocation, expiration | ✅ |
| I | Donnée personnelle dans le QR ou l'URL | le QR n'encode que le jeton ; la page `/c/[token]` n'affiche que ce qu'un contrôleur doit voir | ✅ |
| T | Devinette de jeton | 32 octets aléatoires, HMAC stocké, comparaison en temps constant, rate limit sur `/api/checkin` | ✅ |
| R | Contestation d'un check-in | `invitation_checkins` avec scanneur, horodatage, résultat | ✅ |

## 7. Formulaires publics et contenu

| Menace | Scénario | Mitigation | Statut |
|---|---|---|---|
| D | Spam contact / signalement | pot de miel, rate limit fail-closed, pas de rebond vers des tiers | ✅ |
| T | XSS stocké via fiche, message, page juridique | arbre de blocs validé, Markdown restreint, React échappe tout, CSP nonce | ✅ |
| S | Faux avis | avis liés à une interaction vérifiable, modérés, signalables | ✅ |
| I | Fuite de l'e-mail du signalant vers la personne signalée | jamais affiché côté auteur du contenu ; visible uniquement par la modération | ✅ |
| S | Phishing imitant nos e-mails | pas de pièce jointe, lien vers `APP_URL` uniquement ; SPF/DKIM/DMARC à configurer chez le relais | 🟡 (DNS à faire) |

## 8. Administration

| Menace | Scénario | Mitigation | Statut |
|---|---|---|---|
| E | Modérateur modifiant les offres ou paramètres | permissions globales distinctes (`moderation.*` vs `admin.*`), `super_admin` seul pour rôles et break-glass | ✅ |
| T | Modification silencieuse d'une décision de modération | décisions ajoutées, jamais éditées ; recours tracés | ✅ |
| T | Variables juridiques ou délais de rétention falsifiés | `configuration_settings` modifiable par `admin.settings.manage`, audit, valeurs invalides ramenées aux défauts | ✅ |
| I | Export de sécurité volumineux | `/admin/securite/export` réservé `admin.security.view`, journalisé | ✅ |
| R | Traitement RGPD contesté | `data_subject_requests` + `audit_logs` (statut, motif, traitant, échéance) | ✅ |

## 9. Disponibilité et exploitation

| Menace | Scénario | Mitigation | Statut |
|---|---|---|---|
| D | Redis indisponible | files en pause, rate limit public fail-closed, auth bascule sur `login_attempts` ; `/api/health` dégradé | ✅ |
| D | Perte de données | sauvegardes chiffrées quotidiennes + miroir S3, exercice de restauration ([backup-restore.md](backup-restore.md)) | ✅ |
| D | Worker arrêté | heartbeat Redis exposé par `/api/health`, jobs persistants dans Redis AOF, reprise au redémarrage | ✅ |
| I | Fuite de `.env` ou de sauvegarde | `.env` ignoré, gitleaks, sauvegardes chiffrées avec clé hors serveur (age) | ✅ |

## Résidus acceptés en V1

- Absence de RLS et de quotas globaux d'upload.
- 2FA non imposée par le code aux rôles staff.
- Pas de test d'intrusion externe ni d'audit d'accessibilité (planifiés avant ouverture commerciale).
- Rotation de clé de chiffrement manuelle (pas de multi-version de clé).
