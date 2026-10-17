# Protection des données (RGPD)

Ce document rassemble le **registre des traitements** (art. 30), l'**analyse d'impact initiale** (AIPD) sur les données des mineurs, les **durées de conservation** et la **procédure d'exercice des droits**. La source du registre est le code (`src/modules/privacy/domain/processing-registry.ts`), affichée aussi dans le back-office (`/admin/rgpd/registre`). Les mentions « [À COMPLÉTER] » sont des décisions de la direction à prendre avec un conseil juridique ; rien n'est affirmé à sa place.

Responsable du traitement : **[À COMPLÉTER — l'éditeur, voir `legal.company_name`]**. DPO : **[À COMPLÉTER — désignation requise ? voir legal-review.md]**. Contact : `legal.dpo_email`.

## 1. Registre des traitements

| # | Traitement | Finalité | Base légale | Personnes | Données | Destinataires | Conservation | Sécurité |
|---|---|---|---|---|---|---|---|---|
| 1 | Comptes et authentification | créer, sécuriser, authentifier | contrat ; intérêt légitime (sécurité) | organisateurs, pros, invités avec compte, staff | identité, e-mail, mot de passe haché, préférences, sessions (IP, navigateur), TOTP | interne, hébergeur, relais SMTP | durée du compte, puis demande d'effacement auto après `retention.inactive_account_months` (36) mois d'inactivité ; sessions expirées purgées chaque nuit | better-auth, cookies HttpOnly, rate limit, 2FA |
| 2 | Fiches professionnelles et vérification | annuaire, contrôle des déclarations, modération | contrat ; intérêt légitime ; **[À COMPLÉTER : base et durée pour les justificatifs]** | professionnels | identité pro, coordonnées publiques, tarifs, pièces (Kbis/SIRENE, assurance, qualification) | public (fiche publiée) ; modération (pièces) | durée de la fiche ; justificatifs **[À COMPLÉTER]** | quarantaine + ClamAV, URL signées, accès `moderation.documents.view`, journal |
| 3 | Organisation d'évènements | tour de contrôle (équipe, prestataires, tâches, budget, documents) | contrat avec l'organisateur (responsable des données de tiers saisies) | organisateurs, membres, prestataires | détails de l'évènement, rôles, documents | membres selon rôle | durée de l'évènement, archivage/suppression par l'organisateur | RBAC/ABAC, audit |
| 4 | Invités, invitations, QR, plan de table | gérer la liste, inviter, contrôler l'accès, placer | contrat avec l'organisateur ; **[À COMPLÉTER : mention d'information aux invités dans les e-mails]** | invités (dont mineurs : âge seulement), contacts | nom, e-mail, téléphone, RSVP, préférence alimentaire (décompte) | organisateurs ; traiteur (décomptes anonymisés) ; lieu (effectifs) | durée de l'évènement | jetons HMAC, QR sans donnée |
| 5 | **Garde d'enfants** | prise en charge sûre : présences, remise, consignes | exécution de la prestation ; **santé : consentement explicite du responsable légal (art. 9.2.a)** [À COMPLÉTER : validation juridique] | enfants, responsables légaux, personnes autorisées, contacts d'urgence | prénom, âge, responsable, personnes autorisées, **allergies et consignes médicales chiffrées**, présences, remises, journal d'accès | organisateur ; équipe de garde affectée | anonymisation `retention.children_days_after_event` (30) jours après l'évènement | AES-256-GCM, permission dédiée, portée par affectation, journal, jamais par e-mail/QR/export |
| 6 | Messagerie, demandes, notifications | coordonner, traiter les demandes | contrat | membres, demandeurs (sans compte possible) | messages, pièces jointes, demandes, notifications | membres du canal ; l'organisateur lit tout (affiché) | durée de l'évènement ; notifications lues purgées à 180 j ; outbox **[À COMPLÉTER]** | pas de santé dans les e-mails |
| 7 | Abonnements et facturation | vendre les offres payantes | contrat ; obligation légale (comptabilité) | abonnés | id client Stripe, statut, évènements de paiement | Stripe | **[À COMPLÉTER : durée légale]** | aucune carte stockée, webhooks signés |
| 8 | Modération, signalements, recours | fiabilité, traitement des signalements | intérêt légitime ; obligations des plateformes **[À COMPLÉTER : LCEN/DSA]** | auteurs, signalants | signalement (motif, détails, e-mail facultatif), décisions | modération ; autorités si requis | **[À COMPLÉTER]** | décisions non modifiables, rate limit |
| 9 | Journaux d'audit et de sécurité | détecter les abus, prouver | intérêt légitime ; obligation (traçabilité données sensibles) | tous | action, ressource, IP, request-id | administrateurs | `retention.audit_logs_months` (12) | rédaction des champs sensibles |
| 10 | Consentements et droits | prouver, répondre dans les délais | obligation légale | visiteurs (id aléatoire), utilisateurs | finalité, décision, version, IP tronquée, demandes | interne | **[À COMPLÉTER]** | id visiteur sans empreinte |
| 11 | Analytique produit interne | comprendre l'usage | intérêt légitime (connectés, minimisé) ; consentement (anonymes) | utilisateurs, visiteurs consentants | nom d'évènement, id, propriétés énumérées | interne | **[À COMPLÉTER — 13 mois proposés]** | aucun tiers, aucune empreinte |

### Sous-traitants

| Rôle | Prestataire | Localisation | Statut |
|---|---|---|---|
| Hébergement app + base | [À COMPLÉTER — OVHcloud pressenti] | UE (France) | DPA à signer |
| Stockage objet (fichiers, sauvegardes chiffrées) | [À COMPLÉTER — Scaleway / OVH Object Storage] | UE | DPA à signer |
| Paiement | Stripe (test uniquement en V1) | UE/US (CCT) | aucune donnée réelle tant que le mode live est inactif |
| E-mails transactionnels | [À COMPLÉTER — relais SMTP, Brevo pressenti] | UE | DPA à signer |
| Agenda externe (à l'initiative de l'utilisateur) | Google Calendar, Microsoft 365 | hors UE possible | consentement par OAuth, jetons chiffrés, révocable |

Aucun transfert hors UE n'est initié par la plateforme elle-même ; seules les intégrations activées par l'utilisateur (agenda) peuvent l'être.

## 2. Durées de conservation (configurées)

| Donnée | Durée | Mécanisme |
|---|---|---|
| Enfants (identité, consignes, santé, contacts) | `retention.children_days_after_event` = 30 jours après la fin de l'évènement | job quotidien `children_anonymisation` (`modules/childcare/application/retention.ts`) : prénom/nom/contacts remplacés, santé et personnes autorisées supprimées, `anonymized_at` posé |
| Sessions, vérifications d'e-mail | expiration | `sessions_purge`, `verifications_purge` |
| Notifications lues | 180 jours | `notifications_purge` |
| Journaux d'audit | `retention.audit_logs_months` = 12 mois | `logs_purge` (les `child_access_logs` ne sont **pas** purgés par ce job : décision à prendre [À COMPLÉTER]) |
| Comptes inactifs | `retention.inactive_account_months` = 36 mois sans connexion | `inactive_accounts` : crée une **demande d'effacement** traitée par un humain (pas de suppression automatique) |
| Fichiers rejetés/infectés | 7 jours | worker `files_purge` |
| Quarantaine orpheline, scans bloqués | 24 h | worker `quarantine_orphans`, `files_stuck_scanning` |
| Sauvegardes | 14 jours en local, cycle de vie du bucket hors site [À COMPLÉTER] | `scripts/backup.sh` |

Valeurs éditables dans `/admin/parametres` ; chaque exécution est journalisée dans `retention_jobs` et visible dans `/admin/rgpd/registre`.

## 3. Analyse d'impact initiale — données des mineurs

**Pourquoi une AIPD** : traitement de données de santé (allergies, consignes médicales) concernant des mineurs, pour le compte d'organisateurs, consultées par des tiers (équipe de garde). Critères CNIL réunis : données sensibles + personnes vulnérables.

**Description** : l'organisateur inscrit les enfants présents (prénom, âge, responsable légal, personnes autorisées à récupérer l'enfant) et, avec le consentement explicite du responsable légal, les informations de santé utiles à la garde. L'équipe de garde affectée consulte ces informations le jour J, enregistre présences, incidents et remises. Les données sont anonymisées 30 jours après l'évènement.

**Nécessité et proportionnalité** : pas de date de naissance (âge suffit), pas de photo d'enfant exigée, consignes opérationnelles séparées des données médicales, drapeaux `has_allergies` / `has_health_notes` pour informer sans révéler, consentement horodaté et retirable, information du responsable légal tracée (`guardian_informed_at`).

| Risque | Vraisemblance | Gravité | Mesures | Risque résiduel |
|---|---|---|---|---|
| Accès illégitime aux données de santé par un membre de l'évènement | limitée | importante | permission `children.view_sensitive` restreinte, portée par affectation, consentement requis, journal d'accès, pas d'export | faible |
| Divulgation par un canal secondaire (e-mail, QR, log, sauvegarde) | limitée | importante | règle « jamais hors de la page dédiée », rédaction des logs, QR sans donnée, sauvegardes chiffrées, export sans enfants | faible |
| Compromission de la base | limitée | maximale | chiffrement colonne, clé hors base, hébergement UE, sauvegardes chiffrées | modérée (dépend de la gestion de clé : rotation manuelle) |
| Remise d'un enfant à une personne non autorisée | limitée | maximale | liste de personnes autorisées, vérification d'identité indiquée, confirmation humaine tracée | modérée (procédure humaine ; formation des pros [À COMPLÉTER]) |
| Conservation excessive | négligeable | importante | anonymisation automatique journalisée, délai configurable | faible |
| Consentement invalide (recueilli par l'organisateur, pas par la plateforme) | significative | importante | champs consentement nominatif + date + retrait ; **modèle d'information/consentement parent à fournir [À COMPLÉTER]** | modérée |
| Exercice des droits par un parent sans compte | significative | limitée | procédure décrite (`/droits-rgpd`), transmission à l'organisateur, contact DPO | faible |

**Conclusion provisoire** : risques résiduels modérés sur deux points (gestion de clé, qualité du consentement recueilli par l'organisateur). À faire valider par le DPO/conseil avant ouverture ; consultation CNIL non requise a priori si ces points sont traités [À COMPLÉTER].

## 4. Exercice des droits

| Droit | En libre-service (`/app/compte/confidentialite`) | Par e-mail (`legal.dpo_email`) | Traitement interne (`/admin/rgpd`) |
|---|---|---|---|
| Accès / portabilité | export JSON immédiat (compte, profil, métadonnées des évènements et fiches possédés, contacts, consentements, demandes) — **exclut** les données de tiers, les enfants, les documents, les journaux | sur demande, après vérification d'identité | produire l'export, transmettre par canal sécurisé |
| Rectification | formulaire → demande `rectification` (+ modification directe du profil) | idem | corriger, informer les destinataires, clore avec motif |
| Effacement | « Demander la suppression de mon compte » → demande `erasure` ; **pas de suppression immédiate** (obligations légales possibles) | idem | vérifier les conservations légales, supprimer/anonymiser, prévenir les sous-traitants, clore |
| Limitation / opposition | formulaire | idem | geler le traitement, répondre |
| Retrait du consentement cookies | `/cookies#preferences`, « Réafficher la bannière » | — | — |
| Retrait du consentement santé enfant | via l'organisateur ou le DPO | idem | `consent_withdrawn_at` + suppression des données chiffrées |

Délai : un mois (`dueAt = +30 j`), prolongeable de deux mois avec information. Chaque changement de statut est audité et notifié à la personne (e-mail forcé à la clôture). Les demandes en retard sont signalées en rouge dans le back-office.

## 5. Consentement cookies

- Cookie `sna_consent` (6 mois, non HttpOnly pour piloter la bannière) : identifiant aléatoire, version de politique (`2026-10`), choix `analytics` / `marketing`.
- Bannière : refus et acceptation en un clic, même poids visuel, rien de pré-coché, lien « Personnaliser » ; preuve dans `consent_records` (une ligne par catégorie, IP tronquée, agent utilisateur, version).
- Aucun traceur non essentiel n'existe en V1 : la bannière pose le mécanisme. Si un outil de mesure est ajouté, il devra être chargé uniquement après `analytics = true` et listé sur `/cookies`.

## 6. Données techniques et logs

IP complètes dans `sessions` et `security_events` (sécurité, intérêt légitime, 12 mois max) ; IP tronquée dans `consent_records` ; jamais d'IP dans `product_events`. Logger pino rédige e-mails, jetons, secrets, notes de santé.
