/**
 * Provider-agnostic reading of billing event payloads. Stripe events and mock
 * events share the same envelope ({ id, type, data: { object } }) so the
 * processor has a single code path, which is what the tests exercise.
 */
export const HANDLED_EVENT_TYPES = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.trial_will_end",
  "invoice.paid",
  "invoice.payment_failed",
] as const;
export type HandledEventType = (typeof HANDLED_EVENT_TYPES)[number];

export function isHandledEventType(type: string): type is HandledEventType {
  return (HANDLED_EVENT_TYPES as readonly string[]).includes(type);
}

export type JsonObject = Record<string, unknown>;

export function isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function readString(obj: unknown, key: string): string | null {
  if (!isObject(obj)) return null;
  const v = obj[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

export function readNumber(obj: unknown, key: string): number | null {
  if (!isObject(obj)) return null;
  const v = obj[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function readBoolean(obj: unknown, key: string): boolean {
  if (!isObject(obj)) return false;
  return obj[key] === true;
}

/** Stripe expandable fields are either an id string or an object with an id. */
export function readRef(obj: unknown, key: string): string | null {
  if (!isObject(obj)) return null;
  const v = obj[key];
  if (typeof v === "string") return v;
  return readString(v, "id");
}

export function readMetadata(obj: unknown): Record<string, string> {
  if (!isObject(obj) || !isObject(obj.metadata)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj.metadata)) if (typeof v === "string") out[k] = v;
  return out;
}

/** The event's primary object (`data.object`). */
export function eventObject(payload: JsonObject): JsonObject {
  const data = payload.data;
  if (isObject(data) && isObject(data.object)) return data.object;
  return {};
}

export type SubscriptionSnapshot = {
  id: string | null;
  customerId: string | null;
  status: string | null;
  priceId: string | null;
  /** Billed units of the first item (agency plan); null when the payload does not say. */
  quantity: number | null;
  /** Stripe subscription item id (needed to change the quantity). */
  itemId: string | null;
  currentPeriodStart: number | null;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: number | null;
  endedAt: number | null;
  metadata: Record<string, string>;
};

/**
 * Reads a Stripe Subscription object. Since API 2025-03 the billing period
 * lives on the subscription items; older payloads (and mock payloads) still
 * expose it at the root, so both are accepted.
 */
export function readSubscription(obj: JsonObject): SubscriptionSnapshot {
  const items = isObject(obj.items) && Array.isArray(obj.items.data) ? obj.items.data : [];
  const first = items.find(isObject) ?? null;
  const price = first && isObject(first.price) ? first.price : null;
  return {
    id: readString(obj, "id"),
    customerId: readRef(obj, "customer"),
    status: readString(obj, "status"),
    priceId: price ? readString(price, "id") : readString(obj, "price_id"),
    quantity: readNumber(first, "quantity") ?? readNumber(obj, "quantity"),
    itemId: first ? readString(first, "id") : null,
    currentPeriodStart: readNumber(first, "current_period_start") ?? readNumber(obj, "current_period_start"),
    currentPeriodEnd: readNumber(first, "current_period_end") ?? readNumber(obj, "current_period_end"),
    cancelAtPeriodEnd: readBoolean(obj, "cancel_at_period_end"),
    canceledAt: readNumber(obj, "canceled_at"),
    endedAt: readNumber(obj, "ended_at"),
    metadata: readMetadata(obj),
  };
}

/** Invoice → subscription id (API 2025-03 moved it under `parent.subscription_details`). */
export function readInvoiceSubscriptionId(obj: JsonObject): string | null {
  const direct = readRef(obj, "subscription");
  if (direct) return direct;
  const parent = isObject(obj.parent) ? obj.parent : null;
  const details = parent && isObject(parent.subscription_details) ? parent.subscription_details : null;
  return details ? readRef(details, "subscription") : null;
}
