"use client";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { ActionResult } from "@/lib/errors";
import type { ToolCard as ToolCardData } from "@/modules/tools/application/tool-service";
import { toolExample } from "@/modules/tools/domain/tool-examples";

/** Plain card: name, what the tool does, one worked example, and the switch. No header art. */
export function ToolCard({ tool, professionalId, onToggle }: { tool: ToolCardData; professionalId: string; onToggle: (professionalId: string, toolKey: string, enabled: boolean) => Promise<ActionResult<undefined>> }) {
  const [enabled, setEnabled] = useOptimistic(tool.enabled);
  const [pending, start] = useTransition();
  const id = `tool-${tool.key}`;
  const example = toolExample(tool.key);
  return (
    <Card className="gap-3 p-4" data-testid="tool-card" data-tool={tool.key} data-locked={!tool.entitled}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="font-medium" id={`${id}-label`}>
            {tool.name}
          </p>
          <p className="text-sm text-muted-foreground text-pretty">{tool.description}</p>
          {tool.isDefault && tool.entitled && <p className="text-xs text-muted-foreground">Recommandé pour votre métier</p>}
          {!tool.entitled && <p className="text-xs font-medium text-muted-foreground">Offre Premium</p>}
        </div>
        {tool.entitled && (
          <Switch
            id={id}
            checked={enabled}
            disabled={pending}
            aria-labelledby={`${id}-label`}
            onCheckedChange={(v) =>
              start(async () => {
                setEnabled(v);
                const r = await onToggle(professionalId, tool.key, v);
                if (!r.ok) toast.error(r.error);
              })
            }
          />
        )}
      </div>
      {example && (
        <div className="rounded-lg bg-muted/50 p-3 text-xs">
          <p className="text-muted-foreground text-pretty">
            <span className="font-medium text-foreground">Exemple : </span>
            {example.example}
          </p>
          <p className="mt-1.5 text-foreground/80 text-pretty">{example.outcome}</p>
        </div>
      )}
      <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
        <span>{tool.usageCount > 0 ? `Utilisé ${tool.usageCount} fois` : "Jamais utilisé"}</span>
        {tool.entitled && enabled ? (
          <Link href={tool.href} className="font-medium text-primary hover:underline">
            Ouvrir
          </Link>
        ) : !tool.entitled ? (
          <Link href={`/app/pro/${professionalId}/abonnement?feature=${tool.requiredFeature ?? "tools.premium"}`} className="font-medium text-primary hover:underline">
            Voir l'offre Premium
          </Link>
        ) : null}
      </div>
    </Card>
  );
}
