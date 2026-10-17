// Runs against the local PostgreSQL (DATABASE_URL from .env). Creates its own
// fixtures with unique identifiers and removes them afterwards.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, disconnectDb } from "@/lib/db";
import { assignProvider, findAssignmentConflicts } from "@/server/services/assignments";
import { ConflictError, DomainError } from "@/server/errors";
import { computeEventInstants } from "@/lib/time";
import type { SessionUser } from "@/lib/auth/session";

const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const email = (name: string) => `${name}-${stamp}@example.test`;

let adminId = "";
let clientId = "";
let providerA = "";
let providerB = "";
const eventIds: string[] = [];
const userIds: string[] = [];

const actor = (): SessionUser => ({ id: adminId, email: email("admin"), name: "Admin test", role: "ADMIN", isDemo: true });

async function createEvent(reference: string, date: string, startTime: string, endTime: string, requiredProviders = 1) {
  const instants = computeEventInstants({ date, startTime, endTime });
  const request = await db.eventRequest.create({
    data: { eventType: "WEDDING", city: "Testville", postalCode: "69000", organizerName: "Test", organizerEmail: email("client"), privacyAcceptedAt: new Date(), submissionKey: `test-${reference}` },
  });
  const event = await db.event.create({
    data: { reference, requestId: request.id, clientId, status: "PREPARING", title: `Test ${reference}`, eventType: "WEDDING", date: new Date(`${date}T00:00:00Z`), startTime, endTime, startsAt: instants.startsAt, endsAt: instants.endsAt, city: "Testville", postalCode: "69000", requiredProviders },
  });
  eventIds.push(event.id);
  return event;
}

beforeAll(async () => {
  const admin = await db.user.create({ data: { email: email("admin"), name: "Admin test", role: "ADMIN" } });
  const client = await db.user.create({ data: { email: email("client"), name: "Client test", role: "CLIENT" } });
  const pa = await db.user.create({ data: { email: email("pa"), name: "Provider A", role: "PROVIDER", providerProfile: { create: { displayName: "A", city: "Testville", sector: "Testville", vettingStatus: "ACTIVE", agreedCostCents: 10_000 } } }, include: { providerProfile: true } });
  const pb = await db.user.create({ data: { email: email("pb"), name: "Provider B", role: "PROVIDER", providerProfile: { create: { displayName: "B", city: "Testville", sector: "Testville", vettingStatus: "ACTIVE", agreedCostCents: 10_000 } } }, include: { providerProfile: true } });
  adminId = admin.id;
  clientId = client.id;
  providerA = pa.providerProfile!.id;
  providerB = pb.providerProfile!.id;
  userIds.push(admin.id, client.id, pa.id, pb.id);
});

afterAll(async () => {
  await db.assignment.deleteMany({ where: { eventId: { in: eventIds } } });
  await db.event.deleteMany({ where: { id: { in: eventIds } } });
  await db.eventRequest.deleteMany({ where: { submissionKey: { startsWith: `test-T-${stamp}` } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await disconnectDb();
});

describe("assignments (database)", () => {
  it("blocks an assignment that overlaps an existing one, including across midnight", async () => {
    const e1 = await createEvent(`T-${stamp}-1`, "2027-09-11", "18:00", "01:30");
    const e2 = await createEvent(`T-${stamp}-2`, "2027-09-12", "00:30", "04:00");
    await assignProvider({ eventId: e1.id, providerId: providerA }, actor());
    await expect(assignProvider({ eventId: e2.id, providerId: providerA }, actor())).rejects.toBeInstanceOf(ConflictError);
    // A different provider is fine.
    await expect(assignProvider({ eventId: e2.id, providerId: providerB }, actor())).resolves.toBeTruthy();
  });

  it("applies the travel buffer between two events", async () => {
    const settings = await db.businessSettings.findUniqueOrThrow({ where: { id: "default" } });
    const e3 = await createEvent(`T-${stamp}-3`, "2027-09-18", "14:00", "18:00");
    // Ends at 18:00; the next one starts 20 minutes later, inside the buffer.
    const e4 = await createEvent(`T-${stamp}-4`, "2027-09-18", "18:20", "22:00");
    await assignProvider({ eventId: e3.id, providerId: providerB }, actor());
    const conflicts = await findAssignmentConflicts({ providerId: providerB, interval: { startsAt: e4.startsAt!, endsAt: e4.endsAt! }, bufferMinutes: settings.travelBufferMinutes, excludeEventId: e4.id });
    expect(settings.travelBufferMinutes).toBeGreaterThan(20);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].explanation).toMatch(/marge de déplacement/);
  });

  it("serialises two concurrent incompatible assignments: exactly one succeeds", async () => {
    const e5 = await createEvent(`T-${stamp}-5`, "2027-10-02", "17:00", "23:00");
    const e6 = await createEvent(`T-${stamp}-6`, "2027-10-02", "19:00", "22:00");
    const results = await Promise.allSettled([
      assignProvider({ eventId: e5.id, providerId: providerA }, actor()),
      assignProvider({ eventId: e6.id, providerId: providerA }, actor()),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);
    const count = await db.assignment.count({ where: { providerId: providerA, eventId: { in: [e5.id, e6.id] } } });
    expect(count).toBe(1);
  });

  it("refuses to overstaff a complete team and to assign twice", async () => {
    const e7 = await createEvent(`T-${stamp}-7`, "2027-11-06", "10:00", "14:00", 1);
    await assignProvider({ eventId: e7.id, providerId: providerB }, actor());
    await expect(assignProvider({ eventId: e7.id, providerId: providerB }, actor())).rejects.toBeInstanceOf(DomainError);
    await expect(assignProvider({ eventId: e7.id, providerId: providerA }, actor())).rejects.toThrow(/déjà complète/);
  });
});
