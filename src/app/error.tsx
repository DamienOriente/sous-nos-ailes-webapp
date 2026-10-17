"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="contenu" className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="text-xs font-semibold tracking-[0.12em] text-destructive uppercase">Une erreur est survenue</p>
      <h1 className="text-2xl font-semibold">Nous n'avons pas pu afficher cette page.</h1>
      <p className="max-w-md text-muted-foreground">
        L'incident a été enregistré{error.digest ? ` (référence ${error.digest})` : ""}. Vous pouvez réessayer ou revenir plus tard.
      </p>
      <Button onClick={reset}>Réessayer</Button>
    </main>
  );
}
