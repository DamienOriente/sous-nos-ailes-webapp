---
name: Les Petits Invités — avec Marie
description: Herbarium plate — an ivory sheet where services, venues and steps are pressed, labelled specimens.
colors:
  ivory-sheet: "#f7f2ea"
  ivory-card: "#fbf8f3"
  ivory-recessed: "#efe7da"
  ivory-edge: "#e3d8c6"
  ivory-deep: "#d2c4ad"
  sage-wash: "#eef3ef"
  sage-pale: "#dce6de"
  sage-hairline: "#c3d3c7"
  sage-soft: "#9fb7a6"
  sage-mid: "#7a9683"
  sage-leaf: "#5b7a66"
  sage-stem: "#486553"
  sage-band: "#3b5447"
  sage-footer: "#2e4237"
  sage-night: "#1f2f27"
  clay-wash: "#f1ded3"
  clay-pale: "#e3c0ac"
  clay-pin: "#d49e80"
  clay-tape: "#c97e58"
  clay-stroke: "#b4603a"
  clay-stamp: "#9e4f2c"
  clay-label: "#83401f"
  clay-pressed: "#633018"
  ink: "#1c231f"
  ink-body: "#3a423d"
  ink-muted: "#5c655f"
  ink-faint: "#9aa39d"
  success: "#486553"
  warning: "#8a6a1e"
  warning-wash: "#f3e8c9"
  danger: "#9b3b2e"
  danger-wash: "#f3d9d4"
  info: "#3f5f7a"
  info-wash: "#dbe5ee"
  paper-print: "#ffffff"
typography:
  display:
    fontFamily: "Young Serif, Iowan Old Style, Georgia, serif"
    fontSize: "2.5rem / 3.25rem / 4.25rem (mobile / sm / lg)"
    fontWeight: 400
    lineHeight: 1.04
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Young Serif, Iowan Old Style, Georgia, serif"
    fontSize: "2rem / 2.5rem (mobile / sm)"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Young Serif, Iowan Old Style, Georgia, serif"
    fontSize: "1.45rem / 1.5rem"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title-operate:
    fontFamily: "Figtree Variable, Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "1.5rem / 28px (mobile / md)"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  subtitle:
    fontFamily: "Figtree Variable, Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
  lead:
    fontFamily: "Figtree Variable, Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "17px / 1.125rem (mobile / sm)"
    fontWeight: 400
    lineHeight: 1.625
  body:
    fontFamily: "Figtree Variable, Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.625
  prose:
    fontFamily: "Figtree Variable, Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Figtree Variable, Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.375
    letterSpacing: "0.01em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "10px"
  xl: "16px"
  pill: "9999px"
spacing:
  gutter-mobile: "20px"
  gutter-sm: "32px"
  gutter-lg: "48px"
  container-max: "1216px"
  section-mobile: "64px"
  section-sm: "80px"
  section-lg: "96px"
  card-sm: "16px"
  card-md: "20px / 24px"
  card-lg: "24px / 32px"
  control-height: "44px"
  control-height-sm: "36px"
  control-height-lg: "48px"
