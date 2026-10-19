# Revue juridique — points à valider avant mise en ligne

Liste des validations que **seul un professionnel du droit** peut apporter. Le produit est construit pour ne rien affirmer à leur place : les documents servis sur le site sont des brouillons marqués comme tels, les faits sur l'éditeur sont des variables `{{legal.*}}` à renseigner dans `/admin/parametres`, et les fonctions à risque (paiement réel, indexation) sont désactivées par défaut.

Statut : ⬜ à faire · 🟡 analyse engagée · ✅ validé (date, qui).

## 1. Qualification de la plateforme

| # | Question | Pourquoi c'est important | Ce que le code suppose aujourd'hui | Statut |
|---|---|---|---|---|
| 1.1 | **Statut d'intermédiaire** (mise en relation) vs agence de garde / employeur / mandataire / prestataire de services à la personne | détermine responsabilité, assurances, obligations sociales, agrément éventuel | intermédiaire technique : pas de contrat de prestation conclu par la plateforme, pas de paiement de prestation, pas de fixation de prix (CGU §Rôle) | ⬜ |
| 1.2 | Garde d'enfants : la plateforme peut-elle référencer des particuliers (baby-sitting) sans agrément, quelles qualifications exiger (PSC1, BAFA, CAP AEPE, agrément assistant maternel…) | exigences par métier, affichage honnête des vérifications | vérifications déclaratives/documentaires sans exigence de diplôme ; niveaux « déclaré » / « consulté » / « examiné » | ⬜ |
| 1.3 | Statut des professionnels référencés (indépendants) et risque de requalification | modèle économique | les pros déclarent exercer légalement (CGU) ; aucune directive de la plateforme sur l'exécution | ⬜ |
| 1.4 | Activité « Accueil collectif de mineurs » (ACM) : la garde pendant un évènement peut-elle y être assimilée pour certains volumes/durées | obligations déclaratives, taux d'encadrement | non traité ; aucune affirmation faite | ⬜ |

## 2. Obligations des plateformes en ligne

| # | Question | Ce que le code fait | Statut |
|---|---|---|---|
| 2.1 | LCEN (hébergeur / éditeur), DSA (fournisseur de plateforme : point de contact, signalement, motivation des décisions, recours, rapports de transparence) | signalement public sans compte, dossier horodaté, décisions motivées, recours, procédure publiée (`/signalement-procedure`, `/moderation`) ; **point de contact unique et rapports de transparence non mis en place** | ⬜ |
| 2.2 | Transparence des classements (art. L.111-7 C. conso, règlement P2B si pros = entreprises) | page `/classements-sponsorises`, emplacements sponsorisés étiquetés et limités (`sponsored.max_per_query`), critères décrits dans les CGU (à détailler) | ⬜ |
| 2.3 | Avis en ligne (art. L.111-7-2, D.111-16 et s.) : contrôle, délai de publication, droit de réponse, modération | avis liés à une interaction vérifiable, modérés avant publication, réponse du pro, signalables ; **mentions d'information sur le contrôle des avis à rédiger** | ⬜ |
| 2.4 | Mentions légales : éditeur, directeur de publication, hébergeur, SIRET, TVA, contact | variables `legal.*` ; rien n'est inventé ; page `/mentions-legales` | ⬜ (valeurs à fournir) |

## 3. Consommation, abonnements, résiliation

