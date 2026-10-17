"use client";
import { useId, useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { describeAuthFailure } from "@/components/auth/auth-client-error";
import { RateLimitNotice } from "@/components/auth/rate-limit-notice";
import { FormMessage } from "@/components/shared/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { emailSchema } from "@/modules/identity/domain/auth";

export function ForgotPasswordForm() {
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [retryUntil, setRetryUntil] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Adresse e-mail invalide.");
      return;
    }
    setPending(true);
    let response: Response | null = null;
    const { error: err } = await authClient.requestPasswordReset({ email: parsed.data, redirectTo: "/reinitialiser" }, { onError: (ctx) => { response = ctx.response; } });
    setPending(false);
    if (err && (err.status === 429 || (response as Response | null)?.status === 429)) {
      const failure = describeAuthFailure(err, response);
      setRetryUntil(failure.retryUntil);
      return;
    }
    // Any other outcome shows the same confirmation: never reveal whether the address exists.
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4" role="status">
        <div className="flex items-start gap-3 rounded-xl bg-success/15 p-4 text-sm">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
          <p>
            Si un compte existe pour <strong>{email}</strong>, un e-mail contenant un lien de réinitialisation vient de partir. Le lien est valable une heure. Pensez à vérifier vos courriers indésirables.
          </p>
        </div>
        <Button type="button" variant="outline" className="w-full" onClick={() => setSent(false)}>
          Utiliser une autre adresse
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {retryUntil ? <RateLimitNotice until={retryUntil} onExpire={() => { setRetryUntil(null); setError(null); }} /> : <FormMessage error={error} />}
      <div className="space-y-2">
        <Label htmlFor={emailId}>Adresse e-mail du compte</Label>
        <Input id={emailId} name="email" type="email" inputMode="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={error ? true : undefined} />
      </div>
      <Button type="submit" className="w-full" disabled={pending || retryUntil !== null} aria-busy={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        Envoyer le lien
      </Button>
    </form>
  );
}
