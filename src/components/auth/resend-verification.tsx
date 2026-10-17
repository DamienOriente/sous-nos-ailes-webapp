"use client";
import { useId, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { describeAuthFailure } from "@/components/auth/auth-client-error";
import { RateLimitNotice } from "@/components/auth/rate-limit-notice";
import { FormMessage } from "@/components/shared/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { emailSchema } from "@/modules/identity/domain/auth";

export const VERIFICATION_CALLBACK = "/verification-email?statut=ok";

/**
 * "Renvoyer l'e-mail de confirmation". When the visitor is signed in the
 * address is known; otherwise they type it (the response never says whether
 * the address exists).
 */
export function ResendVerification({ email: knownEmail, variant = "card" }: { email?: string | null; variant?: "card" | "inline" }) {
  const emailId = useId();
  const [email, setEmail] = useState(knownEmail ?? "");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryUntil, setRetryUntil] = useState<number | null>(null);

  async function send() {
    setError(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Adresse e-mail invalide.");
      return;
    }
    setPending(true);
    let response: Response | null = null;
    const { error: err } = await authClient.sendVerificationEmail({ email: parsed.data, callbackURL: VERIFICATION_CALLBACK }, { onError: (ctx) => { response = ctx.response; } });
    setPending(false);
    if (err && (err.status === 429 || (response as Response | null)?.status === 429)) {
      setRetryUntil(describeAuthFailure(err, response).retryUntil);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <p role="status" className={variant === "inline" ? "text-sm" : "rounded-lg bg-success/15 px-3 py-2 text-sm"}>
        E-mail renvoyé à <strong>{email}</strong>. Il peut mettre une minute à arriver.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {retryUntil ? <RateLimitNotice until={retryUntil} onExpire={() => { setRetryUntil(null); setError(null); }} /> : <FormMessage error={error} />}
      {!knownEmail && (
        <div className="space-y-2">
          <Label htmlFor={emailId}>Adresse e-mail</Label>
          <Input id={emailId} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={error ? true : undefined} />
        </div>
      )}
      <Button type="button" variant={variant === "inline" ? "outline" : "default"} size={variant === "inline" ? "sm" : "default"} onClick={send} disabled={pending || retryUntil !== null} aria-busy={pending} className={variant === "card" ? "w-full" : undefined}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
        Renvoyer l'e-mail de confirmation
      </Button>
    </div>
  );
}
