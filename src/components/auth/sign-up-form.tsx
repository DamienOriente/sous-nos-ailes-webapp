"use client";
import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { signUpAction } from "@/app/(auth)/inscription/actions";
import { PasswordInput } from "@/components/auth/password-input";
import { FormMessage } from "@/components/shared/form-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpSchema } from "@/modules/identity/domain/auth";

type Errors = Partial<Record<"firstName" | "lastName" | "email" | "password" | "acceptTerms", string>>;

export function SignUpForm({ next }: { next: string | null }) {
  const router = useRouter();
  const base = useId();
  const id = (field: string) => `${base}-${field}`;
  const [values, setValues] = useState({ firstName: "", lastName: "", email: "", password: "", acceptTerms: false });
  const [errors, setErrors] = useState<Errors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => setValues((v) => ({ ...v, [key]: value }));

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGlobalError(null);
    const parsed = signUpSchema.safeParse({ ...values, next: next ?? undefined });
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error).fieldErrors;
      setErrors(Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, v?.[0] ?? ""])) as Errors);
      return;
    }
    setErrors({});
    start(async () => {
      const result = await signUpAction(parsed.data);
      if (!result.ok) {
        if (result.fieldErrors) setErrors(Object.fromEntries(Object.entries(result.fieldErrors).map(([k, v]) => [k, v[0] ?? ""])) as Errors);
        setGlobalError(result.error);
        return;
      }
      router.push(result.data.next);
      router.refresh();
    });
  }

  const fieldError = (field: keyof Errors) =>
    errors[field] ? (
      <p id={id(`${field}-error`)} className="text-sm text-destructive" role="alert">
        {errors[field]}
      </p>
    ) : null;
  const a11y = (field: keyof Errors) => ({ "aria-invalid": errors[field] ? true : undefined, "aria-describedby": errors[field] ? id(`${field}-error`) : undefined });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormMessage error={globalError} />
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={id("firstName")}>Prénom</Label>
          <Input id={id("firstName")} name="firstName" autoComplete="given-name" required autoFocus value={values.firstName} onChange={(e) => set("firstName", e.target.value)} {...a11y("firstName")} />
          {fieldError("firstName")}
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("lastName")}>Nom</Label>
          <Input id={id("lastName")} name="lastName" autoComplete="family-name" required value={values.lastName} onChange={(e) => set("lastName", e.target.value)} {...a11y("lastName")} />
          {fieldError("lastName")}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={id("email")}>Adresse e-mail</Label>
        <Input id={id("email")} name="email" type="email" inputMode="email" autoComplete="email" required value={values.email} onChange={(e) => set("email", e.target.value)} {...a11y("email")} />
        {fieldError("email")}
      </div>
      <div className="space-y-2">
        <Label htmlFor={id("password")}>Mot de passe</Label>
        <PasswordInput id={id("password")} name="password" autoComplete="new-password" required showStrength value={values.password} onChange={(e) => set("password", e.target.value)} {...a11y("password")} />
        {fieldError("password")}
      </div>
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <Checkbox id={id("acceptTerms")} checked={values.acceptTerms} onCheckedChange={(v) => set("acceptTerms", v === true)} className="mt-0.5" {...a11y("acceptTerms")} />
          <Label htmlFor={id("acceptTerms")} className="font-normal leading-snug text-pretty">
            J'accepte les{" "}
            <Link href="/cgu" className="font-medium text-primary underline-offset-4 hover:underline" target="_blank" rel="noopener">
              conditions générales d'utilisation
            </Link>{" "}
            et la{" "}
            <Link href="/confidentialite" className="font-medium text-primary underline-offset-4 hover:underline" target="_blank" rel="noopener">
              politique de confidentialité
            </Link>
            .
          </Label>
        </div>
        {fieldError("acceptTerms")}
      </div>
      <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        Créer mon compte
      </Button>
    </form>
  );
}