components:
  button-primary:
    backgroundColor: "{colors.clay-stamp}"
    textColor: "{colors.ivory-card}"
    rounded: "{rounded.sm}"
    height: "{spacing.control-height}"
    padding: "0 20px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "{colors.clay-label}"
  button-primary-active:
    backgroundColor: "{colors.clay-pressed}"
  button-sage:
    backgroundColor: "{colors.sage-band}"
    textColor: "{colors.ivory-card}"
    rounded: "{rounded.sm}"
    height: "{spacing.control-height}"
    padding: "0 20px"
  button-sage-hover:
    backgroundColor: "{colors.sage-footer}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.sage-footer}"
    rounded: "{rounded.sm}"
    height: "{spacing.control-height}"
    padding: "0 20px"
  button-secondary-hover:
    backgroundColor: "{colors.sage-wash}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.sage-footer}"
    rounded: "{rounded.sm}"
    height: "{spacing.control-height}"
    padding: "0 20px"
  button-ghost-hover:
    backgroundColor: "{colors.sage-wash}"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.danger}"
    rounded: "{rounded.sm}"
    height: "{spacing.control-height}"
    padding: "0 20px"
  button-danger-hover:
    backgroundColor: "{colors.danger-wash}"
  input:
    backgroundColor: "{colors.ivory-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "{spacing.control-height}"
    padding: "0 14px"
    typography: "{typography.body}"
  input-disabled:
    backgroundColor: "{colors.ivory-recessed}"
    textColor: "{colors.ink-muted}"
  label-card:
    backgroundColor: "{colors.ivory-card}"
    rounded: "{rounded.md}"
    padding: "{spacing.card-md}"
  plate:
    backgroundColor: "{colors.ivory-card}"
    rounded: "{rounded.lg}"
    padding: "48px 24px"
  status-badge:
    backgroundColor: "{colors.ivory-card}"
    textColor: "{colors.ink-body}"
    rounded: "{rounded.pill}"
    padding: "4px 12px 4px 10px"
    typography: "{typography.label}"
  section-sage:
    backgroundColor: "{colors.sage-band}"
    textColor: "{colors.ivory-sheet}"
    padding: "{spacing.section-lg} 0"
  section-paper:
    backgroundColor: "{colors.ivory-card}"
    textColor: "{colors.ink}"
    padding: "{spacing.section-lg} 0"
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.ink-body}"
    typography: "{typography.body}"
  nav-link-active:
    textColor: "{colors.sage-night}"
  nav-item-operate:
    backgroundColor: "transparent"
    textColor: "{colors.ink-body}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  nav-item-operate-active:
    backgroundColor: "{colors.sage-band}"
    textColor: "{colors.ivory-card}"
---

# Design System: Les Petits Invités — avec Marie

## Overview

**Creative North Star: "The Herbarium Plate"**

Every surface is a sheet of warm, faintly grained cotton paper on which the service is catalogued rather than sold. Services, venues, steps and event families are pressed specimens: each has a name, a flat two-tone sage illustration, a hairline frame and a small clay label. Nothing is layered on glass, nothing glows, nothing moves except one settling of the hero plate on first load. The visitor is invited to add their own event to the sheet, and the clay stamp button (« Parler de mon événement ») is the only warm, saturated object on any public screen.

The public site runs in Persuade mode with a Committed colour strategy: deep sage bands (« Le déroulement », the footer) carry entire sections in reverse, and the display serif (Young Serif) sets plate titles. The private spaces (admin, client, intervenant·e, partenaire) inherit the same sheet in Operate mode with a Restrained strategy: one text family (Figtree), sage reserved for the active navigation item and confirmations, clay for the primary action and demo notices, and status always written out with a dot, a text label and weight.

Density is editorial on the public site (96 px section rhythm, 68ch prose, large serif), and compact in the private spaces (44 px controls, 15 px body, label-card headers, disclosures instead of modals). The build confirms the refused devices: no stock-photo hero, no icon-card trio, no testimonial strip (the reviews section renders nothing until real reviews exist), no gradients, no glassmorphism, no kickers, no section numbers, no uppercase tracking labels.

**Key Characteristics:**
- Warm ivory sheet with an inline-SVG cotton grain; ivory card on sheet is the only "elevation" most pages need.
- Deep sage carries whole sections in reverse on the public site; it never tints a card or a button in the private spaces except the active nav item.
- Clay is reserved for the primary action, the specimen reference line, pin strips and the caret; it is never a background for content.
- Young Serif at weight 400 for plate titles; Figtree for every other word, including all headings in Operate mode.
- Hairlines (1 px sage-200) and divided lists replace cards wherever a list is a list.
- Status = dot + text + weight; hue only reinforces.
- One authored motion: the hero plate settles once (700 ms, exponential ease-out); specimen links underline with a clay stroke on hover.

