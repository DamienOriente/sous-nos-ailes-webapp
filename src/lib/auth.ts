import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, twoFactor } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, userAc } from "better-auth/plugins/admin/access";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { authSecret } from "@/lib/crypto";
import { env, isProduction } from "@/lib/env";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { renderEmail } from "@/modules/notifications/infrastructure/email-templates";
import { sendMail } from "@/modules/notifications/infrastructure/mailer";
import { onUserCreated } from "@/modules/identity/infrastructure/user-hooks";
import { securityEventsPlugin } from "@/modules/identity/infrastructure/auth-security-plugin";

/**
 * Platform roles known to the admin plugin. Business authorisation (events,
 * listings, moderation permissions) lives in modules/authorization; this only
 * decides who may call the admin plugin endpoints (ban, impersonate, list users).
 */
const strictRateLimits = isProduction || env.AUTH_RATE_LIMIT_STRICT;
const ac = createAccessControl(defaultStatements);
const platformRoles = {
  user: userAc,
  moderator: ac.newRole({ user: ["list", "ban"], session: ["list"] }),
  admin: adminAc,
  super_admin: adminAc,
};

/**
 * Authentication is delegated to better-auth (maintained library, no home-made
 * crypto). Sessions are cookie based (HttpOnly, SameSite=Lax, Secure in prod),
 * rotated on sign-in, revocable, with rate limiting backed by Redis.
 */
export const auth = betterAuth({
  appName: "Sous Nos Ailes",
  baseURL: env.APP_URL,
  secret: authSecret,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
      twoFactor: schema.twoFactors,
    },
  }),
  secondaryStorage: {
    get: async (key) => (await redis.get(`auth:${key}`)) ?? null,
    getAndDelete: async (key) => (await redis.getdel(`auth:${key}`)) ?? null,
    increment: async (key, ttl) => {
      const k = `auth:${key}`;
      const value = await redis.incr(k);
      if (value === 1 && ttl) await redis.expire(k, ttl);
      return value;
    },
    set: async (key, value, ttl) => {
      if (ttl) await redis.set(`auth:${key}`, value, "EX", ttl);
      else await redis.set(`auth:${key}`, value);
    },
    delete: async (key) => {
      await redis.del(`auth:${key}`);
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    requireEmailVerification: isProduction,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      const mail = renderEmail({
        subject: "Réinitialisation de votre mot de passe",
        heading: "Réinitialiser votre mot de passe",
        paragraphs: [
          `Bonjour ${user.name},`,
          "Vous avez demandé à réinitialiser le mot de passe de votre compte Sous Nos Ailes. Ce lien est valable une heure.",
          "Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet e-mail : votre mot de passe reste inchangé.",
        ],
        cta: { label: "Choisir un nouveau mot de passe", url },
      });
      await sendMail({ to: user.email, ...mail });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      const mail = renderEmail({
        subject: "Confirmez votre adresse e-mail",
        heading: "Bienvenue sous nos ailes",
        paragraphs: [
          `Bonjour ${user.name},`,
          "Merci de confirmer votre adresse e-mail pour sécuriser votre compte et recevoir vos notifications.",
        ],
        cta: { label: "Confirmer mon adresse", url },
      });
      await sendMail({ to: user.email, ...mail });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
    storage: "secondary-storage",
    // Production keeps strict limits; local/test environments would otherwise block
    // test suites and demos sharing one IP. Successful logins count too (better-auth).
    customRules: {
      "/sign-in/email": { window: 60, max: strictRateLimits ? 10 : 300 },
      "/sign-up/email": { window: 60, max: strictRateLimits ? 5 : 300 },
      "/request-password-reset": { window: 300, max: 3 },
      "/two-factor/verify-totp": { window: 60, max: 5 },
    },
  },
  user: {
    additionalFields: {
      locale: { type: "string", required: false, defaultValue: "fr", input: false },
      timezone: { type: "string", required: false, defaultValue: "Europe/Paris", input: false },
      isDemo: { type: "boolean", required: false, defaultValue: false, input: false },
      lastLoginAt: { type: "date", required: false, input: false },
    },
    changeEmail: { enabled: false },
    deleteUser: { enabled: false },
  },
  advanced: {
    useSecureCookies: isProduction,
    cookiePrefix: "sna",
    defaultCookieAttributes: { sameSite: "lax", httpOnly: true, path: "/" },
    ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
  },
  trustedOrigins: [env.APP_URL],
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await onUserCreated(user.id);
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          logger.info({ userId: session.userId }, "session created");
        },
      },
    },
  },
  plugins: [
    twoFactor({ issuer: "Sous Nos Ailes" }),
    admin({ ac, roles: platformRoles, adminRoles: ["admin", "super_admin"], defaultRole: "user" }),
    securityEventsPlugin(),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
export type AuthUser = Session["user"];
