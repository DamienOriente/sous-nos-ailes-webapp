# Facturation (module `billing`)

Stripe Billing en **mode test uniquement**. Sans clé, le provider `mock` prend le relais : un simulateur en ligne, étiqueté « Paiement simulé — environnement de démonstration », qui produit exactement les évènements que Stripe enverrait et les fait passer par le même processeur idempotent. Aucun paiement réel n'est possible tant que la checklist de mise en production (fin de ce document) n'est pas complète.

## Plans et fonctionnalités

| Clé | Audience | Prix (hypothèse) | Défaut |
|---|---|---|---|
| `organizer_free` | organisateur | 0 € | oui |
| `organizer_plus` | organisateur | 9,90 € TTC / mois | |
| `professional_free` | professionnel | 0 € | oui |
| `professional_premium` | professionnel | 19,90 € TTC / mois | |

Les plans et la matrice des fonctionnalités (`plan_features`, avec limites numériques) sont éditables dans `/admin/offres`. Les clés de fonctionnalités sont dans `src/modules/billing/domain/plans.ts` (`FEATURES`). **Modifier un plan ne modifie jamais un abonnement existant** : la ligne `subscriptions` garde son `planId`, le prix Stripe précédent continue de facturer, un changement de prix remet `stripePriceId` à `null` pour créer un nouveau Price au prochain checkout. L'admin est averti du nombre d'abonnés actifs et la modification est journalisée (`billing.plan.updated`).

### Entitlements (source de vérité)

`src/modules/billing/application/entitlements.ts` :

- `getEffectivePlan(userId, audience, professionalId?)` : abonnement qui **accorde l'accès** (règle `grantsAccess` du domaine) sinon plan par défaut de l'audience.
- `hasFeature`, `requireFeature(actor, audience, feature)` → `PaymentRequiredError` (402) → `<Paywall />`.
- `planFeatureLimit`, `getFeatureLimit`, `getLimitUsage(plan, feature, used)` pour les quotas (`events.create`, `contacts`, `invitations.basic`).

Règle d'accès (`domain/subscription-status.ts`) :

| Statut | Accès |
|---|---|
| `active`, `trialing` | oui (y compris `cancel_at_period_end = true` : Stripe garde `active` jusqu'au terme puis envoie `customer.subscription.deleted`) |
| `past_due` | oui **jusqu'à `current_period_end`** (période déjà payée), puis non |
| `canceled`, `unpaid`, `incomplete`, `incomplete_expired`, `paused` | non |

Le retour navigateur après checkout n'est **jamais** une preuve : `/app/compte/abonnement/retour` interroge l'entitlement réel (server action `checkSubscriptionStateAction`) jusqu'à activation ou expiration du délai.

## Flux

### Souscription

1. `startCheckout(actor, { planKey, audience, professionalId?, promoCode? })`
   - `audience = professional` exige `professionalId` et le rôle propriétaire/admin d'organisation (`requireProfessionalManage`).
   - Stripe configuré : `billing_customers` (Stripe Customer créé au besoin), `ensureStripePrice(plan)` (Product + Price créés à la volée en test et persistés), `checkout.sessions.create` mode `subscription`, `success_url=/app/compte/abonnement/retour?session_id={CHECKOUT_SESSION_ID}`, `cancel_url`, `metadata` + `subscription_data.metadata = { userId, planKey, professionalId }`, `allow_promotion_codes` (ou `discounts[coupon]` si le code promo local a un `stripeCouponId`).
   - Sinon : redirection vers `/app/compte/abonnement/mock-checkout?plan=…` → `completeMockCheckout` émet `checkout.session.completed` + `customer.subscription.created` (provider `mock`).
2. Webhooks `POST /api/billing/webhooks/stripe` : corps brut + `stripe.webhooks.constructEvent(STRIPE_WEBHOOK_SECRET)`. Signature invalide → 400 + `security_events.webhook_signature_invalid`. Évènement valide → `ingestBillingEvent`.
3. `ingestBillingEvent` (`application/webhook-processor.ts`) : insertion `billing_events` (unique `(provider, external_event_id)`) ; doublon déjà traité → `duplicate` (200, aucun effet) ; traitement en transaction ; `processed_at` / `error` (un échec renvoie 500 pour que Stripe rejoue et la ligne est retraitée).

Types traités : `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed` (→ `past_due`, notification `payment_alert` + e-mail forcé), `customer.subscription.trial_will_end`. Les autres types sont enregistrés et ignorés. La période est lue sur `items.data[0].current_period_*` (API Stripe ≥ 2025-03) avec repli sur la racine (anciens payloads, mock).

### Gestion

- `cancelAtPeriodEnd` → `subscriptions.update(cancel_at_period_end: true)` (Stripe) ou évènement mock ; droits maintenus jusqu'à `currentPeriodEnd` ; `resumeSubscription` annule la résiliation.
- `openCustomerPortal` → Stripe Billing Portal (`return_url`) ; mock : `/app/compte/abonnement/gestion`.
- `listInvoices` → `invoices.list` ; mock : liste vide + mention.
- `simulateMockPeriodEnd` (mock uniquement) : émet `customer.subscription.deleted`.

### Codes promo (`application/promo-codes.ts`)

Validation locale (actif, fenêtre de validité, plafond), calcul `applyPromo` (pourcentage prioritaire, jamais négatif). En mode Stripe, le code est appliqué via `stripeCouponId` si renseigné, sinon `allow_promotion_codes` laisse Stripe gérer la saisie. Démo : `BIENVENUE20` (-20 % pendant 3 mois).

### Emplacements sponsorisés (`application/featured-placements.ts`)

Éligibilité = fiche `published` **et** abonnement accordant `sponsored.eligible`, vérifiée à la création **et** à chaque requête. Contrat pour l'annuaire : `listActiveSponsoredProfessionalIds({ categorySlug, department })` renvoie au plus `sponsored.max_per_query` identifiants (rotation : expiration la plus proche d'abord). L'annuaire étiquette chaque résultat « Sponsorisé ». Information publique : `/classements-sponsorises`.

