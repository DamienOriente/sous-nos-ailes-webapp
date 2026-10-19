import { db, type DbExecutor } from "@/db/client";
import { productEvents } from "@/db/schema";
import { logger } from "@/lib/logger";
import { decideTracking, sanitizeProperties, type ProductEventName, type ProductEventProps, type TrackContext } from "@/modules/analytics/domain/events";

/**
 * Records a product event. Never throws: analytics must not break a business
 * action. Consent rules live in `decideTracking`.
 */
export async function track(name: ProductEventName, props: ProductEventProps | undefined, ctx: TrackContext, executor: DbExecutor = db): Promise<boolean> {
  const decision = decideTracking(ctx);
  if (!decision.track) return false;
  try {
    await executor.insert(productEvents).values({ name, userId: decision.userId, anonymousId: decision.anonymousId, properties: sanitizeProperties(name, props) });
    return true;
  } catch (err) {
    logger.warn({ name, err: err instanceof Error ? err.message : String(err) }, "product event not recorded");
    return false;
  }
}
