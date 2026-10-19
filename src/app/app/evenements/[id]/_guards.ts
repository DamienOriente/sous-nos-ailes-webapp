import { notFound } from "next/navigation";
import { isAppError } from "@/lib/errors";

/**
 * Pages call services that throw NotFound/Forbidden; both map to the 404 page
 * so a non-member cannot tell whether an event exists.
 */
export async function guardPage<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (e) {
    if (isAppError(e) && (e.code === "not_found" || e.code === "forbidden")) notFound();
    throw e;
  }
}
