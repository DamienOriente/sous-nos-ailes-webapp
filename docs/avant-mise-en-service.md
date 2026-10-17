# Avant mise en service réelle — validations nécessaires

Ce document liste ce qui doit être **réellement validé** avant d’exploiter l’application avec de vrais clients. Rien de ce qui suit n’est acquis ni vérifié par le logiciel.

## 1. Statut de Marie et cumul d’activité
- Vérifier la compatibilité de l’activité avec son contrat de travail en crèche (clause d’exclusivité, obligation de loyauté, information ou autorisation de l’employeur, cumul si fonction publique).
- Choisir le statut juridique de l’activité (micro-entreprise, société…) et ses conséquences sociales et fiscales.

## 2. Cadre des prestations et âges accueillis
- Définir précisément le périmètre : garde collective ponctuelle lors d’événements, avec ou sans parents sur place.
- Trancher l’accueil des enfants de moins de 3 ans (le logiciel signale une « étude spécifique », il ne l’autorise pas).
- Fixer les repères d’effectif par âge (paramètres internes dans l’administration) après avis d’un professionnel ; ne jamais les présenter comme réglementaires.
- Vérifier si une déclaration ou un agrément est requis pour l’activité envisagée (accueil collectif de mineurs, réglementation locale).

## 3. Assurance
- Souscrire une responsabilité civile professionnelle couvrant la garde d’enfants en événement, les intervenants indépendants et les lieux tiers.
- Vérifier la couverture des intervenants (leur propre RC) et des lieux partenaires.

## 4. Contrats clients
- Rédiger des conditions commerciales : nature de la prestation, acompte, annulation, responsabilités, horaires, remise et reprise des enfants.
- Préciser que l’« accord de principe » dans l’application n’est pas une signature électronique certifiée ; prévoir un contrat ou un devis signé.

## 5. Relations avec les intervenants
- Définir le statut (indépendants : contrat de prestation, facturation ; sinon salariat) et prévenir le risque de requalification.
- Encadrer la vérification des qualifications et des antécédents (le logiciel ne stocke aucun document sensible en V1).
- Formaliser la rémunération (les « coûts convenus » du logiciel sont des valeurs de démonstration).

## 6. Modèle économique et régime fiscal
- Fixer les tarifs réels (paramètres commerciaux) et le régime de TVA (franchise en base ou assujettissement) : le mode « aucune TVA » par défaut n’est pas une déclaration de franchise.
- Ne pas promettre le crédit d’impôt services à la personne sans analyse.

## 7. Données personnelles
- Finaliser la politique de confidentialité (brouillon dans l’application), le registre des traitements, les durées de conservation (paramètre `dataRetentionMonths`), la procédure d’export/suppression (voir `docs/donnees-personnelles.md`).
- Vérifier l’hébergement (localisation, sous-traitants) et les mentions d’information sur les formulaires.

## 8. Droits sur les visuels
- Les illustrations sont des SVG originaux du dépôt (voir `docs/assets.md`). Toute photo ajoutée doit disposer d’un droit d’usage écrit et ne jamais présenter une personne comme Marie sans son accord.
- Les polices (Young Serif, Figtree) sont sous licence OFL-1.1.

## 9. Informations légales et conditions commerciales
- Compléter les mentions légales (éditeur, SIREN, hébergeur), les CGV, les coordonnées réelles.
- Vérifier la disponibilité du nom « Les Petits Invités » (marque, nom de domaine) : non vérifiée.

## 10. Mise en production technique
- `APP_ENV=production`, `DEMO_MODE=false`, `SESSION_SECRET` fourni, `APP_URL` réel, HTTPS, SMTP réel.
- Supprimer les comptes et lieux de démonstration (`pnpm db:reset` n’est pas adapté en prod : repartir d’une base vide, seed sans démo).
- Activer `INDEXING_ENABLED=true` seulement après relecture des contenus ; contrôler `robots.txt`, le sitemap et les balises `noindex`.
- Mettre en place sauvegardes, supervision, rate limiting partagé si plusieurs instances, revue de sécurité du module d’authentification.
