"use client";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { NAV_ICONS } from "@/components/layout/nav-icons";
import type { ActionResult } from "@/lib/errors";
import type { ToolCard as ToolCardData } from "@/modules/tools/application/tool-service";

export function ToolCard({ tool, professionalId, onToggle }: { tool: ToolCardData; professionalId: string; onToggle: (professionalId: string, toolKey: string, enabled: boolean) => Promise<ActionResult<undefined>> }) {
  const [enabled, setEnabled] = useOptimistic(tool.enabled);
  const [pending, start] = useTransition();
  const Icon = NAV_ICONS[tool.icon] ?? NAV_ICONS.tools;
  const id = `tool-${tool.key}`;
  return (
    <Card className="gap-3 p-4" data-testid="tool-card" data-tool={tool.key} data-locked={!tool.entitled}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">{Icon && <Icon className="size-4" aria-hidden="true" />}</span>
          <div>
            <p className="font-medium" id={`${id}-label`}>
              {tool.name}
              {tool.isDefault && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Recommandé pour votre métier</span>}
            </p>
            <p className="text-sm text-muted-foreground">{tool.description}</p>
          </div>
        </div>
        {tool.entitled ? (
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
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
            <Lock className="size-3" aria-hidden="true" />
            Premium
          </span>
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{tool.usageCount > 0 ? `Utilisé ${tool.usageCount} fois` : "Jamais utilisé"}</span>
        {tool.entitled && enabled ? (
          <Link href={tool.href} className="font-medium text-primary hover:underline">
            Ouvrir
          </Link>
        ) : !tool.entitled ? (
          <Link href={`/app/pro/${professionalId}/abonnement`} className="font-medium text-primary hover:underline">
            Découvrir Premium
          </Link>
        ) : null}
      </div>
    </Card>
  );
}
