/**
 * Default legal documents, used when the editorial page is absent from the
 * database. They are STRUCTURED DRAFTS: every fact about the publisher comes
 * from a `{{legal.*}}` variable, every point that depends on a business or
 * legal decision is marked "[À COMPLÉTER]". Nothing here is invented: no
 * address, registration number, insurer, certification or mediator is named.
 */
export const LEGAL_SLUGS = ["mentions-legales", "cgu", "cgv", "confidentialite", "cookies", "moderation", "signalement-procedure", "abonnements", "droits-rgpd"] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export const DRAFT_NOTICE = "Brouillon à valider par un professionnel du droit avant toute mise en ligne.";

export type LegalDefault = { slug: LegalSlug; title: string; summary: string; body: string };

const PUBLISHER_BLOCK = `## Éditeur du service
Le site sousnosailes.fr (ci-après « la Plateforme ») est édité par **{{legal.company_name}}**, dont le siège est situé {{legal.company_address}}.
- SIRET : {{legal.siret}}
- TVA intracommunautaire : {{legal.vat_number}}
- Responsable de la publication : {{legal.publication_director}}
- Contact : {{legal.contact_email}}
- Contact protection des données : {{legal.dpo_email}}

## Hébergement
La Plateforme est hébergée par {{legal.host}}.`;

