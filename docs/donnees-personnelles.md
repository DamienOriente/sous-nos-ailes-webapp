# Données personnelles — inventaire, conservation, export et suppression

## Ce qui est collecté

| Donnée | Où | Finalité | Base légale envisagée |
|---|---|---|---|
| Nom, email, téléphone de l’organisateur | `User`, `EventRequest` | Étudier et préparer la prestation | Mesures précontractuelles / contrat |
| Caractéristiques de l’événement, effectifs par tranche d’âge | `EventRequest`, `Event` | Dimensionner et organiser | Idem |
| Réponses de préparation (espace, rendez-vous, contact sur place) | `Event` | Organiser la prestation | Idem |
| Consentement marketing (case non précochée) | `EventRequest.marketingOptIn` | Nouvelles occasionnelles | Consentement (révocable) |
| Coordonnées et profil des intervenants, disponibilités, qualifications déclarées | `User`, `ProviderProfile`, … | Proposer et affecter des missions | Contrat / intérêt légitime |
| Contact professionnel des lieux | `PartnerVenue` (privé) | Partenariat | Intérêt légitime |
| Candidatures et messages de contact | `Application`, `ContactMessage` | Répondre | Mesures précontractuelles |
| Journal d’audit (acteur, action, résumé) | `AuditEvent` | Traçabilité | Intérêt légitime |
| Emails sortants (destinataire, sujet) | `OutboundEmail` | Traçabilité des envois | Intérêt légitime |

**Jamais collecté** : nom, date de naissance, photo ou donnée médicale d’un enfant ; pièce d’identité ou casier judiciaire d’un intervenant.

## Cookies
- `lpi_session` : session authentifiée (technique, HttpOnly).
- `lpi_ref` : lieu partenaire d’origine, 7 jours (technique, HttpOnly, sans traceur tiers).
Aucun cookie soumis à consentement, donc aucune bannière.

## Conservation
Paramètre `dataRetentionMonths` (défaut 36 mois, modifiable dans l’administration). La purge n’est pas automatisée en V1 : procédure manuelle ci-dessous. À valider : obligations de conservation comptable des propositions acceptées.

## Export (droit d’accès)
```sql
-- Remplacer l'email
SELECT * FROM "User" WHERE email = 'x@example.test';
SELECT * FROM "EventRequest" WHERE "organizerEmail" = 'x@example.test';
SELECT e.* FROM "Event" e JOIN "User" u ON u.id = e."clientId" WHERE u.email = 'x@example.test';
```
Exporter en JSON/CSV depuis `psql` (`\copy`) ou Prisma Studio.

## Suppression (droit à l’effacement)
Distinguer :
- **Supprimable sans réserve** : messages de contact, candidatures refusées, demandes non suivies d’une prestation, comptes sans événement.
- **À conserver (à valider juridiquement)** : propositions acceptées et événements réalisés, pour la durée légale comptable ; anonymiser plutôt que supprimer (remplacer nom/email/téléphone par des valeurs neutres).

Procédure : révoquer les sessions (`Session`), supprimer ou anonymiser `User`/`EventRequest`/`Event` liés, conserver `AuditEvent` sans identifiant d’acteur (`actorId` passe à NULL par `onDelete: SetNull`).
