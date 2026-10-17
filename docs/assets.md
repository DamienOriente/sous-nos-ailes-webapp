# Visuels et sources

## Photographies de démonstration
- Catalogue : `src/modules/media/demo-photos.ts` (75 photos vérifiées visuellement le 2026-10-17), servies depuis `images.unsplash.com` (licence Unsplash : usage libre, pas d'attribution obligatoire, revente de la photo interdite).
- Usage autorisé : profils fictifs, pages marketing de l'environnement de démonstration, états vides illustrés. Aucune photo ne représente un vrai professionnel de la plateforme.
- Avant commercialisation : remplacer par des photographies sous licence ou produites pour la marque, ou obtenir les visuels des professionnels réels avec leur accord (droit à l'image des personnes photographiées à vérifier, en particulier pour les enfants).
- Composant : `DemoPhoto` (`src/components/shared/demo-photo.tsx`), `next/image` avec `remotePatterns` limité à `images.unsplash.com` (`next.config.ts`) et CSP `img-src https:`.

## Illustrations originales
- `src/components/illustrations/` : scènes SVG dessinées pour la charte (ailes, coin enfants, table de réception, musique, photo, fleurs, agenda, confettis). Propriété du projet, aucune licence tierce.
- Les couleurs utilisent les tokens (`currentColor`, variables `--sna-*`) pour rester cohérentes en mode sombre.

## Images téléversées par les professionnels
- Toujours passées par le pipeline fichiers (quarantaine, antivirus, suppression EXIF, variantes WebP) et servies par URL signée ; voir `docs/security.md`.
