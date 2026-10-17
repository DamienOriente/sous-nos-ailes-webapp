"use client";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { changePasswordAction } from "@/app/app/compte/securite/actions";
import { PasswordInput } from "@/components/auth/password-input";
import { FormMessage } from "@/components/shared/form-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { changePasswordSchema } from "@/modules/identity/domain/auth";

type Errors = Partial<Record<"currentPassword" | "newPassword" | "confirmPassword", string>>;

export function ChangePasswordForm() {
  const router = useRouter();
  const base = useId();
  const id = (f: string) => `${base}-${f}`;
  const [values, setValues] = useState({ currentPassword: "", newPassword: "", confirmPassword: "", revokeOtherSessions: true });
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof typeof values>(k: K, v: (typeof values)[K]) => setValues((s) => ({ ...s, [k]: v }));

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsed = changePasswordSchema.safeParse(values);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error).fieldErrors;
      setErrors({ currentPassword: flat.currentPassword?.[0], newPassword: flat.newPassword?.[0], confirmPassword: flat.confirmPassword?.[0] });
      return;
    }
    setErrors({});
    start(async () => {
      const result = await changePasswordAction(parsed.data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(result.data.revokedOthers ? "Mot de passe modifié. Vos autres appareils ont été déconnectés." : "Mot de passe modifié.");
      setValues({ currentPassword: "", newPassword: "", confirmPassword: "", revokeOtherSessions: true });
      router.refresh();
    });
  }

  const field = (name: keyof Errors, label: string, autoComplete: string, showStrength = false) => (
    <div className="space-y-2">
      <Label htmlFor={id(name)}>{label}</Label>
      <PasswordInput
        id={id(name)}
        name={name}
        autoComplete={autoComplete}
        required
        showStrength={showStrength}
        value={values[name]}
        onChange={(e) => set(name, e.target.value)}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? id(`${name}-error`) : undefined}
      />
      {errors[name] && (
        <p id={id(`${name}-error`)} className="text-sm text-destructive" role="alert">
          {errors[name]}
        </p>
      )}
    </div>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormMessage error={error} />
      {field("currentPassword", "Mot de passe actuel", "current-password")}
      {field("newPassword", "Nouveau mot de passe", "new-password", true)}
      {field("confirmPassword", "Confirmer le nouveau mot de passe", "new-password")}
      <div className="flex items-start gap-2">
        <Checkbox id={id("revoke")} checked={values.revokeOtherSessions} onCheckedChange={(v) => set("revokeOtherSessions", v === true)} className="mt-0.5" />
        <Label htmlFor={id("revoke")} className="font-normal leading-snug">
          Déconnecter tous mes autres appareils (recommandé)
        </Label>
      </div>
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        Changer le mot de passe
      </Button>
    </form>
  );
}
