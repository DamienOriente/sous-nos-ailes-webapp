"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

/** Signs out, then opens the sign-in page that brings the user back to `nextPath`. */
export function SwitchAccountButton({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      aria-busy={pending}
      onClick={() =>
        start(async () => {
          await authClient.signOut();
          router.push(`/connexion?next=${encodeURIComponent(nextPath)}`);
          router.refresh();
        })
      }
    >
      Changer de compte
    </Button>
  );
}
