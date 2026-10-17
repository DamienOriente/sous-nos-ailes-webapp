# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS 4, PostgreSQL with Prisma 7 migrations, Zod, Vitest, Playwright, Docker Compose (app + PostgreSQL + Mailpit) for a local run on Apple Silicon. The engineering brief (section 14) prescribed this stack and left the final choice to the builder; no interview answer was available, so this is recorded as delegated.

## Users

- **Event organisers** (primary, inferred from the brief): engaged couples, parents organising a family celebration, company event planners in France. Their job: have the children present at a wedding, private party or professional event looked after and engaged so adults can enjoy the event with peace of mind. They evaluate on a phone or a laptop, often in the evening, weeks or months before the date, and want to understand quickly what is offered, how it unfolds, and how to ask for a proposal.
- **Marie** (from the brief): early-childhood professional working in a crèche, running this activity as a complementary business. She qualifies requests, prepares versioned proposals, builds the team from her network, validates every service and keeps internal notes and costs private. Laptop and phone.
- **Independent providers / intervenant·es** (from the brief): members of Marie's network who receive mission proposals, accept or decline freely, update availability and consult confirmed missions. Mostly phone.
- **Partner venues** (from the brief): reception venues and comparable partners who refer organisers through a link or QR code and see only their page, their link and aggregated statistics.

## Product Purpose

A website and operations tool for an event childcare service: the public site explains the offer and generates qualified requests; the private spaces let Marie turn a request into a dated proposal, an agreed service and an assigned team, while clients, providers and partners each see exactly what they need. Success: organisers submit complete requests without friction, Marie runs every file from one place, nothing is ever confirmed without her validation.

## Positioning

Marie is the single human interlocutor. This is not an open marketplace: an organiser describes the event once, Marie turns it into a versioned proposal and a verified, assigned team. The mechanism a neighbouring product could not truthfully copy is the combination of an early-childhood professional's attention to children with event-grade organisation, carried by one accountable person.

## Operating Context

- Events: weddings (including evenings past midnight), private celebrations, professional events, in partner venues or free venues across a zone that is not yet defined (editable setting).
- Workflow: new request → to qualify → proposal sent → agreement in principle → preparation → confirmed → completed; plus declined and cancelled. Commercial status is separate from team-building status.
- Economic model (demo, to validate): Marie coordinates the service and tracks provider costs. No commission for partners by default.
- Time zone Europe/Paris for display, UTC storage; date-only and uncertain dates exist.
- Local demo environment: Docker Compose, Mailpit inbox, fictitious demo accounts, noindex.

## Capabilities and Constraints

- Working name « Les Petits Invités — avec Marie », provisional and editable; legal and domain availability unverified.
- Interface in French; code, identifiers and comments in English.
- Never claim: crèche status, licence or approval (agrément), certification, insurance, diplomas, years of experience, client counts, reviews, real partners, tax-credit eligibility, automatic care of children under three, regulatory staffing ratios. Staffing rules are internal parameters awaiting validation.
- No names, birth dates, photos or medical data of children are collected or stored.
- Costs and internal notes are never visible to clients, providers or partners. Provider contact data and client contact data are shared only on operational need after assignment.
- Demo data is fictitious, labelled as such, uses example.test addresses and is excluded from indexing.
- Excluded in V1: online payment, payout splitting, certified e-signature, full invoicing, real-time chat, native app, live geolocation, child medical records, open marketplace, venue scraping, automated prospecting, AI chatbot, Odoo integration.
- Undecided (parameters, not facts): final name, prices, intervention zone, legal status, VAT regime, insurance, contracts, age ranges accepted.

## Brand Commitments

- Promise line: « Une attention pour les enfants, de la sérénité pour votre événement. »
- Voice: serious organisation, attention to children, a human relationship with Marie, elegant integration into a wedding or reception venue. Never a daycare, never a school, never a SaaS.
- Pinned visual direction (from the brief, binding): warm ivory, deep sage green, clay accents; editorial display typography with a highly legible text face; generous space; elegant illustration; soft, discreet graphic details; light motion honouring prefers-reduced-motion. Refused: generic SaaS look, purple gradients, emoji as identity, repetitive cards everywhere, school/daycare look, fake social proof, effects that hurt reading or performance.
- Primary call to action: « Parler de mon événement ».
- No portrait of Marie exists; an editable, clearly placeholder slot is reserved. No photographed person may be presented as Marie.

## Evidence on Hand

None. No real testimonials, logos, partner venues, photographs, figures or legal documents exist. Every demonstrative element is synthetic and labelled. The reviews section stays hidden until real, authorised reviews exist. Visuals are original SVG illustrations authored in the repository, with provenance documented.

## Product Principles

1. Marie decides; the software prepares. Nothing is booked, confirmed or guaranteed automatically.
2. Say only what is true: no invented proof, status or compliance.
3. Children's privacy first: the service is described without ever profiling a child.
4. Each role sees only what it needs; costs and internal notes never leave Marie's space.
5. Calm, legible, premium: the product should feel like a well-run event, not a dashboard.

## Accessibility & Inclusion

Keyboard navigation, visible focus, labelled forms, 4.5:1 text contrast, reduced-motion support, mobile around 390 px and desktop around 1440 px. No claim of full WCAG conformance is made.