## Colors

A three-material palette: ivory paper, sage plant matter, clay fixings, with a near-black green ink for text.

### Primary
- **Sage Band** (`sage-band`): the committed colour. Full-bleed section background for « Le déroulement » and the `sage` tone of `Section`; the active item in Operate navigation; the `sage` button variant; the checked state of checkboxes and radios; the focused input border.
- **Sage Footer** (`sage-footer`): the footer sheet and the hover state of the sage button; also the resting text colour of secondary/ghost buttons and of every specimen link.
- **Sage Night** (`sage-night`): active and hovered top-nav links; the darkest step, also used as the RGB base of every shadow (31, 47, 39).
- **Sage Stem / Leaf / Mid / Soft** (`sage-stem`, `sage-leaf`, `sage-mid`, `sage-soft`): the illustration ramp. Branches, leaves and eucalyptus discs are drawn in these four steps, never in a gradient. `sage-soft` is also the scrollbar thumb and the resting input border; `sage-mid` the hover border of inputs and the secondary button stroke.
- **Sage Hairline / Pale / Wash** (`sage-hairline`, `sage-pale`, `sage-wash`): the frame of every label card and table, dividers, the `::selection` background (`sage-pale`), the focus ring of inputs (`sage-pale`), and the hover wash of ghost buttons, nav items and success alerts (`sage-wash`).

### Secondary
- **Clay Stamp** (`clay-stamp`): the primary button, the `:focus-visible` outline (2 px, 3 px offset), the caret colour, the "current" dot in the client stage tracker. Hover darkens to **Clay Label** (`clay-label`), active to **Clay Pressed** (`clay-pressed`).
- **Clay Label** (`clay-label`): the reference line on a label card (« Événements accompagnés », a file reference), the required-field asterisk.
- **Clay Stroke** (`clay-stroke`): the 2 px underline that draws under a specimen link on hover; the olive drupe in the illustrations; the clay status dot.
- **Clay Pin / Tape** (`clay-pin`, `clay-tape`): the tilted pin strips that hold each specimen (`clay-pin` at 85 % opacity) and the reference line drawn on the plate's paper label.
- **Clay Wash / Pale** (`clay-wash`, `clay-pale`): demo notices and the `demo` alert (wash background, pale border, `clay-pressed` text); step labels on the sage sheet are set in `clay-pale`.

### Neutral
- **Ivory Sheet** (`ivory-sheet`): the page background under a 160 px tiled SVG grain; the sticky header at 95 % opacity; table header rows; read-only inputs.
- **Ivory Card** (`ivory-card`): every label card, plate, input, badge, table body, the mobile menu and Operate header; also the text colour on sage and clay fills.
- **Ivory Recessed / Edge / Deep** (`ivory-recessed`, `ivory-edge`, `ivory-deep`): disabled inputs, the plate's border and the `paper` section's top/bottom rules (`ivory-edge`), the neutral badge ring (`ivory-deep`).
- **Ink** (`ink`): headings and primary text. **Ink Body** (`ink-body`): paragraphs, prose, nav links. **Ink Muted** (`ink-muted`): help text, placeholders, breadcrumbs, table headers, meta. **Ink Faint** (`ink-faint`): the neutral status dot only.
- **Semantic** (`success` = `sage-stem`, `warning`, `danger`, `info`, each with a `-wash`): alert fills and status dots. Each semantic colour always travels with a text label.
- **Paper Print** (`paper-print`): printable documents (quote, mission brief) sit on pure white and drop the grain under `@media print`.

### Named Rules
**The One Stamp Rule.** Clay fills exactly one kind of element per screen: the primary action. Everything else clay is a line, a dot, a pin or a word.
**The Sage Sheet Rule.** On the public site sage may carry a whole section in reverse; it may not tint a card. In Operate mode sage fills only the active navigation item and the checked control.
**The Dot-and-Word Rule.** Status is a 8 px dot, a text label and font weight 600 inside an ivory pill. Hue is the third signal, never the first.

