# Guide utilisateur

Quatre façons d'utiliser Sous Nos Ailes : organiser un évènement, proposer ses services comme professionnel, assurer la garde d'enfants le jour J, répondre à une invitation. Un même compte peut cumuler les trois premiers rôles.

## Organisateur

1. **Créer un compte** (`/inscription?intent=organizer`), confirmer l'e-mail, activer si souhaité la double authentification (`/app/compte/securite`).
2. **Trouver des professionnels** : annuaire (`/annuaire`, par métier et par ville/département), fiches `/pro/<slug>`. Les mentions « vérifié » décrivent exactement le contrôle effectué. Envoyer une demande de contact, de disponibilité ou de devis depuis la fiche ; suivre les réponses dans `/app/evenements/<id>/demandes` ou `/app/notifications`.
3. **Créer l'évènement** (`/app/evenements/nouveau`) : type, date (éventuellement provisoire), lieu, nombre d'invités et d'enfants, budget. Une liste de tâches adaptée est générée (`/taches`).
4. **Réunir l'équipe** (`/equipe`) : inviter coorganisateurs, wedding planner, prestataires (depuis l'annuaire ou prestataires externes) par lien sécurisé ; chacun reçoit un rôle. Ajuster une permission au cas par cas (par exemple autoriser le wedding planner à voir les données de santé des enfants) ; une permission refusée l'emporte toujours.
5. **Préparer** : planning du jour J (`/planning`, export ICS), budget prévu/engagé/payé (`/budget`, export), documents (devis, contrats — `/documents`), messagerie par canaux (`/messages` ; l'organisateur voit tous les canaux).
6. **Invités** (`/invites`) : import CSV, groupes, enfants (âge seulement), préférence alimentaire ; **invitations** (`/invitations`) individuelles ou par famille, lien de réponse, rappels ; QR codes pour le contrôle d'accès ; **plan de table** (`/plan-de-table`, offre Plus, export PDF).
7. **Enfants** (`/enfants`) : inscrire chaque enfant avec son responsable légal, les personnes autorisées à le récupérer et, avec le consentement explicite des parents, les allergies ou consignes médicales. Affecter l'équipe de garde (`/enfants/equipe`). Ce que voit l'équipe est limité aux enfants qui lui sont confiés.
8. **Le jour J** : check-in des invités au QR code (`/checkin`), suivi des présences enfants, journal des remises. Après l'évènement, archiver ; les données des enfants sont anonymisées automatiquement après 30 jours.

Offre gratuite : 3 évènements, annuaire, demandes, tâches, planning, 50 contacts, 60 invitations. **Organisateur Plus** (9,90 € TTC/mois, sans engagement) : plan de table, invitations personnalisées et QR codes illimités, budget avancé, exports. Souscription et résiliation en ligne : `/app/compte/abonnement`.

## Professionnel

1. **Créer un compte** (`/inscription?intent=professional`), puis l'onboarding (`/onboarding/professionnel`) : métier principal (formulaire adapté : garde d'enfants, animation, lieu, traiteur, photo, DJ…), zone d'intervention, tarifs indicatifs, langues, types d'évènements.
2. **Compléter la fiche** (`/app/pro/<id>/fiche`) et les prestations (`/prestations`) ; le score de complétude guide ce qui manque.
3. **Vérification** (`/verification`) : déposer Kbis/SIRENE, attestation d'assurance, qualifications. Chaque pièce examinée par l'équipe donne une mention précise sur la fiche (« immatriculation consultée », « documents examinés »). Les pièces ne sont jamais publiques.
4. **Page publique** (`/page`) : choisir un modèle (`/templates`), composer par blocs (texte, galerie, prestations, FAQ, contact), prévisualiser, soumettre. La fiche est relue avant publication et après toute modification importante ; les décisions sont motivées et contestables.
5. **Demandes** (`/demandes`) : chaque demande a un statut (nouvelle, vue, devis envoyé, acceptée, déclinée…) ; joindre un devis en PDF.
6. **Disponibilités et agenda** (`/disponibilites`, `/app/calendrier`) : créneaux hebdomadaires, indisponibilités, import/export ICS ; synchronisation Google/Outlook avec l'offre Premium.
7. **Évènements où vous intervenez** : une fois l'invitation d'un organisateur acceptée, l'évènement apparaît dans `/app/evenements` avec uniquement les sections utiles à votre métier (planning, documents partagés, canal de messagerie, outils métier : convives et régimes pour un traiteur, brief musical pour un DJ, liste des moments pour un photographe, espaces et logistique pour un lieu).
8. **Avis** (`/avis`) : répondre publiquement ; signaler un avis abusif.

**Professionnel Premium** (19,90 € TTC/mois) : bibliothèque complète de modèles, personnalisation avancée, outils métier premium, statistiques (`/statistiques`), assistant SEO (`/seo`), synchronisation d'agenda, éligibilité aux emplacements sponsorisés.

## Professionnel de la garde d'enfants

Vous avez les outils des professionnels, plus un espace dédié dans chaque évènement :

- **Enfants confiés** (`/enfants`) : liste des enfants qui vous sont affectés, âge, consignes, personnes autorisées. Les informations de santé ne s'affichent qu'après action explicite, uniquement si les parents ont consenti, et chaque consultation est enregistrée (le parent et l'organisateur peuvent le voir).
- **Présences** : arrivée, départ, incident, note.
- **Remise** : choisir la personne autorisée, indiquer comment l'identité a été vérifiée, confirmer. Un QR code ne remplace jamais cette confirmation.
- **Programme d'activités** (`/enfants/activites`) par tranche d'âge.
- **Journal** (`/enfants/journal`) : historique consultable.

Rien de ce qui concerne la santé d'un enfant ne vous est envoyé par e-mail ou notification : tout se consulte dans l'espace sécurisé.

## Invité

- Vous recevez un lien d'invitation (`/invitation/<jeton>`) : répondre (présent, absent, peut-être), nombre de personnes, message ; pour une invitation famille, répondre par personne. Aucun compte n'est nécessaire.
- Le jour J, votre QR code personnel est contrôlé à l'entrée ; il ne contient aucune donnée personnelle.
- Vos données sont traitées par l'organisateur, responsable de son évènement ; pour les faire rectifier ou supprimer, adressez-vous à lui ou écrivez-nous (`/droits-rgpd`).

## Compte, confidentialité, aide

- `/app/compte` : profil, notifications, sécurité (mot de passe, 2FA, sessions), fichiers, abonnement.
- `/app/compte/confidentialite` : export de vos données (JSON), demandes de rectification/limitation/opposition, historique des consentements, préférences cookies, demande de suppression de compte (traitée par une personne sous 30 jours).
- Signaler un contenu : `/signalement` (sans compte). Nous écrire : `/contact`. Accessibilité : `/accessibilite`.
