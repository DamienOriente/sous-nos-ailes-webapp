import { headers } from "next/headers";

/** Current pathname as seen by the proxy (set as a request header for layouts). */
export async function getCurrentPath(): Promise<string> {
  const h = await headers();
  return h.get("x-pathname") ?? "/";
}
