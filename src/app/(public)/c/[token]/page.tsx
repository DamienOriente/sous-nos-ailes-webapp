import type { Metadata } from "next";
import Link from "next/link";
import { Container, Section } from "@/components/shared/section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Code d'accès", robots: { index: false, follow: false } };

/**
 * Landing page for a scanned check-in QR code. The code is validated only by
 * the event staff from the check-in console; this page just tells the guest
 * what to do with it and never reveals anything about the invitation.
 */
export default function CheckinCodePage() {
  return (
    <Section>
      <Container size="narrow">
        <Card className="items-center gap-5 p-8 text-center">
          <h1 className="text-2xl font-semibold">Votre code d'accès à l'évènement</h1>
          <p className="max-w-md text-muted-foreground text-pretty">
            Présentez ce QR code à l'accueil le jour de l'évènement : l'équipe le validera depuis sa console de contrôle. Il n'est utilisable qu'une seule fois et ne contient aucune information personnelle.
          </p>
          <p className="text-sm text-muted-foreground">Pour répondre à l'invitation, utilisez le lien reçu par e-mail.</p>
          <Button asChild variant="outline">
            <Link href="/">Découvrir Sous Nos Ailes</Link>
          </Button>
        </Card>
      </Container>
    </Section>
  );
}
