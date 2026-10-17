import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { getSessionSecret } from "@/lib/env";

/** Best-effort client identifier for rate limiting. Never persisted. */
export async function getClientKey(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  return createHmac("sha256", getSessionSecret()).update(ip).digest("hex").slice(0, 32);
}
