import { env, googleConfigured, microsoftConfigured } from "@/lib/env";
import { GoogleCalendarAdapter } from "./google-calendar";
import { MicrosoftGraphAdapter } from "./microsoft-graph";
import type { CalendarProvider, CalendarProviderAdapter, FetchLike } from "./provider-adapter";

/** Resolves the adapter for a provider, or null when the platform has no client credentials for it. */
export function getProviderAdapter(provider: CalendarProvider, fetchImpl: FetchLike = fetch): CalendarProviderAdapter | null {
  if (provider === "google") {
    if (!googleConfigured) return null;
    return new GoogleCalendarAdapter({ clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET! }, fetchImpl);
  }
  if (!microsoftConfigured) return null;
  return new MicrosoftGraphAdapter({ clientId: env.MICROSOFT_CLIENT_ID!, clientSecret: env.MICROSOFT_CLIENT_SECRET!, tenant: env.MICROSOFT_TENANT }, fetchImpl);
}

export function isProviderConfigured(provider: CalendarProvider): boolean {
  return provider === "google" ? googleConfigured : microsoftConfigured;
}

export const PROVIDER_LABELS: Record<CalendarProvider, string> = { google: "Google Agenda", microsoft: "Microsoft Outlook" };