## Typography

**Display Font:** Young Serif 400 (with Iowan Old Style, Georgia, serif), self-hosted via `@fontsource/young-serif`.
**Body Font:** Figtree Variable (with Avenir Next, Segoe UI, system-ui, sans-serif), self-hosted via `@fontsource-variable/figtree`.
**Label/Mono Font:** none; numerals use `font-variant-numeric: tabular-nums` (the `tabular` utility, and all tables by default).

**Character:** A warm, slightly bookish serif that only ever appears at weight 400 and a slightly negative tracking (−0.01 em), paired with a humanist sans that does every other job at 400/500/600. The serif names things; the sans explains and operates. Headings balance (`text-wrap: balance`), paragraphs wrap pretty.

### Hierarchy
- **Display** (400, 2.5rem → 3.25rem → 4.25rem, line-height 1.08 → 1.04): the home hero title and page-intro titles, Young Serif. Never above 4.25rem.
- **Headline** (400, 2rem → 2.5rem, line-height 1.15): `SectionTitle` on every public section and the closing invitation. Reversed to `ivory-card` on sage sheets.
- **Title** (400, 1.45rem–1.5rem, line-height 1.25): step titles on the sage sheet, event-family names, printable document titles (1.75rem), wordmarks (1.125–1.5rem).
- **Title (Operate)** (Figtree 600, 1.5rem → 28px, tracking −0.025em): `PageHeader` h1 in every private space. Young Serif is not used for headings in Operate mode; the wordmark and login card are the only serif there.
- **Subtitle** (Figtree 600, 1.125rem): label-card titles, FAQ questions, admin section titles, empty-state titles.
- **Lead** (400, 17px → 1.125rem, line-height 1.625, max 42rem): the paragraph under a headline; `ink-body`, or `sage-pale` on a sage sheet.
- **Body** (400, 15px, line-height 1.625): the working size everywhere: paragraphs, inputs, buttons, table cells, nav links. `text-sm` (14px) appears in dense Operate helpers.
- **Prose** (400, 1.0625rem, line-height 1.7, max 68ch, `ink-body`): long editorial content (`.prose-lpi`): h2 in Young Serif at 1.75rem, h3 in Figtree 600 at 1.25rem, links in `sage-band` underlined.
- **Label** (600, 13px, tracking 0.01em, sentence case): label-card reference lines (clay), table headers (`ink-muted`), status badges, footer column heads (`sage-hairline` on sage), breadcrumbs (400). Never uppercase.

### Named Rules
**The One Weight Serif Rule.** Young Serif is used at 400 only, never bold, never italic, never below 1.125rem.
**The Sentence Case Rule.** No uppercase, no letter-spaced kickers. A label is a short sentence-case phrase in Figtree 600 at 13px.
**The Operate Sans Rule.** Inside a private shell every heading is Figtree 600; the serif is reserved for the wordmark.

## Layout

One container (`.container-page`): max-width 76rem (1216px), centred, with inline padding 1.25rem on mobile, 2rem from 40rem (sm) and 3rem from 64rem (lg). Tailwind's default breakpoints apply (sm 40rem, md 48rem, lg 64rem, xl 80rem) plus a custom `xs` at 26rem that is declared but unused.

Public sections (`Section`) stack at a 64 → 80 → 96 px vertical rhythm (py-16 / sm:py-20 / lg:py-24) and alternate three tones: bare ivory sheet, `paper` (ivory card with 1 px `ivory-edge` rules above and below) and `sage` (full-bleed `sage-band` reverse). The hero is a two-column plate at `lg`: 11fr text / 9fr illustration with a 3.5rem gap; the label card is absolutely pinned bottom-right of the plate from `sm`, stacked beneath it on mobile. Lists are lists: event families are a `<dl>` in three columns over a hairline; steps are one full-width row each, divided by sage-500 at 60 %, with a 180 → 220 px label column; the FAQ is a divided `<dl>` in a 1fr / 2fr split with the title on the left.

