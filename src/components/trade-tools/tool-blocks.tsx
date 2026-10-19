import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { ActionResult } from "@/lib/errors";

/** Section card with title, optional action slot and content. */
export function ToolSection({ title, description, action, children, id }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <Card className="gap-4 p-6" id={id}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

/** Icon-only delete with confirmation. */
export function DeleteItemButton({ label, onConfirm, description }: { label: string; onConfirm: () => Promise<ActionResult<unknown>>; description?: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="icon-xs" aria-label={`Supprimer ${label}`}>
          <Trash2 className="size-3.5" aria-hidden="true" />
        </Button>
      }
      title="Supprimer ?"
      description={description ?? label}
      onConfirm={onConfirm}
    />
  );
}

export function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm">{value || <span className="text-muted-foreground">Non renseigné</span>}</dd>
    </div>
  );
}
