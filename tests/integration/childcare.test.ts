import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { childAccessLogs, childAttendance, childHandoverRecords, childSensitiveInformation, eventChildren, eventMembers, eventPermissions } from "@/db/schema";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import type { Actor } from "@/lib/session";
import { assignChild, listCareTeam } from "@/modules/childcare/application/assignments-service";
import { getPresenceDashboard, performHandover, recordAttendance } from "@/modules/childcare/application/attendance-service";
import { addAuthorizedPerson, createChild, getChildDetail, listAccessLogs, listChildren, readSensitiveInformation, setSensitiveInformation, withdrawSensitiveConsent } from "@/modules/childcare/application/children-service";
import { getDietaryCounts } from "@/modules/childcare/application/dietary";
import { anonymizeChildrenForEndedEvents } from "@/modules/childcare/application/retention";
import { addMember, cleanupUsers, createEvent, createUser } from "./_fixtures";

/**
 * Scenario D (children): a nanny assigned to event A sees her children only,
 * never those of event B nor unassigned ones; sensitive reads are logged;
 * no consent → refusal; organiser without the permission → refusal;
 * revoked member → NotFound.
 */
let louis: Actor; // owner of A
let paul: Actor; // owner of B
let marie: Actor; // nanny, provider garde-enfants in A
let camille: Actor; // wedding planner in A (no sensitive permission by default)
let julien: Actor; // caterer in A
let eventA: string;
let eventB: string;
let marieMember: string;
const childIds: Record<string, string> = {};

const childInput = (firstName: string, dietary?: string) => ({
  firstName,
  lastName: "Test",
  ageYears: 6,
  guardianName: "Parent Test",
  guardianPhone: "0600000000",
  guardianEmail: null,
  careInstructions: null,
  dietaryPreference: dietary ?? null,
  expectedArrivalAt: null,
  expectedDepartureAt: null,
});

beforeAll(async () => {
  [louis, paul, marie, camille, julien] = await Promise.all([createUser("louis"), createUser("paul"), createUser("marie"), createUser("camille"), createUser("julien")]);
  eventA = await createEvent(louis, "A");
  eventB = await createEvent(paul, "B");
  marieMember = await addMember(eventA, marie, "provider", "garde-enfants-evenementielle");
  await addMember(eventA, camille, "wedding_planner", "wedding-planner");
  await addMember(eventA, julien, "provider", "traiteur");
  await addMember(eventB, marie, "provider", "garde-enfants-evenementielle"); // Marie is also in B, but assigned to nobody there
  for (const [name, diet] of [
    ["Lea", "végétarien"],
    ["Noah", null],
    ["Inaya", "sans gluten"],
  ] as const) {
    const { id } = await createChild(louis, eventA, childInput(name, diet ?? undefined));
    childIds[name] = id;
  }
  const { id: bChild } = await createChild(paul, eventB, childInput("Chloe"));
  childIds.Chloe = bChild;
});

afterAll(async () => {
  await cleanupUsers([louis, paul, marie, camille, julien]);
});