The sticky public header is 64px high (wordmark, five links from `lg`, clay CTA from `sm`, a 44px bordered menu button below `lg`). The Operate shell is a 56px header plus a 14rem side nav from `lg` (horizontal, scrollable chip row below), a 1.5 → 2.5rem gap and 1.5 → 2rem vertical padding; `PageHeader` closes with a sage-200 hairline and 1.5rem bottom padding. Printable documents are a 48rem white sheet with 1.5 → 3rem inline padding and lose shadow and padding under `@media print`.

Spacing inside components follows a 4px grid: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48; cards pad 16 (sm), 20 → 24 (md), 24 → 32 (lg).

## Elevation & Depth

Depth is tonal and almost entirely flat: ivory card on ivory sheet, framed by a 1 px sage hairline, is the base layer, and most surfaces stop there. Two soft, green-tinted shadows exist. `shadow-card` sits under every label card, the printable sheets and the skip link; `shadow-float` is declared but no component uses it. The hero illustration carries a one-off CSS drop-shadow filter (`0 18px 40px -24px rgba(31,47,39,0.45)`). The sticky header is 95 % ivory with no blur: opacity for scroll continuity, nothing glass-like.

### Shadow Vocabulary
- **Card** (`box-shadow: 0 1px 2px rgba(31, 47, 39, 0.05), 0 10px 28px -16px rgba(31, 47, 39, 0.28)`): the specimen label lifting off the sheet. Use on label cards and printable sheets.
- **Float** (`box-shadow: 0 2px 6px rgba(31, 47, 39, 0.06), 0 18px 40px -20px rgba(31, 47, 39, 0.35)`): declared for a lifted layer (menus, popovers); unused in the shipped build.
- **Stamp inset** (`inset 0 -1px 0 rgba(0,0,0,0.12)`): the primary button's bottom edge, the only shadow on an interactive control.

### Named Rules
**The Paper-on-Paper Rule.** Elevation is a lighter ivory and a hairline first; a shadow is added only when a surface must be read as a separate sheet (label card, printable document, hero plate).
**The No Glass Rule.** No translucent panels over content, no blur as a material. The header's 95 % ivory is opacity for scroll continuity, not a glass effect.

## Shapes

Corners are tight and papery: 4px (`sm`) on every control, button, badge ring, nav item and input; 6px (`md`) on label cards, alerts, tables, disclosures and empty states; 10px (`lg`) only on the large closing plate; 16px (`xl`) is declared but unused. Dots, radios and status badges are full pills. Checkboxes are 3px.

Borders are 1 px hairlines in `sage-hairline` (frames, dividers, table rules), `sage-soft` (inputs at rest, the mobile menu button), `ivory-edge` (the plate), or dashed `sage-soft` (empty states). The plate illustration repeats the form: a 6px-radius ivory rect with an inner 2px-radius sage frame, five pressed branches each held by a rotated 26–30 × 8 px clay strip, and a paper label with one clay line and two sage lines. The focus ring is a 2px solid clay outline offset 3px with a 2px radius, applied globally to `:focus-visible`.

## Components

