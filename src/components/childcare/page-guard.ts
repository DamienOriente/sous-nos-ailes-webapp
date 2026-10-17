import { notFound } from "next/navigation";
import { isAppError } from "@/lib/errors";

/**
 * Pages render NotFound for both missing and forbidden private resources
 * (anti-enumeration). Any other error bubbles up to error.tsx.
 */
export async function guardPage<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (e) {
    if (isAppError(e) && (e.code === "not_found" || e.code === "forbidden")) notFound();
    throw e;
  }
}
