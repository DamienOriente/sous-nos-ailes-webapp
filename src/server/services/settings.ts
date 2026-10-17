import { cache } from "react";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/db";
import type { BusinessSettings, ServiceOption } from "@/generated/prisma/client";
import { CONTENT_DEFAULTS } from "@/server/content-defaults";
import type { PricingSettings } from "@/domain/pricing";
import type { StaffingRatios } from "@/domain/staffing";

export type { BusinessSettings, ServiceOption };

/** Returns the singleton settings row, creating it with defaults when missing. */
export const getSettings = cache(async (): Promise<BusinessSettings> => {
  const existing = await db.businessSettings.findUnique({ where: { id: "default" } });
  if (existing) return existing;
  return db.businessSettings.upsert({ where: { id: "default" }, create: { id: "default" }, update: {} });
});

export async function updateSettings(data: Prisma.BusinessSettingsUpdateInput): Promise<BusinessSettings> {
  return db.businessSettings.upsert({ where: { id: "default" }, create: { id: "default", ...(data as Prisma.BusinessSettingsCreateInput) }, update: data });
}

export function pricingSettingsFrom(settings: BusinessSettings): PricingSettings {
  return {
    hourlyRateCents: settings.hourlyRateCents,
    minimumHours: settings.minimumHours,
    minimumAmountCents: settings.minimumAmountCents,
    nightSurchargeStartHour: settings.nightSurchargeStartHour,
    nightSurchargePercent: settings.nightSurchargePercent,
    sundaySurchargePercent: settings.sundaySurchargePercent,
    vatMode: settings.vatMode,
    vatRateBps: settings.vatRateBps,
  };
}

export function staffingRatiosFrom(settings: BusinessSettings): StaffingRatios {
  return {
    ratioUnder3: settings.ratioUnder3,
    ratio3to5: settings.ratio3to5,
    ratio6to10: settings.ratio6to10,
    ratio11plus: settings.ratio11plus,
    minProviders: settings.minProviders,
  };
}

export const listActiveOptions = cache(async (): Promise<ServiceOption[]> => {
  return db.serviceOption.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] });
});

export async function listAllOptions(): Promise<ServiceOption[]> {
  return db.serviceOption.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }] });
}

export async function upsertOption(input: {
  id?: string;
  code: string;
  label: string;
  description?: string | null;
  priceCents: number;
  pricingUnit: ServiceOption["pricingUnit"];
  isActive: boolean;
  sortOrder: number;
}): Promise<ServiceOption> {
  const { id, ...data } = input;
  if (id) return db.serviceOption.update({ where: { id }, data });
  return db.serviceOption.upsert({ where: { code: data.code }, create: data, update: data });
}

export const getContent = cache(async (key: string): Promise<{ title: string; body: string }> => {
  const block = await db.contentBlock.findUnique({ where: { key } });
  if (block) return { title: block.title ?? CONTENT_DEFAULTS[key]?.title ?? key, body: block.body };
  const fallback = CONTENT_DEFAULTS[key];
  return fallback ?? { title: key, body: "" };
});

export async function listContentBlocks(): Promise<Array<{ key: string; title: string; body: string; updatedAt: Date | null }>> {
  const blocks = await db.contentBlock.findMany();
  const byKey = new Map(blocks.map((b) => [b.key, b]));
  return Object.entries(CONTENT_DEFAULTS).map(([key, def]) => {
    const block = byKey.get(key);
    return { key, title: block?.title ?? def.title, body: block?.body ?? def.body, updatedAt: block?.updatedAt ?? null };
  });
}

export async function updateContent(key: string, body: string): Promise<void> {
  if (!CONTENT_DEFAULTS[key]) throw new Error(`Unknown content key: ${key}`);
  await db.contentBlock.upsert({
    where: { key },
    create: { key, title: CONTENT_DEFAULTS[key].title, body },
    update: { body },
  });
}

/** Splits stored plain text into paragraphs for rendering. */
export function paragraphsOf(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}
