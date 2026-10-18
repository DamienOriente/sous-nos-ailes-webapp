"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { consumeNextPath, describeAuthFailure } from "@/components/auth/auth-client-error";
import { RateLimitNotice } from "@/components/auth/rate-limit-notice";
import { FormMessage } from "@/components/shared/form-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { backupCodeSchema, safeNextPath, totpCodeSchema } from "@/modules/identity/domain/auth";

type Mode = "totp" | "backup";

/** Second step of sign-in for accounts with 2FA: TOTP code from the authenticator, or one backup code. */
export function TwoFactorVerifyForm() {
  const router = useRouter();
  const ids = { code: useId(), trust: useId() };
  const [mode, setMode] = useState<Mode>("totp");
  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryUntil, setRetryUntil] = useState<number | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsed = mode === "totp" ? totpCodeSchema.safeParse(code) : backupCodeSchema.safeParse(code);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Code invalide.");
      return;
    }
    setPending(true);
    let response: Response | null = null;
    const fetchOptions = { onError: (ctx: { response: Response }) => { response = ctx.response; } };
    const result =
      mode === "totp"
        ? await authClient.twoFactor.verifyTotp({ code: parsed.data, trustDevice }, fetchOptions)
        : await authClient.twoFactor.verifyBackupCode({ code: parsed.data, trustDevice }, fetchOptions);
    if (result.error) {
      const failure = describeAuthFailure(result.error, response);
      setError(failure.message);
      setRetryUntil(failure.retryUntil);
      setPending(false);
      setCode("");
      return;
    }
    router.push(safeNextPath(consumeNextPath()));
    router.refresh();
  }

  function switchMode(next: Mode) {
    setMode(next);
    setCode("");
    setError(null);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {retryUntil ? <RateLimitNotice until={retryUntil} onExpire={() => { setRetryUntil(null); setError(null); }} /> : <FormMessage error={error} />}
      <div className="space-y-2">
        <Label htmlFor={ids.code}>{mode === "totp" ? "Code à 6 chiffres" : "Code de secours"}</Label>
        <Input
          id={ids.code}
          name="code"
          autoComplete="one-time-code"
          inputMode={mode === "totp" ? "numeric" : "text"}
          pattern={mode === "totp" ? "[0-9]*" : undefined}
          maxLength={mode === "totp" ? 6 : 11}
          autoFocus
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="text-center text-lg tracking-[0.3em] tabular-nums"
          aria-invalid={error ? true : undefined}
          aria-describedby={`${ids.code}-help`}
        />
        <p id={`${ids.code}-help`} className="text-xs text-muted-foreground">
          {mode === "totp" ? "Ouvrez votre application d'authentification (Google Authenticator, 1Password, Aegis…)." : "Chaque code de secours ne fonctionne qu'une seule fois."}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id={ids.trust} checked={trustDevice} onCheckedChange={(v) => setTrustDevice(v === true)} />
        <Label htmlFor={ids.trust} className="font-normal">
          Faire confiance à cet appareil pendant 30 jours
        </Label>
      </div>
      <Button type="submit" className="w-full" disabled={pending || retryUntil !== null} aria-busy={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        Vérifier
      </Button>
      <Button type="button" variant="outline" className="w-full" onClick={() => switchMode(mode === "totp" ? "backup" : "totp")}>
        {mode === "totp" ? "Utiliser un code de secours" : "Utiliser l'application d'authentification"}
      </Button>
    </form>
  );
}
