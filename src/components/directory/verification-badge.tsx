"use client";
import { ShieldCheck, ShieldQuestion } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { verificationLevelLabel } from "@/modules/professionals/domain/verification";

/**
 * Precise verification label (never "certifié"). The tooltip lists what was
 * actually checked so the badge cannot be read as an official approval.
 */
export function VerificationBadge({ level, statements, className, size = "sm" }: { level: number; statements?: string[]; className?: string; size?: "sm" | "md" }) {
  const label = verificationLevelLabel(level);
  const Icon = level > 0 ? ShieldCheck : ShieldQuestion;
  const tone = level >= 4 ? "bg-success/15 text-sage-deep dark:text-success" : level >= 2 ? "bg-info/15 text-[oklch(0.42_0.1_235)] dark:text-info" : level === 1 ? "bg-muted text-muted-foreground" : "bg-muted text-muted-foreground";
  const details = statements && statements.length ? statements : level === 0 ? ["Aucune vérification effectuée par la plateforme pour le moment."] : [label];
  // Self-contained provider: the badge is rendered in public pages that have no global TooltipProvider.
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
        <span
          className={cn("inline-flex items-center gap-1 rounded-full font-medium", size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm", tone, className)}
          data-testid="verification-badge"
          data-level={level}
          tabIndex={0}
          aria-label={`Niveau de vérification : ${label}`}
        >
          <Icon className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden="true" />
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="mb-1 font-semibold">Ce qui a été vérifié</p>
        <ul className="list-disc space-y-0.5 pl-4 text-xs">
          {details.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] opacity-80">Ces contrôles sont réalisés sur pièces par notre équipe. Ils ne constituent ni une certification ni une garantie de la prestation.</p>
      </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
