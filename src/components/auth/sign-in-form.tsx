"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { AuthLink } from "@/components/auth/auth-card";
import { describeAuthFailure, rememberNextPath } from "@/components/auth/auth-client-error";
import { PasswordInput } from "@/components/auth/password-input";
import { RateLimitNotice } from "@/components/auth/rate-limit-notice";
import { FormMessage } from "@/components/shared/form-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { signInSchema } from "@/modules/identity/domain/auth";

export function SignInForm({ next, notice }: { next: string; notice?: string | null }) {
  const router = useRouter();
  const ids = { email: useId(), password: useId(), remember: useId(), error: useId() };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [retryUntil, setRetryUntil] = useState<number | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsed = signInSchema.safeParse({ email, password, rememberMe });
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error).fieldErrors;
      setFieldErrors({ email: flat.email?.[0] ?? "", password: flat.password?.[0] ?? "" });
      return;
    }
    setFieldErrors({});
    setPending(true);
    rememberNextPath(next);
    let response: Response | null = null;
    const { data, error: err } = await authClient.signIn.email(
      { email: parsed.data.email, password: parsed.data.password, rememberMe: parsed.data.rememberMe },
      { onError: (ctx) => { response = ctx.response; } },
    );
    if (err) {
      const failure = describeAuthFailure(err, response);
      setError(failure.message);
      setRetryUntil(failure.retryUntil);
      setPending(false);
      return;
    }
    // 2FA accounts: the client plugin performs the full-page redirect to /connexion/verification.
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) return;
    router.push(next);
    router.refresh();
  }

  const locked = retryUntil !== null;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {notice && <FormMessage success={notice} />}
      {retryUntil ? <RateLimitNotice until={retryUntil} onExpire={() => { setRetryUntil(null); setError(null); }} /> : <FormMessage error={error} />}
      <div className="space-y-2">
        <Label htmlFor={ids.email}>Adresse e-mail</Label>
        <Input
          id={ids.email}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={Boolean(fieldErrors.email) || undefined}
          aria-describedby={fieldErrors.email ? `${ids.email}-error` : undefined}
        />
        {fieldErrors.email && (
          <p id={`${ids.email}-error`} className="text-sm text-destructive" role="alert">
            {fieldErrors.email}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={ids.password}>Mot de passe</Label>
          <AuthLink href="/mot-de-passe-oublie">Mot de passe oublié ?</AuthLink>
        </div>
        <PasswordInput
          id={ids.password}
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={Boolean(fieldErrors.password) || undefined}
          aria-describedby={fieldErrors.password ? `${ids.password}-error` : undefined}
        />
        {fieldErrors.password && (
          <p id={`${ids.password}-error`} className="text-sm text-destructive" role="alert">
            {fieldErrors.password}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id={ids.remember} checked={rememberMe} onCheckedChange={(v) => setRememberMe(v === true)} />
        <Label htmlFor={ids.remember} className="font-normal">
          Se souvenir de moi sur cet appareil
        </Label>
      </div>
      <Button type="submit" className="w-full" disabled={pending || locked} aria-busy={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        Se connecter
      </Button>
    </form>
  );
}
