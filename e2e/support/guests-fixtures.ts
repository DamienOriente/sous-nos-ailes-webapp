import { Pool } from "pg";
import type { Page } from "@playwright/test";

/**
 * Test fixtures for the guests/invitations/seating specs. They talk to the
 * local database directly (same as the integration tests) so the specs do not
 * depend on the demo seed of other modules: an organiser event owned by
 * louis@ with an active "Organisateur Plus" subscription (premium features).
 */
export const DEMO_PASSWORD = "Demo-SousNosAiles-2026!";
export const FIXTURE_EVENT_NAME = "E2E Mariage (invités)";

let current: Pool | null = null;
/** Lazily (re)created: several spec files share one worker and each closes the pool in afterAll. */
const pool = {
  query: <T extends Record<string, unknown>>(text: string, values?: unknown[]) => {
    current ??= new Pool({ connectionString: process.env.DATABASE_URL ?? "postgresql://sna:sna@localhost:5450/sna", max: 2 });
    return current.query<T>(text, values);
  },
};

export async function closeFixtures(): Promise<void> {
  const p = current;
  current = null;
  await p?.end().catch(() => undefined);
}

export async function userIdByEmail(email: string): Promise<string> {
  const r = await pool.query<{ id: string }>(`select id from users where email = $1`, [email]);
  const id = r.rows[0]?.id;
  if (!id) throw new Error(`demo user ${email} missing — run pnpm db:seed`);
  return id;
}

export async function ensurePremium(userId: string): Promise<void> {
  const plan = await pool.query<{ id: string }>(`select id from plans where key = 'organizer_plus' limit 1`);
  const planId = plan.rows[0]?.id;
  if (!planId) throw new Error("plan organizer_plus missing");
  const existing = await pool.query(`select 1 from subscriptions where user_id = $1 and plan_id = $2 and status = 'active'`, [userId, planId]);
  if (existing.rowCount) return;
  await pool.query(`insert into subscriptions (user_id, plan_id, status, provider, current_period_start, current_period_end) values ($1, $2, 'active', 'mock', now(), now() + interval '1 year')`, [userId, planId]);
}

export async function ensureFixtureEvent(): Promise<{ eventId: string; ownerId: string }> {
  const ownerId = await userIdByEmail("louis@sousnosailes.test");
  await ensurePremium(ownerId);
  let r = await pool.query<{ id: string }>(`select id from events where owner_user_id = $1 and name = $2 and deleted_at is null limit 1`, [ownerId, FIXTURE_EVENT_NAME]);
  let eventId = r.rows[0]?.id;
  if (!eventId) {
    r = await pool.query<{ id: string }>(
      `insert into events (owner_user_id, name, type, status, event_date, venue_name, city, is_demo) values ($1, $2, 'wedding', 'planning', '2027-06-12', 'Domaine des Tilleuls', 'Lavaur', true) returning id`,
      [ownerId, FIXTURE_EVENT_NAME],
    );
    eventId = r.rows[0]!.id;
  }
  await pool.query(`insert into event_members (event_id, user_id, role, status, joined_at) values ($1, $2, 'owner', 'active', now()) on conflict (event_id, user_id) do update set status = 'active'`, [eventId, ownerId]);
  return { eventId, ownerId };
}

export async function createGuest(eventId: string, firstName: string, lastName: string, extra: { plusOnes?: number } = {}): Promise<string> {
  const r = await pool.query<{ id: string }>(`insert into event_guests (event_id, first_name, last_name, plus_ones_allowed) values ($1, $2, $3, $4) returning id`, [eventId, firstName, lastName, extra.plusOnes ?? 0]);
  return r.rows[0]!.id;
}

export async function deleteGuestsByLastName(eventId: string, lastName: string): Promise<void> {
  await pool.query(`delete from event_guests where event_id = $1 and last_name = $2`, [eventId, lastName]);
}

export async function deleteInvitationsByRecipient(eventId: string, recipientPrefix: string): Promise<void> {
  await pool.query(`delete from invitations where event_id = $1 and recipient_name like $2`, [eventId, `${recipientPrefix}%`]);
}

export async function deleteTablesByName(eventId: string, namePrefix: string): Promise<void> {
  await pool.query(`delete from seating_tables where event_id = $1 and name like $2`, [eventId, `${namePrefix}%`]);
}

/** Signs in through the better-auth API; the cookies land in the page context. */
export async function login(page: Page, email: string, password = DEMO_PASSWORD): Promise<void> {
  const res = await page.request.post("/api/auth/sign-in/email", { data: { email, password }, headers: { origin: process.env.E2E_BASE_URL ?? "http://localhost:3200" } });
  if (!res.ok()) throw new Error(`login failed for ${email}: ${res.status()} ${await res.text()}`);
}
