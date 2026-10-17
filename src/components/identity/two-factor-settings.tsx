"use client";
import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Check, Copy, Download, Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { recordTwoFactorChangeAction } from "@/app/app/compte/securite/actions";
import { describeAuthFailure } from "@/components/auth/auth-client-error";
import { PasswordInput } from "@/components/auth/password-input";
import { FormMessage } from "@/components/shared/form-message";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { totpCodeSchema } from "@/modules/identity/domain/auth";

type Step = { kind: "idle" } | { kind: "password"; intent: "enable" | "disable" | "backup" } | { kind: "scan"; totpURI: string; backupCodes: string[] } | { kind: "codes"; backupCodes: string[]; intent: "enable" | "backup" };

function secretFromUri(uri: string): string | null {
  try {
    return new URL(uri).searchParams.get("secret");
  } catch {
    return null;
  }
}

export function TwoFactorSettings({ enabled, required }: { enabled: boolean; required: boolean }) {
  const router = useRouter();
  const ids = { password: useId(), code: useId() };
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [, startRecord] = useTransition();

  function reset() {
    setStep({ kind: "idle" });
    setPassword("");
    setCode("");
    setError(null);
  }

  function journal(kind: "enabled" | "disabled" | "backup_codes") {
    startRecord(async () => {
      await recordTwoFactorChangeAction(kind);
      router.refresh();
    });
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (step.kind !== "password") return;
    if (!password) {
      setError("Saisissez votre mot de passe pour confirmer.");
      return;
    }
    setError(null);
    setPending(true);
    let response: Response | null = null;
    const fetchOptions = { onError: (ctx: { response: Response }) => { response = ctx.response; } };
    if (step.intent === "enable") {
      const { data, error: err } = await authClient.twoFactor.enable({ password }, fetchOptions);
      setPending(false);
      if (err || !data || data.method !== "totp") {
        setError(err ? describeAuthFailure(err, response).message : "Réponse inattendue du serveur.");
        return;
      }
      setPassword("");
      setStep({ kind: "scan", totpURI: data.totpURI, backupCodes: data.backupCodes });
      return;
    }
    if (step.intent === "disable") {
      const { error: err } = await authClient.twoFactor.disable({ password }, fetchOptions);
      setPending(false);
      if (err) {
        setError(describeAuthFailure(err, response).message);
        return;
      }
      toast.success("Double authentification désactivée.");
      reset();
      journal("disabled");
      return;
    }
    const { data, error: err } = await authClient.twoFactor.generateBackupCodes({ password }, fetchOptions);
    setPending(false);
    if (err || !data) {
      setError(describeAuthFailure(err, response).message);
      return;
    }
    setPassword("");
    setStep({ kind: "codes", backupCodes: data.backupCodes, intent: "backup" });
    journal("backup_codes");
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (step.kind !== "scan") return;
    const parsed = totpCodeSchema.safeParse(code);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Code invalide.");
      return;
    }
    setError(null);
    setPending(true);
    let response: Response | null = null;
    const { error: err } = await authClient.twoFactor.verifyTotp({ code: parsed.data }, { onError: (ctx) => { response = ctx.response; } });
    setPending(false);
    if (err) {
      setError(describeAuthFailure(err, response).message);
      setCode("");
      return;
    }
    toast.success("Double authentification activée.");
    setStep({ kind: "codes", backupCodes: step.backupCodes, intent: "enable" });
    journal("enabled");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        {enabled ? (
          <StatusBadge tone="success">
            <ShieldCheck className="size-3.5" aria-hidden="true" /> Activée
          </StatusBadge>
        ) : (
          <StatusBadge tone={required ? "danger" : "neutral"}>
            <ShieldOff className="size-3.5" aria-hidden="true" /> Désactivée
          </StatusBadge>
        )}
        <p className="text-sm text-muted-foreground">Code temporaire généré par une application (TOTP) demandé à chaque nouvelle connexion.</p>
      </div>

      {step.kind === "idle" && (
        <div className="flex flex-wrap gap-2">
          {enabled ? (
            <>
              <Button variant="outline" onClick={() => setStep({ kind: "password", intent: "backup" })}>
                Régénérer les codes de secours
              </Button>
              <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setStep({ kind: "password", intent: "disable" })}>
                Désactiver
              </Button>
            </>
          ) : (
            <Button onClick={() => setStep({ kind: "password", intent: "enable" })}>
              <ShieldCheck aria-hidden="true" /> Activer la double authentification
            </Button>
          )}
        </div>
      )}

      {step.kind === "password" && (
        <form onSubmit={submitPassword} noValidate className="space-y-4 rounded-xl border bg-card p-4">
          <p className="text-sm">
            {step.intent === "enable" && "Confirmez votre mot de passe pour commencer l'activation."}
            {step.intent === "disable" && "Confirmez votre mot de passe pour désactiver la double authentification. Votre compte sera moins protégé."}
            {step.intent === "backup" && "Confirmez votre mot de passe. Les anciens codes de secours seront invalidés."}
          </p>
          <FormMessage error={error} />
          <div className="space-y-2">
            <Label htmlFor={ids.password}>Mot de passe</Label>
            <PasswordInput id={ids.password} autoComplete="current-password" autoFocus required value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={error ? true : undefined} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant={step.intent === "disable" ? "destructive" : "default"} disabled={pending} aria-busy={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Continuer
            </Button>
            <Button type="button" variant="ghost" onClick={reset} disabled={pending}>
              Annuler
            </Button>
          </div>
        </form>
      )}

      {step.kind === "scan" && (
        <form onSubmit={submitCode} noValidate className="space-y-4 rounded-xl border bg-card p-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Ouvrez votre application d'authentification (Google Authenticator, Microsoft Authenticator, 1Password, Aegis…).</li>
            <li>Scannez ce QR code ou saisissez la clé manuellement.</li>
            <li>Entrez le code à 6 chiffres affiché pour confirmer.</li>
          </ol>
          <QrCode uri={step.totpURI} />
          <ManualKey secret={secretFromUri(step.totpURI)} />
          <FormMessage error={error} />
          <div className="space-y-2">
            <Label htmlFor={ids.code}>Code de vérification</Label>
            <Input id={ids.code} autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoFocus required value={code} onChange={(e) => setCode(e.target.value)} className="max-w-48 text-center text-lg tracking-[0.3em] tabular-nums" aria-invalid={error ? true : undefined} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending} aria-busy={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Confirmer l'activation
            </Button>
            <Button type="button" variant="ghost" onClick={reset} disabled={pending}>
              Annuler
            </Button>
          </div>
        </form>
      )}

      {step.kind === "codes" && <BackupCodes codes={step.backupCodes} onDone={reset} fresh={step.intent === "enable"} />}
    </div>
  );
}