describe("childcare isolation", () => {
  it("the owner sees the whole roster; a nanny sees only her assigned children", async () => {
    const all = await listChildren(louis, eventA);
    expect(all.children.map((c) => c.firstName).sort()).toEqual(["Inaya", "Lea", "Noah"]);
    expect(all.scope.assignedChildIds).toBeNull();

    const before = await listChildren(marie, eventA);
    expect(before.children).toEqual([]);

    await assignChild(louis, eventA, childIds.Lea!, marieMember);
    await assignChild(louis, eventA, childIds.Noah!, marieMember);
    const after = await listChildren(marie, eventA);
    expect(after.children.map((c) => c.firstName).sort()).toEqual(["Lea", "Noah"]);

    // Unassigned child of A and children of B are NotFound for her.
    await expect(getChildDetail(marie, eventA, childIds.Inaya!)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getChildDetail(marie, eventB, childIds.Chloe!)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getChildDetail(marie, eventA, childIds.Chloe!)).rejects.toBeInstanceOf(NotFoundError);
    // Caterer has no roster access at all.
    await expect(listChildren(julien, eventA)).rejects.toBeInstanceOf(ForbiddenError);
    // Paul is not a member of A.
    await expect(listChildren(paul, eventA)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("refuses non-childcare members unless explicitly confirmed", async () => {
    const team = await listCareTeam(louis, eventA);
    const julienMember = team.find((m) => m.userId === julien.userId)!;
    expect(julienMember.isChildcare).toBe(false);
    await expect(assignChild(louis, eventA, childIds.Inaya!, julienMember.memberId)).rejects.toBeInstanceOf(ValidationError);
    await expect(assignChild(julien, eventA, childIds.Inaya!, marieMember)).rejects.toBeInstanceOf(ForbiddenError); // a provider cannot assign
  });
});

describe("sensitive information", () => {
  it("without consent nothing can be read; with consent the read is decrypted and logged", async () => {
    await expect(readSensitiveInformation(marie, eventA, childIds.Lea!, "préparation du goûter")).rejects.toBeInstanceOf(ForbiddenError);
    await setSensitiveInformation(louis, eventA, childIds.Lea!, { allergies: "Arachide sévère", healthNotes: null, consentGivenByName: "Parent Test", consentConfirmed: true });
    const roster = await listChildren(marie, eventA);
    const lea = roster.children.find((c) => c.id === childIds.Lea)!;
    expect(lea.hasAllergies).toBe(true);
    expect(JSON.stringify(roster)).not.toContain("Arachide"); // never in lists
    const [stored] = await db.select().from(childSensitiveInformation).where(eq(childSensitiveInformation.childId, childIds.Lea!));
    expect(stored!.allergiesEncrypted).not.toContain("Arachide"); // encrypted at rest

    await expect(readSensitiveInformation(marie, eventA, childIds.Lea!, "")).rejects.toBeInstanceOf(ValidationError);
    const read = await readSensitiveInformation(marie, eventA, childIds.Lea!, "préparation du goûter");
    expect(read.allergies).toBe("Arachide sévère");
    const logs = await db.select().from(childAccessLogs).where(and(eq(childAccessLogs.childId, childIds.Lea!), eq(childAccessLogs.userId, marie.userId), eq(childAccessLogs.action, "view_sensitive")));
    expect(logs).toHaveLength(1);
    expect(logs[0]!.purpose).toBe("préparation du goûter");
  });

  it("an organiser without children.view_sensitive is refused; an explicit grant unlocks it", async () => {
    await expect(readSensitiveInformation(camille, eventA, childIds.Lea!, "coordination")).rejects.toBeInstanceOf(ForbiddenError);
    const [m] = await db.select({ id: eventMembers.id }).from(eventMembers).where(and(eq(eventMembers.eventId, eventA), eq(eventMembers.userId, camille.userId)));
    await db.insert(eventPermissions).values({ eventId: eventA, memberId: m!.id, permission: "children.view_sensitive", effect: "allow", grantedByUserId: louis.userId });
    const read = await readSensitiveInformation(camille, eventA, childIds.Lea!, "coordination");
    expect(read.allergies).toBe("Arachide sévère");
    const owners = await listAccessLogs(louis, eventA);
    expect(owners.some((l) => l.userName === camille.name && l.action === "view_sensitive")).toBe(true);
    await expect(listAccessLogs(marie, eventA)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("a nanny cannot read a child not assigned to her even with the permission", async () => {
    await setSensitiveInformation(louis, eventA, childIds.Inaya!, { allergies: null, healthNotes: "Asthme", consentGivenByName: "Parent Test", consentConfirmed: true });
    await expect(readSensitiveInformation(marie, eventA, childIds.Inaya!, "x")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("withdrawing consent erases the encrypted payloads", async () => {
    await withdrawSensitiveConsent(louis, eventA, childIds.Inaya!);
    const [row] = await db.select().from(childSensitiveInformation).where(eq(childSensitiveInformation.childId, childIds.Inaya!));
    expect(row!.healthNotesEncrypted).toBeNull();
    expect(row!.hasHealthNotes).toBe(false);
    expect(row!.consentWithdrawnAt).not.toBeNull();
    await expect(readSensitiveInformation(louis, eventA, childIds.Inaya!, "x")).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("attendance and handover", () => {
  it("check-in, dashboard, handover requires an authorised person and a check-in", async () => {
    await recordAttendance(marie, eventA, childIds.Lea!, { kind: "check_in", note: null });
    await expect(recordAttendance(marie, eventA, childIds.Lea!, { kind: "check_in", note: null })).rejects.toBeInstanceOf(ConflictError);
    await expect(recordAttendance(marie, eventA, childIds.Inaya!, { kind: "check_in", note: null })).rejects.toBeInstanceOf(NotFoundError); // not assigned
    const dash = await getPresenceDashboard(marie, eventA);
    expect(dash).toMatchObject({ total: 2, present: 1, expected: 1, left: 0 });

    // No authorised person yet → validation error, no record written.
    await expect(performHandover(marie, eventA, childIds.Lea!, { authorizedPersonId: "00000000-0000-4000-8000-000000000000", identityCheckMethod: "id_document", identityCheckDetails: "", note: null })).rejects.toBeInstanceOf(ValidationError);
    await addAuthorizedPerson(louis, eventA, childIds.Lea!, { name: "Tante Louise", relationship: "tante", phone: null, identityCheckHint: "CNI", isPrimaryGuardian: false });
    const detail = await getChildDetail(louis, eventA, childIds.Lea!);
    const person = detail.authorizedPersons[0]!;
    // The caterer cannot hand over (no permission → Forbidden at requireEventPermission).
    await expect(performHandover(julien, eventA, childIds.Lea!, { authorizedPersonId: person.id, identityCheckMethod: "id_document", identityCheckDetails: "", note: null })).rejects.toBeInstanceOf(ForbiddenError);
    const res = await performHandover(marie, eventA, childIds.Lea!, { authorizedPersonId: person.id, identityCheckMethod: "id_document", identityCheckDetails: "CNI n° …", note: null });
    const [record] = await db.select().from(childHandoverRecords).where(eq(childHandoverRecords.id, res.id));
    expect(record!.receivedByName).toBe("Tante Louise");
    expect(record!.confirmedByUserId).toBe(marie.userId);
    expect(record!.identityVerifiedHow).toMatch(/Pièce d'identité/);
    const checkouts = await db.select().from(childAttendance).where(and(eq(childAttendance.childId, childIds.Lea!), eq(childAttendance.kind, "check_out")));
    expect(checkouts).toHaveLength(1);
    await expect(performHandover(marie, eventA, childIds.Lea!, { authorizedPersonId: person.id, identityCheckMethod: "id_document", identityCheckDetails: "", note: null })).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("dietary counts and revocation", () => {
  it("the caterer gets anonymous aggregates only", async () => {
    const counts = await getDietaryCounts(julien, eventA);
    expect(counts.rows.find((r) => r.label === "végétarien")?.children).toBe(1);
    expect(counts.rows.find((r) => r.label === "sans gluten")?.children).toBe(1);
    expect(JSON.stringify(counts)).not.toMatch(/Lea|Noah|Inaya|Arachide/);
    await expect(getDietaryCounts(marie, eventA)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("a revoked nanny gets NotFound everywhere", async () => {
    await db.update(eventMembers).set({ status: "revoked", revokedAt: new Date() }).where(eq(eventMembers.id, marieMember));
    await expect(listChildren(marie, eventA)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getChildDetail(marie, eventA, childIds.Lea!)).rejects.toBeInstanceOf(NotFoundError);
    await expect(readSensitiveInformation(marie, eventA, childIds.Lea!, "x")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("retention anonymises children of ended events only", async () => {
    // Event A ends on 2027-06-13: before the 30-day delay our children are untouched (other suites may own older events).
    await anonymizeChildrenForEndedEvents(30, db, new Date("2027-06-20T00:00:00Z"), [eventA]);
    const [untouched] = await db.select().from(eventChildren).where(eq(eventChildren.id, childIds.Lea!));
    expect(untouched!.anonymizedAt).toBeNull();
    expect(untouched!.firstName).toBe("Lea");
    const n = await anonymizeChildrenForEndedEvents(30, db, new Date("2027-08-01T00:00:00Z"), [eventA]);
    expect(n).toBeGreaterThanOrEqual(3);
    const [lea] = await db.select().from(eventChildren).where(eq(eventChildren.id, childIds.Lea!));
    expect(lea!.firstName).toBe("—");
    expect(lea!.guardianPhone).toBe("—");
    expect(lea!.anonymizedAt).not.toBeNull();
    const sensitive = await db.select().from(childSensitiveInformation).where(eq(childSensitiveInformation.childId, childIds.Lea!));
    expect(sensitive).toHaveLength(0);
  });
});
