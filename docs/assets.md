# Ressources visuelles — provenance

- **Illustrations** : SVG originaux générés procéduralement dans `src/components/illustrations/` (planche d’herbier, brindilles, placeholder de portrait, schémas de lieux). Auteur : ce dépôt. Aucune image externe, aucun chargement réseau au runtime.
- **Grain papier** : SVG inline (feTurbulence) dans `src/app/globals.css`.
- **Icône** : `public/icon.svg`, originale.
- **Polices** : Young Serif (`@fontsource/young-serif`) et Figtree (`@fontsource-variable/figtree`), licence SIL Open Font License 1.1, fichiers copiés dans le bundle.
- **Portrait de Marie** : aucun. Un emplacement éditable est réservé (`PortraitPlaceholder`) ; aucune photo de personne n’est présentée comme Marie.
- **QR codes** : générés à la volée par la bibliothèque `qrcode` (MIT).