function QrCode({ uri }: { uri: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(uri, { width: 200, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [uri]);
  return (
    <div className="flex justify-center">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL generated locally
        <img src={src} alt="QR code à scanner avec votre application d'authentification" width={200} height={200} className="rounded-lg border bg-white p-2" />
      ) : (
        <div className="size-[200px] animate-pulse rounded-lg bg-muted" aria-hidden="true" />
      )}
    </div>
  );
}

function ManualKey({ secret }: { secret: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!secret) return null;
  const grouped = secret.match(/.{1,4}/g)?.join(" ") ?? secret;
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">Clé à saisir manuellement :</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded-md bg-muted px-3 py-2 font-mono text-sm tracking-wider break-all">{grouped}</code>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Copier la clé"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(secret);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              toast.error("Copie impossible, sélectionnez la clé manuellement.");
            }
          }}
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </Button>
      </div>
    </div>
  );
}

function BackupCodes({ codes, onDone, fresh }: { codes: string[]; onDone: () => void; fresh: boolean }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const text = codes.join("\n");
  return (
    <div className="space-y-4 rounded-xl border border-warning/50 bg-warning/10 p-4">
      <div>
        <h3 className="font-heading text-base font-semibold">{fresh ? "Double authentification activée — vos codes de secours" : "Nouveaux codes de secours"}</h3>
        <p className="text-sm text-muted-foreground text-pretty">
          Conservez ces codes dans un endroit sûr (gestionnaire de mots de passe). Chaque code ne sert qu'une fois et vous permet de vous connecter si vous perdez votre téléphone. <strong>Ils ne seront plus affichés.</strong>
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-3" aria-label="Codes de secours">
        {codes.map((c) => (
          <li key={c} className="rounded-md bg-background px-3 py-1.5 text-center tracking-wider">
            {c}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              toast.success("Codes copiés.");
            } catch {
              toast.error("Copie impossible.");
            }
          }}
        >
          <Copy aria-hidden="true" /> Copier
        </Button>
        <Button type="button" variant="outline" size="sm" asChild>
          <a href={`data:text/plain;charset=utf-8,${encodeURIComponent(`Sous Nos Ailes — codes de secours\n\n${text}\n`)}`} download="sous-nos-ailes-codes-de-secours.txt">
            <Download aria-hidden="true" /> Télécharger
          </a>
        </Button>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1 size-4 accent-primary" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
        <span>J'ai enregistré mes codes de secours en lieu sûr.</span>
      </label>
      <Button type="button" onClick={onDone} disabled={!acknowledged}>
        Terminer
      </Button>
    </div>
  );
}