### Buttons
Stamps: solid, flat, tight-cornered, sans-serif 600, leading-none, no uppercase.
- **Shape:** 4px radius; heights 36 / 44 / 48 px with 12 / 20 / 24 px inline padding; type 14 / 15 / 16 px.
- **Primary (clay stamp):** `clay-stamp` fill, `ivory-card` text, a 1 px inset bottom shade; hover `clay-label`, active `clay-pressed`. The only filled clay element on a screen; used for « Parler de mon événement » and the submit of every form.
- **Sage:** `sage-band` fill, `ivory-card` text; hover `sage-footer`, active `sage-night`. Confirming actions in Operate mode (« Proposer la mission », « Affecter »).
- **Secondary:** transparent, 1 px `sage-mid` border, `sage-footer` text; hover border `sage-band` + `sage-wash` fill; active `sage-pale`.
- **Ghost:** transparent, `sage-footer` text; hover `sage-wash`, active `sage-pale`.
- **Danger:** transparent, 1 px `danger` border and text; hover `danger-wash`.
- **Hover / Focus:** 200 ms ease-out transition on background, colour, border and shadow; focus is the global clay outline. Disabled: 50 % opacity, not-allowed cursor.

### Status badges (chips)
- **Style:** ivory pill, 1 px tinted ring, 13px / 600 text, an 8px dot before the label. Six tones (neutral, sage, clay, warning, danger, info) map dot, text and ring; the label is always the state name in French.
- **State:** read-only. Admin and portal tone maps live in `components/admin/badges.tsx` and `components/portal/tones.ts`.

### Label card (signature container)
- **Corner Style:** 6px.
- **Background:** `ivory-card` with a 1 px `sage-hairline` frame and the Card shadow.
- **Content order:** optional reference line in `clay-label` 13px / 600 tabular, optional title in Figtree 600 1.125rem, body. Padding 16 / 20→24 / 24→32 px.
- **Plate:** the larger sibling (`.plate`): `ivory-card`, 1 px `ivory-edge` border, 10px radius, no shadow; used for the closing invitation with a sprig tucked in the corner.

### Inputs / Fields
- **Style:** 1 px `sage-soft` stroke on `ivory-card`, 4px radius, 44px tall, 14px inline padding, 15px text; textarea min 7rem; select carries an inline sage chevron SVG. Placeholder `ink-muted` at full opacity. Label above in 15px / 600 with a clay asterisk when required and « (facultatif) » in `ink-muted` otherwise; help text 14px `ink-muted`; errors 14px / 500 `danger` with `role="alert"`.
- **Focus:** border `sage-band` and a 2 px `sage-pale` ring, 150 ms; hover border `sage-mid`.
- **Error / Disabled:** invalid border `danger`; disabled `ivory-recessed` fill with `ink-muted` text; read-only `ivory-sheet`.
- **Checkbox / Radio:** 16px, `sage-mid` border, checked `sage-band` fill (checkbox with an ivory tick SVG; radio as a 5 px ring). `RadioOption` wraps label and description in a 4px-radius hairline card that turns `sage-band` border + `sage-wash` fill when checked.

### Alerts
- 6px radius, 1 px border at 30 % of the tone colour, wash fill, tone text at 15px; title 600, body at 90 % opacity. Kinds: info, success (sage), warning, danger, demo (clay). Alerts replace toasts; flash messages are alerts.

### Tables and data lists
- Wrapped in a 6px hairline frame on `ivory-card`; header row `ivory-sheet` with 13px / 600 `ink-muted` labels; rows divided by `sage-pale`; cells 15px, 16 px inline / 12 px block padding; numerals tabular.

### Navigation
- **Public:** sticky 64px bar, `ivory-sheet` at 95 %, `sage-hairline` bottom rule. Wordmark in Young Serif `sage-footer`; links 15px / 500 `ink-body`, hover and active `sage-night`, each a specimen link (2 px clay stroke draws left-to-right on hover and focus, 220 ms). CTA is a small primary button. Mobile: a 44px bordered toggle opens an `ivory-card` panel with 17px / 500 links divided by `sage-pale` and a full-width CTA.
- **Operate:** 56px header (wordmark 1.125rem serif, space label, user name, outline sign-out), then a side list of 4px-radius items 15px / 500: `ink-body` at rest, `sage-wash` on hover, `sage-band` fill + `ivory-card` text when current (`aria-current="page"`). Below `lg` the same list runs horizontally and scrolls.
- **Breadcrumbs:** 13px `ink-muted`, « / » separators, current page in `ink-body`.
- **Footer:** `sage-footer` sheet, `ivory-sheet` text, column heads in 13px / 600 `sage-hairline`, a gypsophila sprig in `sage-soft`, a `sage-band` rule above the 13px legal line.

