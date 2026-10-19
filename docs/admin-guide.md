# Guide d'administration

Le back-office (`/admin`) est accessible aux rôles globaux `moderator`, `admin`, `super_admin`. Les permissions exactes sont dans [rbac-permissions.md](rbac-permissions.md) ; les décisions sensibles sont journalisées (`audit_logs`, visibles dans `/admin/securite`).

| Section | Route | Rôle minimum | Contenu |
|---|---|---|---|
| Tableau de bord | `/admin` | moderator | files d'attente, indicateurs, santé |
| Modération | `/admin/moderation`, `/avis`, `/messages/<id>` | moderator | dossiers ouverts (fiches, versions de page, avis, messages, signalements, recours), décision motivée : approuver, demander des modifications, refuser, suspendre, rétablir |
| Signalements | `/admin/signalements` | moderator | signalements publics rattachés à leur dossier |
| Utilisateurs | `/admin/utilisateurs`, `/<id>` | moderator (lecture), admin (gestion) | recherche, bannissement motivé, révocation de sessions, rôles (super_admin uniquement) |
| Professionnels | `/admin/professionnels`, `/<id>` | admin | statut, vérifications (chaque ligne dit ce qui a été contrôlé), pièces justificatives (`moderation.documents.view`), suspension |
| Catégories et métiers | `/admin/categories` | admin | créer/éditer/désactiver un métier, groupe, formulaire conditionnel, outils par défaut |
| Catalogue d'outils | `/admin/outils` | admin | outils, audience, fonctionnalité requise, métiers concernés |
| Offres et abonnements | `/admin/offres`, `/abonnements`, `/promos`, `/sponsorises`, `/evenements` | admin | prix et fonctionnalités des offres, abonnements en cours, codes promo, emplacements sponsorisés (limités, étiquetés), journal des évènements Stripe |
| Contenus éditoriaux | `/admin/contenus`, `/<slug>` | admin | pages juridiques et éditoriales (Markdown restreint + variables `{{legal.*}}`), brouillon / publié |
| RGPD et demandes | `/admin/rgpd`, `/<id>`, `/registre`, `/analytique` | admin | demandes de droits, registre des traitements, journal de rétention, analytique produit |
| Sécurité et audit | `/admin/securite`, `/sessions`, `/break-glass`, `/export` | admin ; break-glass super_admin | évènements de sécurité, journal d'audit, sessions actives, accès d'urgence tracé, export |
| Paramètres | `/admin/parametres` | admin | `configuration_settings` : variables juridiques, délais de rétention, `billing.live_enabled`, `sponsored.max_per_query`, re-modération |

## Procédures courantes

### Publier une fiche professionnelle
1. `/admin/moderation` → dossier `profile_review`. Lire la fiche, les prestations, la page composée.
2. Vérifications : pour chaque pièce, enregistrer précisément ce qui a été fait (`business_registration_checked`, `documents_reviewed`, `insurance_declared`…). Ne jamais cocher « vérifié » pour une assurance ou une qualification sans avoir vu le document.
3. Décision motivée (approuver / demander des modifications / refuser). La personne est notifiée ; un refus est contestable.
4. Une fiche publiée dont la page est modifiée substantiellement repasse en relecture si `moderation.require_review_on_major_update` est actif.

### Traiter un signalement
`/admin/signalements` → ouvrir le dossier → masquer temporairement si nécessaire → décision → l'auteur est notifié, le signalant aussi s'il a laissé une adresse (jamais l'inverse).

### Traiter une demande RGPD
`/admin/rgpd` : trier « À traiter », les retards sont en rouge (délai légal 30 jours). Ouvrir la demande, suivre la marche à suivre affichée selon le type, puis changer le statut avec un motif (obligatoire pour clore). La personne reçoit une notification et un e-mail. Procédure détaillée : [privacy.md](privacy.md) §4.

- **Effacement** : vérifier d'abord les obligations de conservation (facturation, litige) ; supprimer le compte via `/admin/utilisateurs/<id>` (évènements, fiches, contacts suivent) ; anonymiser ce qui doit rester ; prévenir Stripe/SMTP si besoin ; clore.
- **Accès/portabilité** : la personne a déjà l'export JSON depuis son espace ; pour une demande par e-mail, vérifier l'identité puis produire l'export.

### Renseigner les mentions légales
`/admin/parametres` → clés `legal.company_name`, `legal.company_address`, `legal.siret`, `legal.vat_number`, `legal.publication_director`, `legal.dpo_email`, `legal.host`, `legal.mediator`, `legal.contact_email`. Les pages juridiques affichent `[À COMPLÉTER]` tant qu'une valeur manque ; l'équipe voit un bandeau listant les variables manquantes. Puis `/admin/contenus` : remplacer chaque gabarit par le texte validé par le conseil juridique et passer en « publié ».

### Modifier les délais de rétention
`/admin/parametres` → `retention.children_days_after_event` (jours), `retention.inactive_account_months`, `retention.audit_logs_months`. Appliqués à la prochaine exécution nocturne ; vérifier dans `/admin/rgpd/registre` (journal `retention_jobs`).

### Offres et prix
`/admin/offres` : les prix sont des hypothèses commerciales tant que `billing.live_enabled` est à `false`. Activer le paiement réel exige : CGV validées, médiateur désigné, clés Stripe live configurées hors de l'application courante (voir [legal-review.md](legal-review.md)).

### Accès d'urgence (break-glass)
`/admin/securite/break-glass` (super_admin) : ouvrir un accès temporaire à un évènement avec motif obligatoire ; l'accès est journalisé et visible dans l'audit. À n'utiliser que pour un incident ou une demande légale.

### Bannir / débannir
`/admin/utilisateurs/<id>` : motif et durée optionnelle ; les sessions sont révoquées ; l'action est auditée. Un compte banni n'est pas supprimé (demande RGPD distincte).

## Bonnes pratiques

- Activer la 2FA sur tout compte staff ; ne jamais partager un compte.
- Écrire des motifs factuels : ils sont transmis aux personnes et conservés.
- Ne jamais copier une donnée de santé d'enfant hors de l'application (ni e-mail, ni ticket).
- En cas de doute juridique, ne pas publier : laisser en brouillon et consigner la question dans [legal-review.md](legal-review.md).
