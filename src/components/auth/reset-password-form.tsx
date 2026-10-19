"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { describeAuthFailure } from "@/components/auth/auth-client-error";
import { PasswordInput } from "@/components/auth/password-input";
import { FormMessage } from "@/components/shared/form-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { resetPasswordSchema } from "@/modules/identity/domain/auth";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const ids = { password: useId(), confirm: useId() };
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsed = resetPasswordSchema.safeParse({ token, newPassword, confirmPassword });
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error).fieldErrors;
      setErrors({ newPassword: flat.newPassword?.[0], confirmPassword: flat.confirmPassword?.[0] });
      return;
    }
    setErrors({});
    setPending(true);
    let response: Response | null = null;
    const { error: err } = await authClient.resetPassword({ newPassword: parsed.data.newPassword, token: parsed.data.token }, { onError: (ctx) => { response = ctx.response; } });
    if (err) {
      setError(describeAuthFailure(err, response).message);
      setPending(false);
      return;
    }
    router.push("/connexion?message=mot-de-passe-reinitialise");
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormMessage error={error} />
      <div className="space-y-2">
        <Label htmlFor={ids.password}>Nouveau mot de passe</Label>
        <PasswordInput
          id={ids.password}
          name="newPassword"
          autoComplete="new-password"
          required
          autoFocus
          showStrength
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          aria-invalid={errors.newPassword ? true : undefined}
          aria-describedby={errors.newPassword ? `${ids.password}-error` : undefined}
        />
        {errors.newPassword && (
          <p id={`${ids.password}-error`} className="text-sm text-destructive" role="alert">
            {errors.newPassword}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor={ids.confirm}>Confirmer le mot de passe</Label>
        <PasswordInput
          id={ids.confirm}
          name="confirmPassword"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          aria-invalid={errors.confirmPassword ? true : undefined}
          aria-describedby={errors.confirmPassword ? `${ids.confirm}-error` : undefined}
        />
        {errors.confirmPassword && (
          <p id={`${ids.confirm}-error`} className="text-sm text-destructive" role="alert">
            {errors.confirmPassword}
          </p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        Enregistrer le nouveau mot de passe
      </Button>
    </form>
  );
}
