# Visuels et sources

## Photographies de démonstration
- Catalogue : `src/modules/media/demo-photos.ts` (108 photos vérifiées visuellement une à une le 2026-10-17, description comparée à l'image réelle), servies depuis `images.unsplash.com` (licence Unsplash : usage libre, pas d'attribution obligatoire, revente de la photo interdite).
- Usage autorisé : profils fictifs, pages marketing de l'environnement de démonstration, états vides illustrés. Aucune photo ne représente un vrai professionnel de la plateforme.
- Avant commercialisation : remplacer par des photographies sous licence ou produites pour la marque, ou obtenir les visuels des professionnels réels avec leur accord (droit à l'image des personnes photographiées à vérifier, en particulier pour les enfants).
- Composant : `DemoPhoto` (`src/components/shared/demo-photo.tsx`), `next/image` avec `remotePatterns` limité à `images.unsplash.com` (`next.config.ts`) et CSP `img-src https:`.

## Illustrations originales
- `src/components/illustrations/` : scènes SVG dessinées pour la charte (ailes, coin enfants, table de réception, musique, photo, fleurs, agenda, confettis). Propriété du projet, aucune licence tierce.
- Les couleurs utilisent les tokens (`currentColor`, variables `--sna-*`) pour rester cohérentes en mode sombre.

## Images téléversées par les professionnels
- Toujours passées par le pipeline fichiers (quarantaine, antivirus, suppression EXIF, variantes WebP) et servies par URL signée ; voir `docs/security.md`.

## Règles d'attribution des photos de démonstration
- **Jamais deux fois la même photo** : chaque photo est attribuée à une seule fiche professionnelle (`allocatePhotos` dans `src/db/seed/files.ts`), et une page n'affiche jamais deux fois la même image (contrôlé par crawl sur 52 pages).
- **Cohérence métier** : une fiche ne reçoit que des photos des thèmes de son métier (`CATEGORY_PHOTO_THEMES`) ; si le catalogue n'en a plus, elle en reçoit moins plutôt qu'une photo hors sujet. Les galeries vides ne sont pas remplacées par des visuels générés.
- **Photos vitrine réservées** (`RESERVED_PHOTO_IDS`) : une photo exacte par métier (`CATEGORY_COVER_IDS`) et les emplacements nommés du site public, de l'onboarding et des couvertures d'évènements (`SHOWCASE`). Elles ne sont jamais données aux fiches, sauf la photo vitrine de son propre métier en galerie.
- Ajouter une photo : l'ajouter à `DEMO_PHOTOS` avec un thème et une description fidèles à l'image **après l'avoir regardée** (une description devinée a déjà produit trois erreurs).
- Le catalogue reste limité : pour des galeries plus fournies, brancher l'API Unsplash (clé gratuite) ou fournir des visuels propres.
