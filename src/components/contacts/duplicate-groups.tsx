"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/errors";

export type DuplicateItem = { id: string; firstName: string; lastName: string; company: string | null; email: string | null; phone: string | null; tags: string[]; eventCount: number; createdAt: Date };

/** Assisted merge: pick the record to keep; the others are folded into it. */
export function DuplicateGroups({ groups, onMerge }: { groups: Array<{ key: string; items: DuplicateItem[] }>; onMerge: (primaryId: string, otherIds: string[]) => Promise<ActionResult<{ id: string }>> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [choice, setChoice] = useState<Record<string, string>>({});
  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const primary = choice[g.key] ?? g.items[0]!.id;
        return (
          <Card key={g.key} className="gap-4 p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">
                {g.items.length} fiches partagent {g.key.startsWith("email:") ? "l'e-mail" : "le téléphone"} <span className="font-mono text-xs">{g.key.split(":").slice(1).join(":")}</span>
              </p>
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await onMerge(primary, g.items.filter((i) => i.id !== primary).map((i) => i.id));
                    if (res.ok) {
                      toast.success("Contacts fusionnés.");
                      router.refresh();
                    } else toast.error(res.error);
                  })
                }
              >
                 Fusionner
              </Button>
            </div>
            <RadioGroup value={primary} onValueChange={(v) => setChoice((c) => ({ ...c, [g.key]: v }))} className="grid gap-2 sm:grid-cols-2">
              {g.items.map((it) => (
                <Label key={it.id} htmlFor={`dup-${it.id}`} className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                  <RadioGroupItem id={`dup-${it.id}`} value={it.id} className="mt-0.5" />
                  <span className="min-w-0 space-y-0.5">
                    <span className="block font-medium">{`${it.firstName} ${it.lastName}`.trim() || it.company || "Sans nom"}</span>
                    {it.company && <span className="block text-muted-foreground">{it.company}</span>}
                    <span className="block text-xs text-muted-foreground">
                      {[it.email, it.phone].filter(Boolean).join(" · ")}
                      {it.tags.length > 0 && ` · ${it.tags.join(", ")}`}
                      {` · ${it.eventCount} évènement(s)`}
                    </span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
            <p className="text-xs text-muted-foreground">La fiche sélectionnée est conservée ; ses champs vides sont complétés depuis les autres, les tags et les liens aux évènements sont fusionnés.</p>
          </Card>
        );
      })}
    </div>
  );
}
