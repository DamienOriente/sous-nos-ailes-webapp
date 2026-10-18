import { ResendVerification } from "@/components/auth/resend-verification";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function EmailVerificationBanner({ email }: { email: string }) {
  return (
    <Alert className="border-warning/50 bg-warning/15 text-warning-foreground">
      <AlertTitle>Confirmez votre adresse e-mail</AlertTitle>
      <AlertDescription className="gap-3 text-warning-foreground/90">
        <p>
          Un lien de confirmation a été envoyé à <strong>{email}</strong>. Tant que l'adresse n'est pas confirmée, vous ne recevrez pas de notifications par e-mail.
        </p>
        <ResendVerification email={email} variant="inline" />
      </AlertDescription>
    </Alert>
  );
}