| # | Question | Ce que le code fait | Statut |
|---|---|---|---|
| 3.1 | CGV / information précontractuelle, prix TTC/HT selon public (organisateurs consommateurs vs pros) | `/cgv`, `/abonnements`, `/tarifs` (prix indicatifs TTC, étiquetés « susceptibles d'évoluer ») | ⬜ |
| 3.2 | Droit de rétractation 14 jours et exécution anticipée des services numériques | mentionné, modalités **[À COMPLÉTER]** | ⬜ |
| 3.3 | Résiliation en ligne « en trois clics », reconduction tacite, information de renouvellement | résiliation en ligne depuis `/app/compte/abonnement/gestion`, effet fin de période, pas de pénalité | ⬜ |
| 3.4 | Médiateur de la consommation (désignation obligatoire avant vente aux consommateurs) | variable `legal.mediator` placeholder ; `billing.live_enabled = false` tant que non désigné | ⬜ |
| 3.5 | Facturation (mentions obligatoires, conservation comptable) | factures Stripe en mode test uniquement ; durée **[À COMPLÉTER]** | ⬜ |
| 3.6 | Codes promo, offres sponsorisées : loyauté des pratiques commerciales | codes promo admin, placements étiquetés | ⬜ |

## 4. Données personnelles

| # | Question | Ce que le code fait | Statut |
|---|---|---|---|
| 4.1 | Qualification responsable / sous-traitant pour les données saisies par les organisateurs (invités, enfants) et par les pros | hypothèse : plateforme responsable pour les comptes et l'annuaire, **sous-traitante** des organisateurs pour leurs invités/enfants (CGU §Données des enfants, `/droits-rgpd` §Données saisies par un organisateur) | ⬜ |
| 4.2 | Base légale et validité du consentement explicite (art. 9) pour les données de santé d'enfants recueilli **par l'organisateur** | champs consentement nominatif/date/retrait ; modèle d'information parent **[À COMPLÉTER]** | ⬜ |
| 4.3 | AIPD : nécessité, validation, éventuelle consultation CNIL | AIPD initiale dans `privacy.md` | 🟡 |
| 4.4 | DPO : désignation obligatoire ? (suivi régulier et systématique à grande échelle / données sensibles) | variable `legal.dpo_email` | ⬜ |
| 4.5 | Durées de conservation (justificatifs pros, comptabilité, logs, signalements, consentements, analytique) | valeurs par défaut configurables ; plusieurs **[À COMPLÉTER]** dans le registre | ⬜ |
| 4.6 | Cookies et traceurs (CNIL) : bannière, preuve, durée 6 mois, absence de traceurs tiers | conforme par conception ; à revalider si un outil de mesure est ajouté | 🟡 |
| 4.7 | Contrats de sous-traitance (hébergeur, S3, SMTP, Stripe) et transferts hors UE | liste dans le registre, DPA à signer | ⬜ |
| 4.8 | Collecte de justificatifs des pros (Kbis, assurance, diplômes) et **casier judiciaire / honorabilité** pour la garde d'enfants : base légale, qui peut l'exiger, conservation | **non collecté** (aucune case « casier judiciaire ») ; attestation sur l'honneur non demandée ; à décider | ⬜ |
| 4.9 | Droit à l'image (photos de fiches, d'évènements, d'enfants) | alt obligatoire, pas de photo d'enfant exigée ; mention CGU ; autorisation de diffusion dans la liste des moments photo (`shot_list_items`) | ⬜ |

## 5. Mineurs

| # | Question | Statut |
|---|---|---|
| 5.1 | Âge minimum d'inscription (CGU : majeurs), traitement des mineurs invités (âge seulement) | ⬜ |
| 5.2 | Information adaptée aux parents sur la garde (qui voit quoi, combien de temps) — modèle de notice à fournir à l'organisateur | ⬜ |
| 5.3 | Procédure de remise d'un enfant : responsabilité en cas d'incident, formation attendue des pros | ⬜ |

## 6. Accessibilité

| # | Question | Statut |
|---|---|---|
| 6.1 | Le RGAA s'applique-t-il (seuil de CA, service au public) ? déclaration, schéma pluriannuel | ⬜ |
| 6.2 | Audit d'accessibilité par un tiers avant ouverture | ⬜ |

## 7. Assurances et responsabilité

| # | Question | Statut |
|---|---|---|
| 7.1 | RC professionnelle de la plateforme (intermédiation, hébergement de données sensibles) | ⬜ |
| 7.2 | Exigence d'une RC pro / assurance spécifique pour les pros de la garde ; vérification de l'attestation (`insurance_verified`) | ⬜ |
| 7.3 | Clauses de limitation de responsabilité (CGU) conformes au droit de la consommation | ⬜ |

## 8. Propriété intellectuelle et contenus

| # | Question | Statut |
|---|---|---|
| 8.1 | Licence accordée par les pros sur leurs contenus (textes, photos) et templates | ⬜ |
| 8.2 | Marque « Sous Nos Ailes », nom de domaine, logo | ⬜ |

## Pré-requis techniques déjà en place pour la mise en ligne juridique

- Variables `legal.*` dans `/admin/parametres` (raison sociale, adresse, SIRET, TVA, directeur de publication, DPO, hébergeur, médiateur, e-mail de contact).
- Pages éditoriales `/admin/contenus` : remplacer les gabarits par les textes validés, passer en `published` (le bandeau « Brouillon » disparaît).
- `billing.live_enabled`, `INDEXING_ENABLED` restent à `false` tant que les points 1, 3, 4 ne sont pas levés.
