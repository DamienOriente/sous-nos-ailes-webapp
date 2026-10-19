import { logger } from "@/lib/logger";
import { ensurePublicProfile } from "@/modules/pages/application/page-service";

/**
 * Bridge to the pages module: the onboarding stores the chosen template only
 * through `ensurePublicProfile` (the public page and its versions belong to
 * that module). The choice is also kept in `tradeDetails.__templateKey` so the
 * recap can display it. Failures never block the onboarding.
 */
export async function ensurePublicProfileIfAvailable(professionalId: string, templateKey: string): Promise<boolean> {
  try {
    await ensurePublicProfile(professionalId, templateKey);
    return true;
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err), professionalId }, "ensurePublicProfile failed");
    return false;
  }
}
