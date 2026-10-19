import { Client } from "pg";

/**
 * Direct database access for end-to-end scenarios: stands in for back-office
 * actions owned by other modules (moderator approval) and cleans up test data.
 * Uses the same local database as the dev server.
 */
const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://sna:sna@localhost:5450/sna";

export async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function findListingByOwnerEmail(email: string): Promise<{ id: string; slug: string; status: string } | null> {
  return withDb(async (c) => {
    const r = await c.query<{ id: string; slug: string; status: string }>(
      `select p.id, p.slug, p.status from professionals p join users u on u.id = p.owner_user_id where u.email = $1 and p.deleted_at is null order by p.created_at desc limit 1`,
      [email],
    );
    return r.rows[0] ?? null;
  });
}

/** Moderator approval, as the admin UI would do it. */
export async function publishListing(id: string): Promise<void> {
  await withDb(async (c) => {
    await c.query(`update professionals set status = 'published', published_at = coalesce(published_at, now()), status_reason = null where id = $1`, [id]);
    await c.query(`update moderation_cases set status = 'resolved', resolved_at = now() where professional_id = $1 and status = 'open'`, [id]);
  });
}

export async function countInquiries(professionalId: string): Promise<number> {
  return withDb(async (c) => {
    const r = await c.query<{ n: string }>(`select count(*) as n from inquiries where professional_id = $1`, [professionalId]);
    return Number(r.rows[0]?.n ?? 0);
  });
}

/** Removes everything created by a test account (listings, organisation, user). */
export async function deleteTestAccount(email: string): Promise<void> {
  await withDb(async (c) => {
    const u = await c.query<{ id: string }>(`select id from users where email = $1`, [email]);
    const userId = u.rows[0]?.id;
    if (!userId) return;
    await c.query(`delete from inquiries where professional_id in (select id from professionals where owner_user_id = $1)`, [userId]);
    await c.query(`delete from moderation_cases where professional_id in (select id from professionals where owner_user_id = $1)`, [userId]);
    await c.query(`delete from professionals where owner_user_id = $1`, [userId]);
    await c.query(`delete from organizations where owner_user_id = $1`, [userId]);
    await c.query(`delete from users where id = $1`, [userId]);
  });
}

/** Clears the per-IP inquiry rate limit so repeated local runs never hit the 5/hour cap. */
export async function resetInquiryRateLimits(): Promise<void> {
  const { default: Redis } = await import("ioredis");
  const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6390", { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await redis.connect();
    const keys = await redis.keys("rl:inquiries:*");
    if (keys.length) await redis.del(...keys);
  } finally {
    redis.disconnect();
  }
}
