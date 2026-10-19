import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import "./setup";
import { db } from "@/db/client";
import { emailOutbox } from "@/db/schema";
import { drainEmailOutbox, enqueueEmail, outboxStats } from "@/modules/notifications/application/email-outbox";
import { buildMarketingUnsubscribeUrl, verifyMarketingUnsubscribeToken } from "@/modules/notifications/application/unsubscribe";

/** Requires Mailpit (docker compose) on SMTP 1027 / API 8027. */
const MAILPIT = "http://localhost:8027";
const run = randomUUID().slice(0, 8);
const toTransactional = `itest-outbox-${run}@sousnosailes.test`;
const toMarketing = `itest-marketing-${run}@sousnosailes.test`;

type MailpitSearch = { messages: Array<{ ID: string; Subject: string; To: Array<{ Address: string }> }> };

async function search(to: string): Promise<MailpitSearch["messages"]> {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
  expect(res.ok).toBe(true);
  return ((await res.json()) as MailpitSearch).messages;
}

async function headers(id: string): Promise<Record<string, string[]>> {
  const res = await fetch(`${MAILPIT}/api/v1/message/${id}/headers`);
  expect(res.ok).toBe(true);
  return (await res.json()) as Record<string, string[]>;
}

afterAll(async () => {
  await db.delete(emailOutbox).where(inArray(emailOutbox.toEmail, [toTransactional, toMarketing]));
});

describe("e-mail outbox drain (Mailpit)", () => {
  it("sends a pending transactional e-mail without any unsubscribe header", async () => {
    await enqueueEmail({ toEmail: toTransactional, subject: `itest notification ${run}`, templateKey: "notification", payload: { name: "Itest", title: "Nouveau message", body: "Vous avez un message.", href: "/app/notifications" } });
    const before = await outboxStats();
    expect(before.pending).toBeGreaterThanOrEqual(1);

    const res = await drainEmailOutbox(50);
    expect(res.sent).toBeGreaterThanOrEqual(1);

    const [row] = await db.select().from(emailOutbox).where(eq(emailOutbox.toEmail, toTransactional));
    expect(row?.status).toBe("sent");
    expect(row?.attempts).toBe(1);
    expect(row?.sentAt).toBeInstanceOf(Date);

    const messages = await search(toTransactional);
    expect(messages.length).toBe(1);
    expect(messages[0]!.Subject).toBe(`itest notification ${run}`);
    const h = await headers(messages[0]!.ID);
    expect(Object.keys(h).map((k) => k.toLowerCase())).not.toContain("list-unsubscribe");
  });

  it("adds the HMAC one-click unsubscribe to marketing e-mails only", async () => {
    const userId = `itest-user-${run}`;
    const url = buildMarketingUnsubscribeUrl(userId);
    const u = new URL(url);
    expect(u.pathname).toBe("/api/notifications/unsubscribe");
    expect(verifyMarketingUnsubscribeToken(userId, u.searchParams.get("t") ?? "")).toBe(true);
    expect(verifyMarketingUnsubscribeToken("someone-else", u.searchParams.get("t") ?? "")).toBe(false);

    await enqueueEmail({ toEmail: toMarketing, subject: `itest marketing ${run}`, templateKey: "marketing", payload: { userId, heading: "Nos nouveautés", body: "Découvrez les nouveaux prestataires." } });
    await drainEmailOutbox(50);
    const messages = await search(toMarketing);
    expect(messages.length).toBe(1);
    const h = await headers(messages[0]!.ID);
    const key = Object.keys(h).find((k) => k.toLowerCase() === "list-unsubscribe");
    expect(key).toBeDefined();
    expect(h[key!]![0]).toContain(url);
  });

  it("drains nothing when the outbox is empty for these recipients", async () => {
    const [row] = await db.select().from(emailOutbox).where(eq(emailOutbox.toEmail, toMarketing));
    expect(row?.status).toBe("sent");
  });
});