### Specimen illustrations (signature)
`Branch`, `Sprig`, `HerbariumPlate`, `PinStrip`, `PortraitPlaceholder`, `VenueIllustration`: deterministic SVG drawn in code, flat two-tone sage over ivory, stems 1.6 px, leaf midribs in ivory at 70–80 % opacity, olive drupes in `clay-stroke`, each specimen pinned with a tilted clay strip. Sprigs mark event families (28px inline, 52px in the catalogue, 96px beside page titles, 120px on the closing plate). The hero plate's five branch groups carry `.settle` with 0 / 80 / 160 / 240 ms delays: opacity 0 → 1 and 6 px upward drift over 700 ms on `cubic-bezier(0.16, 1, 0.3, 1)`, once, `both` fill; under `prefers-reduced-motion` every animation and transition collapses to 0.01 ms globally. The portrait slot is a labelled placeholder plate, never a photograph of a person.

### Stage tracker (client space)
Four 4px-radius hairline cells in a 2 → 4 column grid; each has a 12px dot (filled `sage-band` when done, `clay-stamp` when current, hollow `sage-mid` otherwise), the numbered step name 15px / 500 and the state written out at 13px (« Terminé », « En cours », « À venir », « Non atteint »); the current cell gets a `sage-band` border and `sage-wash` fill.

## Do's and Don'ts

### Do:
- **Do** put content on the ivory sheet and lift it with an `ivory-card` + 1 px `sage-hairline` label card before reaching for a shadow.
- **Do** carry a whole public section in `sage-band` reverse when it needs weight (« Le déroulement », footer), with titles in `ivory-card`, body in `sage-pale` and labels in `clay-pale`.
- **Do** use exactly one clay-filled primary button per view; secondary actions are specimen links (`sage-footer`, 15px / 600, clay stroke on hover) or outline buttons.
- **Do** write every status as dot + French label + 600 weight inside an ivory pill, and every tracker state as a word.
- **Do** set public titles in Young Serif 400 at the Display / Headline / Title steps and everything else, including every Operate heading, in Figtree.
- **Do** keep lists as lists: divided `<dl>` / `<ol>` rows over hairlines, one step per full-width row, three-column `<dl>` for families.
- **Do** honour `prefers-reduced-motion`: the global 0.01 ms collapse already covers `.settle` and every transition; new motion must be a CSS animation or transition so it inherits it.
- **Do** draw illustrations as deterministic inline SVG in the four sage steps plus ivory, pinned with a `clay-pin` strip; document provenance.

### Don't:
- **Don't** add kickers, eyebrows, section numbers or uppercase letter-spaced labels; labels are sentence-case 13px / 600.
- **Don't** use gradients, glass panels, backdrop blur as a material, or coloured drop shadows; the only shadows are Card, the hero plate's filter and the stamp's 1 px inset.
- **Don't** fill cards, badges or tables with sage or clay; fills are `ivory-card`, and sage fills belong to section bands, the active Operate nav item, the sage button and checked controls only.
- **Don't** convey state with colour alone, and don't assign a tone without a text label.
- **Don't** use icon-card trios, stock photography, emoji as identity, or a photographed person in Marie's portrait slot.
- **Don't** set Young Serif bold, italic, under 1.125rem, or inside Operate headings, tables and forms.
- **Don't** add radii above 10px on surfaces or below 4px on controls; pills are for dots and badges only.
- **Don't** add a second authored motion; the hero settle is the one signature moment and nothing else drifts or fades on load.
