"use client";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { Lock, Quote } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { NAV_ICONS } from "@/components/layout/nav-icons";
import type { ActionResult } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { ToolCard as ToolCardData } from "@/modules/tools/application/tool-service";
import { toolExample, type ToolScene } from "@/modules/tools/domain/tool-examples";

/** Colour family of the card header per tool scene (brand tokens only). */
const SCENE_TONES: Record<ToolScene, string> = {
  calendar: "from-sky/70 to-sky/20",
  contacts: "from-sand to-sand/30",
  inbox: "from-sage-soft to-sage-soft/30",
  gallery: "from-blush/70 to-blush/20",
  documents: "from-sand-deep/50 to-sand/30",
  dashboard: "from-sage-soft to-sky/30",
  budget: "from-gold/50 to-sand/30",
  timeline: "from-sky/60 to-sand/30",
  scale: "from-sand to-sage-soft/50",
  guests: "from-blush/60 to-sky/30",
  seating: "from-sage-soft to-blush/40",
  invitations: "from-blush/70 to-gold/30",
  children: "from-blush/70 to-sky/40",
  attendance: "from-sky/60 to-sage-soft/50",
  handover: "from-sage-soft to-blush/50",
  activities: "from-gold/50 to-blush/40",
  catering: "from-gold/60 to-sand/40",
  menus: "from-sand-deep/50 to-gold/30",
  venue: "from-sand-deep/50 to-sage-soft/50",
  spaces: "from-sage-soft to-sand/40",
  logistics: "from-sky/50 to-sand/40",
  music: "from-sky-deep/40 to-blush/40",
  equipment: "from-sand-deep/40 to-sky/30",
  camera: "from-sky/60 to-sand-deep/30",
  stats: "from-sage-soft to-gold/30",
  seo: "from-sky/60 to-sage-soft/50",
};

