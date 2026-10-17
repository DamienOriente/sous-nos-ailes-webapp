import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="contenu" className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">Erreur 404</p>
      <h1 className="text-3xl font-semibold">Cette page n'existe pas ou n'est plus disponible.</h1>
      <p className="max-w-md text-muted-foreground">Le lien est peut-être erroné, ou la ressource a été retirée. Si vous pensez qu'il s'agit d'une erreur, contactez-nous.</p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/">Retour à l'accueil</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/app">Mon espace</Link>
        </Button>
      </div>
    </main>
  );
}