### E-mails marketing

Aucun e-mail marketing automatique en V1 (`application/marketing-emails.ts`, `MARKETING_EMAILS_ENABLED = false`). Règle encodée pour l'avenir : opt-in explicite, désinscription en un clic, **jamais de relance commerciale après un évènement terminé**, revue juridique.

## Activer Stripe en test (local)

```bash
# .env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...   # fourni par `stripe listen`

stripe login
stripe listen --forward-to localhost:3200/api/billing/webhooks/stripe
```

Puis souscrire depuis `/app/compte/abonnement` (carte test `4242 4242 4242 4242`). Les Product/Price sont créés automatiquement au premier checkout et leurs ids persistés dans `plans`. Pour rejouer un évènement : `stripe events resend evt_…`. Le journal est visible dans `/admin/offres/evenements`.

Variables : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` (non utilisée côté client en V1 : Checkout hébergé), paramètre `billing.live_enabled` (admin).

## Ce qui bloque le passage en réel

Tant que l'un de ces points manque, le bandeau « Paiement réel non activé sur cet environnement » reste affiché (`!stripeConfigured || billing.live_enabled = false`) :

1. Clés **live** Stripe (`sk_live_`, `whsec_` de l'endpoint de production) ; l'endpoint webhook déclaré dans le dashboard Stripe avec les 7 types ci-dessus.
2. `billing.live_enabled = true` dans `/admin/parametres` (décision explicite de l'éditeur).
3. CGV validées par un professionnel du droit : reconduction mensuelle, résiliation en ligne, droit de rétractation 14 jours (consommateurs) et son articulation avec l'accès immédiat au service, conséquences de la résiliation, tarifs TTC.
4. Médiateur de la consommation désigné (`legal.mediator`), mentions légales complètes (`legal.*`), politique de confidentialité à jour.
5. Décision sur la TVA/facturation (Stripe Tax ou mention explicite), e-mail de facturation, numérotation des factures (Stripe).
6. Test de bout en bout en mode test : scénario C (`tests/integration/billing.test.ts`) **et** un parcours réel avec `stripe listen`.

## Tests

- Unitaires : `tests/unit/billing/*.test.ts` (mapping statuts, règles d'accès, promo, lecture des payloads, politique marketing, règles de modération).
- Intégration : `tests/integration/billing.test.ts` — scénario C en mode mock, puis avec le SDK Stripe mocké (`vi.mock` du client) et des webhooks **signés** (`stripe.webhooks.generateTestHeaderString`) envoyés au vrai route handler ; rejeu ignoré ; signature invalide → 400 + `security_events`.
- E2E : `e2e/premium.spec.ts` (paywall → souscription mock → retour → annulation à échéance → « Actif jusqu'au » → fin de période simulée).

Ce qui nécessite de vraies clés de test (non couvert automatiquement) : création réelle de Product/Price/Customer/Checkout Session, portail client, factures, délais de livraison des webhooks Stripe.