/** Small scene drawn in the card header: a stylised version of what the tool shows. */
function ToolGlyph({ scene }: { scene: ToolScene }) {
  const common = "absolute inset-0 h-full w-full";
  switch (scene) {
    case "calendar":
      return (
        <svg viewBox="0 0 120 60" className={common} aria-hidden="true">
          {Array.from({ length: 14 }).map((_, i) => (
            <rect key={i} x={20 + (i % 7) * 12} y={16 + Math.floor(i / 7) * 14} width="9" height="9" rx="2" fill={i === 9 ? "var(--sna-blush-deep)" : "var(--card)"} opacity={i === 9 ? 1 : 0.85} />
          ))}
        </svg>
      );
    case "seating":
      return (
        <svg viewBox="0 0 120 60" className={common} aria-hidden="true">
          {[{ x: 30, y: 30 }, { x: 60, y: 22 }, { x: 90, y: 34 }].map(({ x, y }) => (
            <g key={x}>
              <circle cx={x} cy={y} r="9" fill="var(--card)" />
              {[0, 60, 120, 180, 240, 300].map((a) => (
                <circle key={a} cx={x + 13 * Math.cos((a * Math.PI) / 180)} cy={y + 13 * Math.sin((a * Math.PI) / 180)} r="2" fill="var(--sna-sage-deep)" />
              ))}
            </g>
          ))}
        </svg>
      );
    case "stats":
    case "dashboard":
    case "budget":
      return (
        <svg viewBox="0 0 120 60" className={common} aria-hidden="true">
          {[18, 30, 24, 40, 34, 46].map((h, i) => (
            <rect key={i} x={22 + i * 14} y={52 - h} width="9" height={h} rx="2" fill={i === 5 ? "var(--sna-sage-deep)" : "var(--card)"} />
          ))}
        </svg>
      );
    case "invitations":
      return (
        <svg viewBox="0 0 120 60" className={common} aria-hidden="true">
          <rect x="30" y="14" width="60" height="36" rx="4" fill="var(--card)" />
          <path d="M30 18l30 20 30-20" fill="none" stroke="var(--sna-blush-deep)" strokeWidth="2" />
          <rect x="74" y="34" width="12" height="12" fill="var(--sna-charcoal)" opacity="0.8" />
        </svg>
      );
    case "children":
    case "attendance":
    case "handover":
    case "activities":
      return (
        <svg viewBox="0 0 120 60" className={common} aria-hidden="true">
          {[[36, "var(--sna-blush-deep)"], [60, "var(--sna-sky-deep)"], [84, "var(--sna-gold)"]].map(([x, c]) => (
            <g key={String(x)}>
              <circle cx={Number(x)} cy="26" r="7" fill={String(c)} />
              <rect x={Number(x) - 8} y="34" width="16" height="16" rx="6" fill="var(--card)" />
            </g>
          ))}
        </svg>
      );
    case "music":
      return (
        <svg viewBox="0 0 120 60" className={common} aria-hidden="true">
          <circle cx="60" cy="30" r="18" fill="var(--sna-charcoal)" opacity="0.85" />
          <circle cx="60" cy="30" r="6" fill="var(--sna-blush-deep)" />
          <path d="M92 18v18a5 5 0 1 1-3-4V14l12-3v16a5 5 0 1 1-3-4V15z" fill="var(--card)" />
        </svg>
      );
    case "camera":
    case "gallery":
      return (
        <svg viewBox="0 0 120 60" className={common} aria-hidden="true">
          <rect x="28" y="16" width="64" height="34" rx="5" fill="var(--card)" />
          <circle cx="60" cy="33" r="10" fill="var(--sna-sky-deep)" />
          <circle cx="60" cy="33" r="4" fill="var(--sna-charcoal)" />
        </svg>
      );
    case "catering":
    case "menus":
      return (
        <svg viewBox="0 0 120 60" className={common} aria-hidden="true">
          <ellipse cx="60" cy="34" rx="26" ry="12" fill="var(--card)" />
          <ellipse cx="60" cy="34" rx="14" ry="6" fill="var(--sna-gold)" />
          <path d="M26 20v24M94 20v24" stroke="var(--card)" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "venue":
    case "spaces":
    case "logistics":
      return (
        <svg viewBox="0 0 120 60" className={common} aria-hidden="true">
          <rect x="30" y="26" width="60" height="26" rx="3" fill="var(--card)" />
          <path d="M26 28l34-16 34 16z" fill="var(--sna-sage-deep)" opacity="0.8" />
          <rect x="54" y="38" width="12" height="14" rx="2" fill="var(--sna-sand-deep)" />
        </svg>
      );
    case "seo":
      return (
        <svg viewBox="0 0 120 60" className={common} aria-hidden="true">
          <rect x="24" y="16" width="56" height="8" rx="4" fill="var(--sna-sky-deep)" opacity="0.8" />
          <rect x="24" y="30" width="72" height="5" rx="2.5" fill="var(--card)" />
          <rect x="24" y="40" width="48" height="5" rx="2.5" fill="var(--card)" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 120 60" className={common} aria-hidden="true">
          <rect x="30" y="14" width="60" height="10" rx="3" fill="var(--card)" />
          <rect x="30" y="28" width="44" height="8" rx="3" fill="var(--card)" opacity="0.8" />
          <rect x="30" y="40" width="52" height="8" rx="3" fill="var(--card)" opacity="0.6" />
        </svg>
      );
  }
}

export function ToolCard({ tool, professionalId, onToggle }: { tool: ToolCardData; professionalId: string; onToggle: (professionalId: string, toolKey: string, enabled: boolean) => Promise<ActionResult<undefined>> }) {
  const [enabled, setEnabled] = useOptimistic(tool.enabled);
  const [pending, start] = useTransition();
  const Icon = NAV_ICONS[tool.icon] ?? NAV_ICONS.tools;
  const id = `tool-${tool.key}`;
  const example = toolExample(tool.key);
  const scene: ToolScene = example?.scene ?? "documents";
  return (
    <Card className="gap-0 overflow-hidden p-0" data-testid="tool-card" data-tool={tool.key} data-locked={!tool.entitled}>
      <div className={cn("relative h-20 bg-gradient-to-br", SCENE_TONES[scene], !tool.entitled && "saturate-50")}>
        <ToolGlyph scene={scene} />
        <span className="absolute left-3 top-3 flex size-9 items-center justify-center rounded-lg bg-card/90 text-primary shadow-soft">{Icon && <Icon className="size-4" aria-hidden="true" />}</span>
        {!tool.entitled && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-card/90 px-2 py-1 text-xs font-medium text-muted-foreground">
            <Lock className="size-3" aria-hidden="true" />
            Premium
          </span>
        )}
        {tool.isDefault && tool.entitled && <span className="absolute right-3 top-3 rounded-full bg-card/90 px-2 py-1 text-[11px] font-medium text-primary">Recommandé pour votre métier</span>}
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium" id={`${id}-label`}>
              {tool.name}
            </p>
            <p className="text-sm text-muted-foreground">{tool.description}</p>
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
            <p className="flex gap-1.5 text-muted-foreground">
              <Quote className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              <span>
                <span className="font-medium text-foreground">Exemple : </span>
                {example.example}
              </span>
            </p>
            <p className="mt-1.5 pl-[18px] text-foreground/80">{example.outcome}</p>
          </div>
        )}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{tool.usageCount > 0 ? `Utilisé ${tool.usageCount} fois` : "Jamais utilisé"}</span>
          {tool.entitled && enabled ? (
            <Link href={tool.href} className="font-medium text-primary hover:underline">
              Ouvrir
            </Link>
          ) : !tool.entitled ? (
            <Link href={`/app/pro/${professionalId}/abonnement?feature=${tool.requiredFeature ?? "tools.premium"}`} className="font-medium text-primary hover:underline">
              Découvrir Premium
            </Link>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
