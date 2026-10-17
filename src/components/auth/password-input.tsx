"use client";
import { useId, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { passwordStrength } from "@/modules/identity/domain/auth";
import { cn } from "@/lib/utils";

type Props = Omit<React.ComponentProps<"input">, "type"> & {
  /** Shows the live strength meter (sign-up, password change). */
  showStrength?: boolean;
};

/** Password field with a visibility toggle and an optional strength indicator (announced to screen readers). */
export function PasswordInput({ showStrength = false, className, value, "aria-describedby": describedBy, ...props }: Props) {
  const [visible, setVisible] = useState(false);
  const meterId = useId();
  const strength = useMemo(() => (showStrength && typeof value === "string" ? passwordStrength(value) : null), [showStrength, value]);
  const describes = [describedBy, strength ? meterId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input {...props} value={value} type={visible ? "text" : "password"} className={cn("pr-10", className)} aria-describedby={describes} />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          aria-pressed={visible}
          tabIndex={-1}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </Button>
      </div>
      {strength && typeof value === "string" && value.length > 0 && (
        <div id={meterId} className="space-y-1" aria-live="polite">
          <div className="flex gap-1" aria-hidden="true">
            {[1, 2, 3, 4].map((step) => (
              <span
                key={step}
                className={cn(
                  "h-1.5 flex-1 rounded-full bg-muted transition-colors",
                  strength.score >= step && (strength.score <= 1 ? "bg-destructive" : strength.score === 2 ? "bg-warning" : "bg-success"),
                )}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Robustesse : {strength.label}.</span> {strength.hints[0]}
          </p>
        </div>
      )}
    </div>
  );
}
