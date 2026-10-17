"use client";
import { useState, useTransition } from "react";
import { ActionForm, ActionSubmit, type FormAction } from "@/components/admin/action-form";
import { EditorialContent } from "@/components/admin/editorial-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/errors";
import type { BlockNode } from "@/modules/legal/domain/markdown";

export type PreviewAction = (body: string) => Promise<ActionResult<{ blocks: BlockNode[]; missing: string[] }>>;

/**
 * Restricted-Markdown editor with server-side preview (same parser as the
 * public rendering, variables resolved with the current legal settings).
 */
export function EditorialEditor({ save, preview, initial, isNew }: { save: FormAction; preview: PreviewAction; initial: { slug: string; title: string; body: string; isPublished: "draft" | "published" }; isNew: boolean }) {
  const [body, setBody] = useState(initial.body);
  const [blocks, setBlocks] = useState<BlockNode[] | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const refresh = () =>
    start(async () => {
      const res = await preview(body);
      if (res.ok) {
        setBlocks(res.data.blocks);
        setMissing(res.data.missing);
        setError(null);
      } else setError(res.error);
    });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ActionForm action={save} successMessage="Page enregistrée." className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="slug">Slug (URL publique)</Label>
            <Input id="slug" name="slug" defaultValue={initial.slug} readOnly={!isNew} required pattern="[a-z0-9]+(-[a-z0-9]+)*" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="title">Titre</Label>
            <Input id="title" name="title" defaultValue={initial.title} required minLength={3} />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="body">Contenu (syntaxe restreinte : ## titre, ### sous-titre, - liste, 1. liste numérotée, **gras**, _italique_, [lien](https://…), &gt; encadré, variables {"{{legal.company_name}}"})</Label>
          <Textarea id="body" name="body" value={body} onChange={(e) => setBody(e.target.value)} rows={28} className="font-mono text-xs" spellCheck={false} />
        </div>
        <fieldset className="flex flex-wrap gap-4 text-sm">
          <legend className="sr-only">Statut de publication</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="isPublished" value="draft" defaultChecked={initial.isPublished === "draft"} /> Brouillon (non visible)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="isPublished" value="published" defaultChecked={initial.isPublished === "published"} /> Publié
          </label>
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <ActionSubmit pendingLabel="Enregistrement…">Enregistrer</ActionSubmit>
          <Button type="button" variant="outline" onClick={refresh} disabled={pending}>
            {pending ? "Aperçu…" : "Rafraîchir l'aperçu"}
          </Button>
        </div>
      </ActionForm>
      <aside className="space-y-3 rounded-xl border bg-card p-6" aria-label="Aperçu">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Aperçu public</h2>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {missing.length > 0 && <p className="rounded-lg bg-warning/15 px-3 py-2 text-xs">Variables non renseignées : {missing.join(", ")} — à compléter dans Paramètres.</p>}
        {blocks ? <EditorialContent blocks={blocks} /> : <p className="text-sm text-muted-foreground">Cliquez sur « Rafraîchir l'aperçu » pour afficher le rendu.</p>}
      </aside>
    </div>
  );
}
