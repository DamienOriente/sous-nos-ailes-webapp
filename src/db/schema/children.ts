import { relations } from "drizzle-orm";
import { boolean, index, pgEnum, pgTable, smallint, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps, tsz } from "./_shared";
import { users } from "./identity";
import { events, eventMembers } from "./events";
import { eventGuests } from "./guests";

/**
 * Children attending an event. Data minimisation: identity + age + what the
 * care team needs. Anything health-related lives encrypted in
 * child_sensitive_information with its own access log.
 */
export const eventChildren = pgTable(
  "event_children",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    guestId: uuid("guest_id").references(() => eventGuests.id, { onDelete: "set null" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull().default(""),
    /** Age in years at the event date; birth date is NOT collected. */
    ageYears: smallint("age_years").notNull(),
    /** Legal guardian attending the event. */
    guardianName: text("guardian_name").notNull(),
    guardianPhone: text("guardian_phone").notNull(),
    guardianEmail: text("guardian_email"),
    /** Operational, non-medical instructions ("sieste après le déjeuner", "ne mange pas de porc"). */
    careInstructions: text("care_instructions"),
    dietaryPreference: text("dietary_preference"),
    expectedArrivalAt: tsz("expected_arrival_at"),
    expectedDepartureAt: tsz("expected_departure_at"),
    /** Who entered the data and when the guardian was informed. */
    registeredByUserId: text("registered_by_user_id").references(() => users.id, { onDelete: "set null" }),
    guardianInformedAt: tsz("guardian_informed_at"),
    /** Retention: anonymised after the configured delay post-event. */
    anonymizedAt: tsz("anonymized_at"),
    ...timestamps,
  },
  (t) => [index("event_children_event_idx").on(t.eventId)],
);

/**
 * Health-related information, AES-256-GCM encrypted at rest. Access requires
 * the "children.view_sensitive" permission, explicit consent recorded below,
 * and every read is logged in child_access_logs.
 */
export const childSensitiveInformation = pgTable("child_sensitive_information", {
  childId: uuid("child_id")
    .primaryKey()
    .references(() => eventChildren.id, { onDelete: "cascade" }),
  /** Encrypted: allergies and what to do. */
  allergiesEncrypted: text("allergies_encrypted"),
  /** Encrypted: medical notes relevant to care (medication, conditions). */
  healthNotesEncrypted: text("health_notes_encrypted"),
  /** Plain boolean so the care team knows there is something to read, without reading it. */
  hasAllergies: boolean("has_allergies").notNull().default(false),
  hasHealthNotes: boolean("has_health_notes").notNull().default(false),
  /** Consent for processing health data (explicit, GDPR art. 9). */
  consentGivenByName: text("consent_given_by_name"),
  consentGivenAt: tsz("consent_given_at"),
  consentWithdrawnAt: tsz("consent_withdrawn_at"),
  consentRecordedByUserId: text("consent_recorded_by_user_id").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
});

export const childEmergencyContacts = pgTable(
  "child_emergency_contacts",
  {
    id: id(),
    childId: uuid("child_id")
      .notNull()
      .references(() => eventChildren.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    relationship: text("relationship").notNull(),
    phone: text("phone").notNull(),
    priority: smallint("priority").notNull().default(1),
    ...timestamps,
  },
  (t) => [index("child_emergency_contacts_child_idx").on(t.childId)],
);

/** People allowed to pick the child up. Handover is confirmed by a care team member, never by a QR code alone. */
export const childAuthorizedPersons = pgTable(
  "child_authorized_persons",
  {
    id: id(),
    childId: uuid("child_id")
      .notNull()
      .references(() => eventChildren.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    relationship: text("relationship").notNull(),
    phone: text("phone"),
    /** How the care team is expected to verify identity ("pièce d'identité", "connu du responsable"). */
    identityCheckHint: text("identity_check_hint"),
    isPrimaryGuardian: boolean("is_primary_guardian").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("child_authorized_persons_child_idx").on(t.childId)],
);

/** Which care team member (event member with role staff/provider) looks after which child. */
export const childCareAssignments = pgTable(
  "child_care_assignments",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    childId: uuid("child_id")
      .notNull()
      .references(() => eventChildren.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => eventMembers.id, { onDelete: "cascade" }),
    assignedByUserId: text("assigned_by_user_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("child_care_assignments_uq").on(t.childId, t.memberId), index("child_care_assignments_member_idx").on(t.memberId)],
);

export const attendanceKindEnum = pgEnum("attendance_kind", ["check_in", "check_out", "incident", "note"]);

export const childAttendance = pgTable(
  "child_attendance",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    childId: uuid("child_id")
      .notNull()
      .references(() => eventChildren.id, { onDelete: "cascade" }),
    kind: attendanceKindEnum("kind").notNull(),
    recordedByUserId: text("recorded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    recordedAt: tsz("recorded_at").notNull().defaultNow(),
    note: text("note"),
  },
  (t) => [index("child_attendance_child_idx").on(t.childId, t.recordedAt), index("child_attendance_event_idx").on(t.eventId)],
);

/** Handover of a child to an authorised person: who, to whom, verified how, confirmed by which staff member. */
export const childHandoverRecords = pgTable(
  "child_handover_records",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    childId: uuid("child_id")
      .notNull()
      .references(() => eventChildren.id, { onDelete: "cascade" }),
    authorizedPersonId: uuid("authorized_person_id").references(() => childAuthorizedPersons.id, { onDelete: "set null" }),
    receivedByName: text("received_by_name").notNull(),
    identityVerifiedHow: text("identity_verified_how").notNull(),
    confirmedByUserId: text("confirmed_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    handedOverAt: tsz("handed_over_at").notNull().defaultNow(),
    note: text("note"),
  },
  (t) => [index("child_handover_records_child_idx").on(t.childId)],
);

/** Every read of sensitive child data is logged (who, which child, why). */
export const childAccessLogs = pgTable(
  "child_access_logs",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    childId: uuid("child_id")
      .notNull()
      .references(() => eventChildren.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    action: text("action").notNull(), // view_sensitive | edit_sensitive | export
    purpose: text("purpose"),
    accessedAt: tsz("accessed_at").notNull().defaultNow(),
  },
  (t) => [index("child_access_logs_child_idx").on(t.childId, t.accessedAt), index("child_access_logs_user_idx").on(t.userId)],
);

/** Planned care activities (program for the kids' corner). */
export const childcareActivities = pgTable(
  "childcare_activities",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    startsAt: tsz("starts_at").notNull(),
    endsAt: tsz("ends_at"),
    minAge: smallint("min_age"),
    maxAge: smallint("max_age"),
    location: text("location"),
    ...timestamps,
  },
  (t) => [index("childcare_activities_event_idx").on(t.eventId, t.startsAt)],
);

export const eventChildrenRelations = relations(eventChildren, ({ one, many }) => ({
  event: one(events, { fields: [eventChildren.eventId], references: [events.id] }),
  sensitive: one(childSensitiveInformation, { fields: [eventChildren.id], references: [childSensitiveInformation.childId] }),
  emergencyContacts: many(childEmergencyContacts),
  authorizedPersons: many(childAuthorizedPersons),
  careAssignments: many(childCareAssignments),
  attendance: many(childAttendance),
}));
export const childEmergencyContactsRelations = relations(childEmergencyContacts, ({ one }) => ({
  child: one(eventChildren, { fields: [childEmergencyContacts.childId], references: [eventChildren.id] }),
}));
export const childAuthorizedPersonsRelations = relations(childAuthorizedPersons, ({ one }) => ({
  child: one(eventChildren, { fields: [childAuthorizedPersons.childId], references: [eventChildren.id] }),
}));
export const childCareAssignmentsRelations = relations(childCareAssignments, ({ one }) => ({
  child: one(eventChildren, { fields: [childCareAssignments.childId], references: [eventChildren.id] }),
  member: one(eventMembers, { fields: [childCareAssignments.memberId], references: [eventMembers.id] }),
}));
export const childAttendanceRelations = relations(childAttendance, ({ one }) => ({
  child: one(eventChildren, { fields: [childAttendance.childId], references: [eventChildren.id] }),
  recordedBy: one(users, { fields: [childAttendance.recordedByUserId], references: [users.id] }),
}));

