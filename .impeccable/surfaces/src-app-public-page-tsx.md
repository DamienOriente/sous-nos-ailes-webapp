---
version: 1
slug: "src-app-public-page-tsx"
primary_target: "src/app/(public)/page.tsx"
related_targets: ["src/app/(public)/layout.tsx","src/app/globals.css"]
---

# Surface brief — public site (home as primary target)

Scope: the public marketing site of Les Petits Invités (home, prestations, mariages, événements, à propos, organisation, lieux, FAQ, devis, partenaires, réseau, contact, legal). Visitor mode: Persuade. The private spaces (admin, client, intervenant, partenaire) inherit the same world in Operate mode: one text family, restrained colour, label-card headers, no decorative motion.

Audience: event organisers in France (couples, parents, company planners), on phone or laptop, weeks or months before the date. Job: understand within seconds that children at their event will be cared for by Marie's team, how it unfolds, and ask for a proposal. Action: « Parler de mon événement » (guided request). Proof available: none real; only the explained organisation, Marie's approach, and documented (fictitious, labelled) venue pages. Constraints: no invented proof, status, prices, reviews, partners; French interface; no external runtime assets; prefers-reduced-motion honoured.

## Direction contract

THESIS: The public site is a herbarium plate: one calm ivory sheet where every service, venue and step is a named, pressed specimen with its label. It refuses the category default (stock-photo hero, three icon cards, testimonial strip): nothing is "sold", everything is catalogued and explained, and the organiser is invited to add their own event to the sheet.

OWN-WORLD: Warm ivory sheet with a faint cotton-paper grain; deep sage as the committed colour carrying full-bleed bands (« Le déroulement », « L’approche de Marie », footer) and every pressed-plant illustration (sage, olive, eucalyptus, gypsophila in flat two-tone sage/ivory, no gradients); clay only on the primary action, specimen-label ink and the small pin/tape marks. Young Serif for plate titles, Figtree for all text and UI. Components: label card (ivory card, hairline sage frame, clay reference line), stamp button (solid clay, 4 px radius), hairline sage rules, specimens pinned with a tiny clay strip, status carried by dot + text + weight. No kickers, no section numbers, no icon-card trios, no gradients, no glass.

STORY: The organiser understands in one viewport who Marie is and what her team does, sees the three event families named like specimens, reads how it unfolds in five labelled steps on a sage sheet, meets Marie's approach, finds the essential questions answered, and asks for a proposal.

FIRST VIEWPORT: Desktop 1440: thin top nav (wordmark left, five links, clay CTA right). Below, a two-column plate. Left 55 %: the title in Young Serif at ~72 px over two lines (« Une attention pour les enfants, de la sérénité pour votre événement. »), one 20 px paragraph naming Marie and the service, then the clay stamp CTA « Parler de mon événement » beside a hairline link « Découvrir les prestations ». Right 45 %: a large pressed-plant composition on a lighter ivory card with a label card bottom-right listing the three event families and the (editable) zone. Under the plate, a hairline rule with the three event families as inline specimen labels. Mobile 390: title ~40 px, paragraph, full-width CTA, illustration cropped 4:3, label card beneath.

FORM: Herbarium plate (botanical specimen sheet), candidate 5 of the ordered grounded list (1 wedding stationery suite, 2 reception run-sheet, 3 Père Castor picture book, 4 garden party under a tent, 5 herbarium plate, 6 crèche transmission notebook, 7 tableware catalogue). Seed key 7857a10e. All six dealt challengers declined on both axes (audience identification, product clarity). Raises adopted: state-by-form from the emission-line rail (status never carried by hue alone); one step per full-width row from the forging bench for « Le déroulement »; stable fixed regions from the PC-98 field (nav, plate, label card keep their place at every width). Signature interaction: the hero plate settles on load (leaves fade and drift 6 px into place, 700 ms, exponential ease-out, one moment only, none under reduced motion); specimen labels underline with a short clay stroke on hover.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

Unresolved: final name, zone, prices, Marie's portrait (placeholder slot), real venues.
