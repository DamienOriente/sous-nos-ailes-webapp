"use client";
import { createAuthClient } from "better-auth/react";
import { adminClient, twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- plugin callback has no router
        window.location.href = "/connexion/verification";
      },
    }),
    adminClient(),
  ],
});

export const { useSession, signIn, signUp, signOut } = authClient;
