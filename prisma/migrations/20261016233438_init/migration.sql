-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CLIENT', 'PROVIDER', 'PARTNER');

-- CreateEnum
CREATE TYPE "LoginTokenPurpose" AS ENUM ('MAGIC_LINK');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('WEDDING', 'PRIVATE_PARTY', 'PROFESSIONAL', 'OTHER');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('NEW', 'QUALIFYING', 'PROPOSAL_SENT', 'AGREED', 'PREPARING', 'CONFIRMED', 'COMPLETED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TriState" AS ENUM ('YES', 'PARTIAL', 'NO', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RequestSource" AS ENUM ('DIRECT', 'PARTNER_LINK', 'VENUE_PAGE');

-- CreateEnum
CREATE TYPE "QuoteVersionStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'SUPERSEDED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "QuoteLineKind" AS ENUM ('SERVICE', 'TRAVEL', 'OPTION', 'SURCHARGE', 'DISCOUNT', 'OTHER');

-- CreateEnum
CREATE TYPE "VatMode" AS ENUM ('NONE', 'STANDARD');

-- CreateEnum
CREATE TYPE "PricingUnit" AS ENUM ('FLAT', 'PER_HOUR', 'PER_PROVIDER');

-- CreateEnum
CREATE TYPE "ProviderVettingStatus" AS ENUM ('NEW', 'IN_REVIEW', 'ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "QualificationStatus" AS ENUM ('DECLARED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CostBasis" AS ENUM ('PER_MISSION', 'PER_HOUR');

-- CreateEnum
CREATE TYPE "AvailabilityKind" AS ENUM ('AVAILABLE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VenueType" AS ENUM ('CHATEAU', 'DOMAINE', 'SALLE_DE_RECEPTION', 'RESTAURANT', 'HOTEL', 'AUTRE');

-- CreateEnum
CREATE TYPE "PartnershipStatus" AS ENUM ('PROSPECT', 'ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "EditorialStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ReferralSourceKind" AS ENUM ('LINK', 'QR', 'VENUE_PAGE');

-- CreateEnum
CREATE TYPE "ApplicationKind" AS ENUM ('PROVIDER', 'PARTNER');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('NEW', 'REVIEWING', 'ACCEPTED', 'DECLINED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL,
    "passwordHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "LoginTokenPurpose" NOT NULL DEFAULT 'MAGIC_LINK',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "brandName" TEXT NOT NULL DEFAULT 'Les Petits Invités — avec Marie',
    "tagline" TEXT NOT NULL DEFAULT 'Une attention pour les enfants, de la sérénité pour votre événement.',
    "ownerFirstName" TEXT NOT NULL DEFAULT 'Marie',
    "contactEmail" TEXT NOT NULL DEFAULT 'contact@example.test',
    "contactPhone" TEXT,
    "areaLabel" TEXT NOT NULL DEFAULT 'Zone d’intervention à définir (paramètre de démonstration)',
    "hourlyRateCents" INTEGER NOT NULL DEFAULT 3500,
    "minimumHours" INTEGER NOT NULL DEFAULT 3,
    "minimumAmountCents" INTEGER,
    "defaultTravelFeeCents" INTEGER NOT NULL DEFAULT 0,
    "nightSurchargeStartHour" INTEGER NOT NULL DEFAULT 22,
    "nightSurchargePercent" INTEGER NOT NULL DEFAULT 25,
    "sundaySurchargePercent" INTEGER NOT NULL DEFAULT 0,
    "vatMode" "VatMode" NOT NULL DEFAULT 'NONE',
    "vatRateBps" INTEGER NOT NULL DEFAULT 2000,
    "publicEstimateEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publicEstimateMarginPct" INTEGER NOT NULL DEFAULT 15,
    "ratioUnder3" INTEGER NOT NULL DEFAULT 3,
    "ratio3to5" INTEGER NOT NULL DEFAULT 6,
    "ratio6to10" INTEGER NOT NULL DEFAULT 8,
    "ratio11plus" INTEGER NOT NULL DEFAULT 10,
    "minProviders" INTEGER NOT NULL DEFAULT 1,
    "travelBufferMinutes" INTEGER NOT NULL DEFAULT 45,
    "invitationExpiryHours" INTEGER NOT NULL DEFAULT 72,
    "dataRetentionMonths" INTEGER NOT NULL DEFAULT 36,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceOption" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "pricingUnit" "PricingUnit" NOT NULL DEFAULT 'FLAT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentBlock" (
    "key" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentBlock_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "PartnerVenue" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "VenueType" NOT NULL DEFAULT 'AUTRE',
    "city" TEXT NOT NULL,
    "postalCode" TEXT,
    "region" TEXT,
    "officialWebsite" TEXT,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "childrenSpaces" TEXT,
    "constraints" TEXT,
    "accessInfo" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "partnershipStatus" "PartnershipStatus" NOT NULL DEFAULT 'PROSPECT',
    "editorialStatus" "EditorialStatus" NOT NULL DEFAULT 'DRAFT',
    "lastVerifiedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "referralCode" TEXT NOT NULL,
    "illustrationKey" TEXT NOT NULL DEFAULT 'domaine',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "partnerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerVenue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceCounter" (
    "year" INTEGER NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ReferenceCounter_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "EventRequest" (
    "id" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL,
    "eventDate" DATE,
    "eventEndDate" DATE,
    "dateIsFlexible" BOOLEAN NOT NULL DEFAULT false,
    "dateNote" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "venueId" TEXT,
    "venueName" TEXT,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "childrenUnder3" INTEGER NOT NULL DEFAULT 0,
    "children3to5" INTEGER NOT NULL DEFAULT 0,
    "children6to10" INTEGER NOT NULL DEFAULT 0,
    "children11plus" INTEGER NOT NULL DEFAULT 0,
    "parentsOnSite" "TriState" NOT NULL DEFAULT 'UNKNOWN',
    "dedicatedSpace" "TriState" NOT NULL DEFAULT 'UNKNOWN',
    "optionCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "organizerName" TEXT NOT NULL,
    "organizerEmail" TEXT NOT NULL,
    "organizerPhone" TEXT,
    "organizerRole" TEXT,
    "message" TEXT,
    "privacyAcceptedAt" TIMESTAMP(3) NOT NULL,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "source" "RequestSource" NOT NULL DEFAULT 'DIRECT',
    "submissionKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'NEW',
    "title" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL,
    "date" DATE,
    "endDate" DATE,
    "dateIsFlexible" BOOLEAN NOT NULL DEFAULT false,
    "dateNote" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "venueId" TEXT,
    "venueName" TEXT,
    "venueAddressNote" TEXT,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "childrenUnder3" INTEGER NOT NULL DEFAULT 0,
    "children3to5" INTEGER NOT NULL DEFAULT 0,
    "children6to10" INTEGER NOT NULL DEFAULT 0,
    "children11plus" INTEGER NOT NULL DEFAULT 0,
    "parentsOnSite" "TriState" NOT NULL DEFAULT 'UNKNOWN',
    "dedicatedSpace" "TriState" NOT NULL DEFAULT 'UNKNOWN',
    "optionCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiredProviders" INTEGER NOT NULL DEFAULT 1,
    "spaceDescription" TEXT,
    "meetingPoint" TEXT,
    "onSiteContactName" TEXT,
    "onSiteContactPhone" TEXT,
    "scheduleNotes" TEXT,
    "opsValidatedAt" TIMESTAMP(3),
    "declinedReason" TEXT,
    "cancelledReason" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteVersion" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "QuoteVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "introText" TEXT,
    "validUntil" TIMESTAMP(3),
    "vatMode" "VatMode" NOT NULL DEFAULT 'NONE',
    "vatRateBps" INTEGER NOT NULL DEFAULT 0,
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "totalExclVatCents" INTEGER NOT NULL DEFAULT 0,
    "vatCents" INTEGER NOT NULL DEFAULT 0,
    "totalInclVatCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "supersededAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),

    CONSTRAINT "QuoteVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteLine" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "kind" "QuoteLineKind" NOT NULL DEFAULT 'SERVICE',
    "label" TEXT NOT NULL,
    "description" TEXT,
    "quantityHundredths" INTEGER NOT NULL DEFAULT 100,
    "unitPriceCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT,
    "sector" TEXT NOT NULL,
    "bio" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "vettingStatus" "ProviderVettingStatus" NOT NULL DEFAULT 'NEW',
    "vettingNote" TEXT,
    "vettedAt" TIMESTAMP(3),
    "costBasis" "CostBasis" NOT NULL DEFAULT 'PER_MISSION',
    "agreedCostCents" INTEGER NOT NULL DEFAULT 0,
    "costNote" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderQualification" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "issuer" TEXT,
    "year" INTEGER,
    "status" "QualificationStatus" NOT NULL DEFAULT 'DECLARED',
    "verifiedAt" TIMESTAMP(3),
    "verifiedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderQualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Availability" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "kind" "AvailabilityKind" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionInvitation" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "proposedCostCents" INTEGER,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "responseNote" TEXT,

    CONSTRAINT "MissionInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "invitationId" TEXT,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "roleLabel" TEXT,
    "agreedCostCents" INTEGER NOT NULL DEFAULT 0,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "sourceKind" "ReferralSourceKind" NOT NULL DEFAULT 'LINK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "key" TEXT,
    "label" TEXT NOT NULL,
    "isAuto" BOOLEAN NOT NULL DEFAULT false,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalNote" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "venueId" TEXT,
    "providerId" TEXT,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" "Role",
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "kind" "ApplicationKind" NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'NEW',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT,
    "organisation" TEXT,
    "sector" TEXT,
    "message" TEXT NOT NULL,
    "privacyAcceptedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "privacyAcceptedAt" TIMESTAMP(3) NOT NULL,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundEmail" (
    "id" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboundEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoginToken_tokenHash_key" ON "LoginToken"("tokenHash");

-- CreateIndex
CREATE INDEX "LoginToken_userId_idx" ON "LoginToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOption_code_key" ON "ServiceOption"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerVenue_slug_key" ON "PartnerVenue"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerVenue_referralCode_key" ON "PartnerVenue"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerVenue_partnerUserId_key" ON "PartnerVenue"("partnerUserId");

-- CreateIndex
CREATE INDEX "PartnerVenue_editorialStatus_partnershipStatus_idx" ON "PartnerVenue"("editorialStatus", "partnershipStatus");

-- CreateIndex
CREATE UNIQUE INDEX "EventRequest_submissionKey_key" ON "EventRequest"("submissionKey");

-- CreateIndex
CREATE UNIQUE INDEX "Event_reference_key" ON "Event"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Event_requestId_key" ON "Event"("requestId");

-- CreateIndex
CREATE INDEX "Event_status_idx" ON "Event"("status");

-- CreateIndex
CREATE INDEX "Event_startsAt_idx" ON "Event"("startsAt");

-- CreateIndex
CREATE INDEX "Event_clientId_idx" ON "Event"("clientId");

-- CreateIndex
CREATE INDEX "Event_venueId_idx" ON "Event"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_eventId_key" ON "Quote"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteVersion_quoteId_number_key" ON "QuoteVersion"("quoteId", "number");

-- CreateIndex
CREATE INDEX "QuoteLine_versionId_idx" ON "QuoteLine"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderProfile_userId_key" ON "ProviderProfile"("userId");

-- CreateIndex
CREATE INDEX "ProviderQualification_providerId_idx" ON "ProviderQualification"("providerId");

-- CreateIndex
CREATE INDEX "Availability_providerId_startsAt_idx" ON "Availability"("providerId", "startsAt");

-- CreateIndex
CREATE INDEX "MissionInvitation_providerId_status_idx" ON "MissionInvitation"("providerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MissionInvitation_eventId_providerId_key" ON "MissionInvitation"("eventId", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_invitationId_key" ON "Assignment"("invitationId");

-- CreateIndex
CREATE INDEX "Assignment_providerId_status_idx" ON "Assignment"("providerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_eventId_providerId_key" ON "Assignment"("eventId", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_requestId_key" ON "Referral"("requestId");

-- CreateIndex
CREATE INDEX "Referral_venueId_idx" ON "Referral"("venueId");

-- CreateIndex
CREATE INDEX "ChecklistItem_eventId_idx" ON "ChecklistItem"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistItem_eventId_key_key" ON "ChecklistItem"("eventId", "key");

-- CreateIndex
CREATE INDEX "InternalNote_eventId_idx" ON "InternalNote"("eventId");

-- CreateIndex
CREATE INDEX "InternalNote_venueId_idx" ON "InternalNote"("venueId");

-- CreateIndex
CREATE INDEX "InternalNote_providerId_idx" ON "InternalNote"("providerId");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "Application_kind_status_idx" ON "Application"("kind", "status");

-- CreateIndex
CREATE INDEX "OutboundEmail_entityType_entityId_idx" ON "OutboundEmail"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginToken" ADD CONSTRAINT "LoginToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerVenue" ADD CONSTRAINT "PartnerVenue_partnerUserId_fkey" FOREIGN KEY ("partnerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRequest" ADD CONSTRAINT "EventRequest_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "PartnerVenue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "EventRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "PartnerVenue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteVersion" ADD CONSTRAINT "QuoteVersion_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteVersion" ADD CONSTRAINT "QuoteVersion_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLine" ADD CONSTRAINT "QuoteLine_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "QuoteVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderProfile" ADD CONSTRAINT "ProviderProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderQualification" ADD CONSTRAINT "ProviderQualification_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionInvitation" ADD CONSTRAINT "MissionInvitation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionInvitation" ADD CONSTRAINT "MissionInvitation_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "MissionInvitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "PartnerVenue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "EventRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "PartnerVenue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
