import type { BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware, getIP, isAPIError } from "better-auth/api";
import { recordSecurityEvent } from "@/modules/identity/application/security-service";

/**
 * better-auth plugin: journalises authentication outcomes into
 * `security_events`. After-hooks run even when the endpoint threw, so a failed
 * sign-in surfaces as `ctx.context.returned` being an APIError.
 *
 * To activate: add `securityEventsPlugin()` to the `plugins` array in
 * `src/lib/auth.ts` (shared file, see the identity module report).
 */
export function securityEventsPlugin(): BetterAuthPlugin {
  return {
    id: "sna-security-events",
    hooks: {
      after: [
        {
          matcher: (ctx) => ctx.path === "/sign-in/email" || ctx.path === "/two-factor/verify-totp" || ctx.path === "/two-factor/verify-backup-code" || ctx.path === "/request-password-reset" || ctx.path === "/reset-password",
          handler: createAuthMiddleware(async (ctx) => {
            const ip = ctx.request ? getIP(ctx.request, ctx.context.options) : null;
            const userAgent = ctx.request?.headers.get("user-agent") ?? ctx.headers?.get("user-agent") ?? null;
            const returned = ctx.context.returned;
            const failed = isAPIError(returned);
            const newSession = ctx.context.newSession;

            if (ctx.path === "/sign-in/email") {
              if (failed) {
                const status = returned.statusCode;
                await recordSecurityEvent({
                  type: status === 429 ? "rate_limited" : "login_failed",
                  ipAddress: ip,
                  userAgent,
                  // Never the password; the e-mail only as a coarse, non-reversible hint (domain).
                  details: { endpoint: ctx.path, status, emailDomain: domainOf(ctx.body?.email) },
                });
              } else if (newSession) {
                await recordSecurityEvent({ type: "login_succeeded", userId: newSession.user.id, ipAddress: ip, userAgent, details: { method: "password" } });
              }
              return;
            }

            if (ctx.path === "/two-factor/verify-totp" || ctx.path === "/two-factor/verify-backup-code") {
              if (failed) {
                await recordSecurityEvent({ type: "login_failed", ipAddress: ip, userAgent, details: { endpoint: ctx.path, status: returned.statusCode } });
              } else if (newSession) {
                await recordSecurityEvent({ type: "login_succeeded", userId: newSession.user.id, ipAddress: ip, userAgent, details: { method: ctx.path === "/two-factor/verify-totp" ? "totp" : "backup_code" } });
              }
              return;
            }

            if (ctx.path === "/request-password-reset" && !failed) {
              await recordSecurityEvent({ type: "password_reset_requested", ipAddress: ip, userAgent, details: { emailDomain: domainOf(ctx.body?.email) } });
              return;
            }
            if (ctx.path === "/reset-password" && !failed) {
              await recordSecurityEvent({ type: "password_reset_completed", ipAddress: ip, userAgent });
            }
          }),
        },
      ],
    },
  };
}

function domainOf(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const at = email.lastIndexOf("@");
  return at > 0 ? email.slice(at + 1).toLowerCase() : null;
}