export const LEGAL_DEFAULTS: Record<LegalSlug, LegalDefault> = {
  "mentions-legales": {
    slug: "mentions-legales",
    title: "Mentions légales",
    summary: "Identité de l'éditeur, hébergeur, propriété intellectuelle et responsabilité.",
    body: `> ${DRAFT_NOTICE}

${PUBLISHER_BLOCK}

## Nature du service
Sous Nos Ailes est une plateforme de mise en relation et de coordination entre des personnes qui organisent un évènement (particuliers ou organisations) et des professionnels indépendants (garde d'enfants évènementielle, animation, prestataires de l'évènementiel). La Plateforme n'est ni l'employeur, ni le mandataire des professionnels référencés ; elle ne fournit pas elle-même les prestations. [À COMPLÉTER : qualification juridique précise du rôle de la Plateforme après analyse, voir docs/legal-review.md.]

## Propriété intellectuelle
Les éléments de la Plateforme (textes, illustrations, logos, structure) sont protégés par le droit de la propriété intellectuelle. Les contenus publiés par les professionnels (textes, photos) restent leur propriété ; ils accordent à la Plateforme une licence d'affichage limitée à la diffusion de leur fiche. [À COMPLÉTER : étendue exacte de la licence.]

## Responsabilité
Les informations figurant sur les fiches professionnelles sont déclarées par les professionnels eux-mêmes. Les mentions de vérification affichées décrivent précisément ce qui a été contrôlé par l'équipe de la Plateforme et ne constituent ni une certification, ni une garantie de qualité ou de sécurité de la prestation.

## Signalement d'un contenu
Tout contenu illicite ou inapproprié peut être signalé depuis la page [Signaler un contenu](/signalement). La procédure est décrite dans la [procédure de signalement](/signalement-procedure).

## Médiation et litiges
[À COMPLÉTER : médiateur de la consommation désigné ({{legal.mediator}}) et modalités de saisine ; droit applicable ; juridiction compétente.]`,
  },
  cgu: {
    slug: "cgu",
    title: "Conditions générales d'utilisation",
    summary: "Règles d'utilisation de la Plateforme pour les organisateurs, les professionnels et les invités.",
    body: `> ${DRAFT_NOTICE}

## Objet
Les présentes conditions encadrent l'utilisation de la Plateforme éditée par {{legal.company_name}} : création d'un compte, publication d'une fiche professionnelle, organisation d'un évènement, échange de demandes et de messages, utilisation des outils de coordination.

## Comptes
- L'inscription est réservée aux personnes majeures. [À COMPLÉTER : traitement des mineurs émancipés / organisations.]
- Chaque personne est responsable de la confidentialité de ses identifiants et des actions réalisées depuis son compte. L'authentification à deux facteurs est proposée.
- Les comptes de démonstration sont fictifs et clairement signalés.

## Rôle de la Plateforme
La Plateforme met en relation et fournit des outils de coordination. Elle n'est pas partie aux contrats conclus entre un organisateur et un professionnel, ne fixe pas leurs prix et ne perçoit pas leurs paiements. [À COMPLÉTER : confirmation du statut d'intermédiaire et des obligations associées (information, loyauté, transparence des classements).]

## Fiches professionnelles et vérification
- Les professionnels déclarent exercer légalement leur activité et détenir les assurances et qualifications requises par leur métier.
- Avant publication, chaque fiche est relue par l'équipe de modération. Les niveaux de vérification affichés indiquent ce qui a été contrôlé (pièces déclarées, immatriculation consultée, documents examinés) et rien de plus.
- Toute modification substantielle d'une fiche publiée peut être soumise à une nouvelle relecture.

## Contenus et comportements interdits
Sont notamment interdits : les contenus illicites, trompeurs ou discriminatoires, les faux avis, l'usurpation d'identité, la collecte de données d'autres utilisateurs, toute tentative d'accéder à des données qui ne vous sont pas destinées.

## Données des enfants
Les organisateurs qui renseignent des informations sur des enfants garantissent avoir informé les parents ou responsables légaux et, pour les informations de santé, avoir recueilli leur consentement explicite. Ces données sont chiffrées, accessibles uniquement à l'équipe de garde concernée, et anonymisées après l'évènement. Voir la [politique de confidentialité](/confidentialite).

## Avis
Les avis sont réservés aux personnes ayant eu une interaction vérifiable avec le professionnel (demande ou participation à un évènement). Ils sont modérés avant publication. [À COMPLÉTER : conformité aux obligations d'information sur les avis en ligne.]

## Classements et emplacements sponsorisés
Les résultats de l'annuaire sont classés selon la pertinence (métier, zone, complétude, vérification). Les emplacements sponsorisés sont identifiés comme tels et n'exemptent pas de la modération. [À COMPLÉTER : description détaillée des critères de classement.]

## Suspension et résiliation
La Plateforme peut suspendre ou supprimer un compte ou une fiche en cas de manquement, après information de la personne concernée et avec possibilité de recours (voir la [politique de modération](/moderation)). Chaque utilisateur peut fermer son compte depuis son espace ; les données sont alors traitées selon la politique de confidentialité.

## Responsabilité
La Plateforme s'engage à fournir un service disponible et sécurisé, sans garantir l'absence d'interruption. Elle ne répond pas de l'exécution des prestations convenues entre utilisateurs. [À COMPLÉTER : clauses de limitation conformes au droit de la consommation.]

## Modification des conditions
Les utilisateurs sont informés par e-mail de toute modification substantielle au moins [À COMPLÉTER : délai] jours avant son entrée en vigueur.

## Droit applicable
[À COMPLÉTER : droit applicable, médiation ({{legal.mediator}}), juridiction.]`,
  },
  cgv: {
    slug: "cgv",
    title: "Conditions générales de vente",
    summary: "Abonnements payants proposés aux organisateurs et aux professionnels.",
    body: `> ${DRAFT_NOTICE}

## Champ d'application
Les présentes conditions régissent les abonnements payants proposés par {{legal.company_name}} aux utilisateurs de la Plateforme : offre « Organisateur Plus » et offre « Professionnel Premium ». Les fonctionnalités gratuites restent soumises aux [conditions d'utilisation](/cgu).

## Offres et prix
Les offres, leur contenu et leur prix sont décrits sur la page [Tarifs](/tarifs). Les prix sont indiqués en euros, toutes taxes comprises pour les consommateurs. [À COMPLÉTER : mention HT/TTC pour les professionnels, taux de TVA applicable.]

## Souscription et paiement
- L'abonnement est souscrit en ligne depuis l'espace personnel. Le paiement est traité par un prestataire de paiement tiers ; la Plateforme ne stocke aucune donnée de carte.
- Le paiement est mensuel, prélevé à chaque date anniversaire.
- Aucun paiement réel n'est possible tant que le service est en phase de démonstration.

## Droit de rétractation
Les consommateurs disposent d'un délai de rétractation de quatorze jours à compter de la souscription. [À COMPLÉTER : modalités d'exercice, conséquences lorsque le service a été exécuté à la demande du consommateur avant la fin du délai, formulaire type.]

## Durée, renouvellement et résiliation
L'abonnement est sans engagement, renouvelé tacitement chaque mois et résiliable à tout moment depuis l'espace personnel, en au plus trois clics. La résiliation prend effet à la fin de la période en cours ; aucune pénalité n'est appliquée. [À COMPLÉTER : conformité résiliation en ligne, information précontractuelle.]

## Modification des prix
Toute modification de prix est notifiée par e-mail au moins [À COMPLÉTER : délai] jours avant application ; l'abonné peut résilier avant l'entrée en vigueur.

## Garanties et réclamations
Les réclamations sont adressées à {{legal.contact_email}}. [À COMPLÉTER : garanties légales applicables aux services numériques, médiateur de la consommation {{legal.mediator}}.]`,
  },
  confidentialite: {
    slug: "confidentialite",
    title: "Politique de confidentialité",
    summary: "Quelles données nous traitons, pourquoi, combien de temps, avec qui, et vos droits.",
    body: `> ${DRAFT_NOTICE}

## Responsable du traitement
{{legal.company_name}}, {{legal.company_address}}. Contact protection des données : {{legal.dpo_email}}. [À COMPLÉTER : désignation formelle d'un DPO si requise.]

## Ce que nous collectons et pourquoi
- **Compte** (nom, e-mail, mot de passe haché, téléphone facultatif, préférences) : exécution du contrat ; conservation : durée du compte puis {{retention.inactive_account_months}} mois d'inactivité avant traitement de suppression.
- **Fiche professionnelle** (activité, zone, tarifs, photos, pièces justificatives) : exécution du contrat et intérêt légitime (sécurité de la mise en relation) ; les pièces justificatives ne sont visibles que par l'équipe de modération. [À COMPLÉTER : base légale et durée exactes pour les justificatifs.]
- **Évènements, invités, contacts** : données saisies par l'organisateur sous sa responsabilité ; conservation : durée de l'évènement puis archivage/suppression par l'organisateur.
- **Enfants pris en charge** (prénom, âge, responsable légal, personnes autorisées, consignes) : exécution de la prestation de garde, au nom de l'organisateur ; anonymisation automatique {{retention.children_days_after_event}} jours après la fin de l'évènement.
- **Informations de santé d'un enfant** (allergies, consignes médicales) : consentement explicite du responsable légal, chiffrement colonne par colonne, accès réservé à l'équipe de garde affectée, chaque consultation journalisée.
- **Messages et demandes** : exécution du contrat ; conservation : durée de l'évènement ou de la relation commerciale.
- **Journaux techniques et de sécurité** (adresse IP, actions sensibles) : intérêt légitime (sécurité) ; conservation : {{retention.audit_logs_months}} mois.
- **Mesure d'audience** : uniquement avec votre consentement (voir la [politique cookies](/cookies)) ; aucun outil tiers n'est utilisé en V1.

## Destinataires et sous-traitants
Les données sont hébergées en Union européenne chez {{legal.host}}. Nous recourons à des sous-traitants pour le paiement, l'envoi d'e-mails transactionnels et le stockage de fichiers. [À COMPLÉTER : liste nominative, pays, garanties.] Aucune donnée n'est vendue.

## Partage entre utilisateurs
Les membres d'un évènement ne voient que ce que leur rôle autorise. L'organisateur peut lire tous les canaux de son évènement ; cette règle est affichée dans la messagerie. Les professionnels de la garde d'enfants n'accèdent qu'aux enfants qui leur sont confiés.

## Vos droits
Accès, rectification, effacement, limitation, opposition, portabilité, retrait du consentement : depuis [votre espace](/app/compte/confidentialite) ou par e-mail à {{legal.dpo_email}}. Nous répondons sous un mois. Vous pouvez saisir la CNIL. Détails sur la page [Vos droits](/droits-rgpd).

## Sécurité
Authentification à deux facteurs, sessions révocables, chiffrement des données sensibles, analyse antivirus des fichiers, journalisation des accès, sauvegardes chiffrées. Les mesures sont décrites dans notre documentation de sécurité.

## Mise à jour
Dernière mise à jour : [À COMPLÉTER]. Les modifications substantielles sont notifiées par e-mail.`,
  },
  cookies: {
    slug: "cookies",
    title: "Politique cookies",
    summary: "Quels cookies sont déposés, lesquels nécessitent votre accord, et comment changer d'avis.",
    body: `> ${DRAFT_NOTICE}

## Cookies strictement nécessaires
Ils permettent la connexion, la sécurité (protection CSRF, limitation des tentatives) et la mémorisation de vos choix de consentement (cookie « sna_consent », 6 mois). Ils ne requièrent pas de consentement et ne peuvent pas être désactivés.

## Mesure d'audience
Aucun outil de mesure d'audience n'est actif dans cette version. Si nous en activons un, il ne sera chargé qu'après votre accord explicite et la liste des traceurs sera publiée ici.

## Marketing
Aucun cookie publicitaire ou de suivi marketing n'est utilisé.

## Votre choix
Refuser est aussi simple qu'accepter : les deux boutons ont le même poids. Vous pouvez modifier vos préférences à tout moment ci-dessous ou depuis votre espace. Votre choix est conservé six mois, puis nous vous le redemandons.`,
  },
  moderation: {
    slug: "moderation",
    title: "Politique de modération",
    summary: "Comment les fiches, avis et contenus sont relus, les décisions possibles et les recours.",
    body: `> ${DRAFT_NOTICE}

## Ce qui est modéré
- Les fiches professionnelles avant leur première publication et après une modification substantielle.
- Les pièces justificatives transmises pour les vérifications.
- Les avis avant publication.
- Les contenus signalés (fiches, messages, avis, comptes).

## Critères
Exactitude des informations déclarées, respect des [conditions d'utilisation](/cgu), absence de contenu illicite ou trompeur, cohérence entre le métier déclaré et les services proposés, qualité des photos (droit à l'image des personnes et des enfants). [À COMPLÉTER : exigences spécifiques par métier : diplômes, agréments.]

## Décisions possibles
Approbation, demande de modifications, refus, suspension, rétablissement. Chaque décision est motivée par écrit, notifiée à la personne concernée et conservée dans un historique.

## Niveaux de vérification
Les niveaux affichés décrivent précisément les contrôles effectués : identité déclarée, immatriculation consultée, documents examinés, assurance déclarée, qualification déclarée. Ils ne constituent pas une certification ni une garantie.

## Recours
Toute personne visée par une décision peut la contester depuis son espace dans un délai de [À COMPLÉTER] jours. Le recours est examiné par une personne différente de celle qui a pris la décision initiale.

## Délais indicatifs
Relecture d'une fiche : [À COMPLÉTER]. Traitement d'un signalement : accusé de réception immédiat, décision sous [À COMPLÉTER].`,
  },
  "signalement-procedure": {
    slug: "signalement-procedure",
    title: "Procédure de signalement",
    summary: "Comment signaler un contenu, ce qui se passe ensuite, et les garanties pour toutes les parties.",
    body: `> ${DRAFT_NOTICE}

## Signaler
Utilisez le formulaire [Signaler un contenu](/signalement). Aucun compte n'est nécessaire. Indiquez le type de contenu, le motif et, si vous le souhaitez, une adresse e-mail pour être tenu informé.

## Traitement
1. Chaque signalement ouvre un dossier de modération horodaté.
2. L'équipe examine le contenu signalé et peut le rendre temporairement invisible pendant l'analyse.
3. Une décision motivée est prise et notifiée à l'auteur du contenu ; le signalant est informé s'il a laissé une adresse.
4. L'auteur du contenu peut contester la décision (voir la [politique de modération](/moderation)).

## Signalements abusifs
Les signalements répétés manifestement infondés peuvent entraîner la limitation de l'accès au formulaire.

## Contenus illicites et autorités
Lorsque la loi l'exige, nous conservons les éléments nécessaires et coopérons avec les autorités compétentes. [À COMPLÉTER : obligations issues de la LCEN et du règlement sur les services numériques, point de contact unique.]`,
  },
  abonnements: {
    slug: "abonnements",
    title: "Abonnements et résiliation",
    summary: "Fonctionnement des offres payantes, facturation, résiliation en ligne et remboursement.",
    body: `> ${DRAFT_NOTICE}

## Deux offres payantes
« Organisateur Plus » et « Professionnel Premium », décrites sur la page [Tarifs](/tarifs). Tout le reste est gratuit.

## Facturation
Mensuelle, sans engagement, par un prestataire de paiement tiers. Les factures sont disponibles dans votre espace. [À COMPLÉTER : mentions obligatoires de facturation.]

## Résiliation en ligne
Depuis « Mon compte » puis « Abonnement » : la résiliation prend effet à la fin de la période payée. Vous conservez l'accès jusqu'à cette date et vos données ne sont pas supprimées.

## Changement d'offre
Le passage d'une offre gratuite à une offre payante est immédiat. Le retour à l'offre gratuite s'applique à la fin de la période en cours.

## Remboursement
[À COMPLÉTER : politique de remboursement, droit de rétractation et cas d'exécution anticipée.]

## Fin de l'offre payante
Les fonctionnalités premium redeviennent inaccessibles mais aucune donnée n'est détruite ; elles réapparaissent si vous souscrivez de nouveau.`,
  },
  "droits-rgpd": {
    slug: "droits-rgpd",
    title: "Vos droits sur vos données",
    summary: "Accès, rectification, effacement, limitation, opposition, portabilité : comment les exercer.",
    body: `> ${DRAFT_NOTICE}

## Depuis votre espace
La page [Confidentialité de mon compte](/app/compte/confidentialite) vous permet de :
- télécharger une copie de vos données (format JSON) ;
- demander une rectification, une limitation ou vous opposer à un traitement ;
- consulter l'historique de vos consentements et modifier vos préférences cookies ;
- demander la suppression de votre compte.

## Par e-mail
Écrivez à {{legal.dpo_email}} en précisant le droit exercé. Nous pouvons vous demander de confirmer votre identité lorsque la demande ne provient pas de votre compte connecté.

## Délais
Nous répondons dans un délai d'un mois, prolongeable de deux mois pour les demandes complexes ; vous en êtes alors informé.

## Suppression d'un compte
La demande est traitée par une personne de l'équipe sous un mois. Certaines données peuvent être conservées temporairement pour des obligations légales (facturation, sécurité, litiges) ; elles sont alors isolées et ne servent qu'à ces finalités. [À COMPLÉTER : durées légales précises.]

## Données saisies par un organisateur
Si vos données figurent dans un évènement (invité, contact, enfant) sans que vous ayez de compte, adressez-vous d'abord à l'organisateur, responsable de ces données, ou écrivez-nous : nous transmettons et vous aidons à faire valoir vos droits.

## Réclamation
Vous pouvez saisir la CNIL (cnil.fr) si vous estimez que vos droits ne sont pas respectés.`,
  },
};

export function isLegalSlug(value: string): value is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(value);
}
