"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/shared/form-message";
import type { ActionResult } from "@/lib/errors";
import type { ImportPreviewClient } from "@/app/app/calendrier/actions";

const MAX_BYTES = 1_048_576;

/** Client-side read of the .ics (≤ 1 MB) → server preview → confirmation. */
export function ImportWizard({
  professionals,
  onPreview,
  onImport,
}: {
  professionals: Array<{ id: string; displayName: string }>;
  onPreview: (text: string) => Promise<ActionResult<ImportPreviewClient>>;
  onImport: (text: string, professionalId: string | null) => Promise<ActionResult<{ created: number; updated: number; skipped: number }>>;
}) {
  const router = useRouter();
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ImportPreviewClient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pro, setPro] = useState("none");
  const [pending, start] = useTransition();

  async function onFile(file: File | undefined) {
    setError(null);
    setPreview(null);
    if (!file) return;
    if (file.size > MAX_BYTES) return setError("Fichier trop volumineux (max 1 Mo).");
    if (!/\.ics$/i.test(file.name) && file.type !== "text/calendar") return setError("Choisissez un fichier .ics (iCalendar).");
    const content = await file.text();
    setText(content);
    setFileName(file.name);
    start(async () => {
      const res = await onPreview(content);
      if (res.ok) setPreview(res.data);
      else setError(res.error);
    });
  }

  const fmt = (iso: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="ics-file">Fichier .ics (1 Mo max)</Label>
        <input id="ics-file" type="file" accept=".ics,text/calendar" className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground" onChange={(e) => onFile(e.target.files?.[0])} />
        <p className="text-xs text-muted-foreground">Export depuis Google Agenda, Outlook, Apple Calendrier… Les évènements sont dédoublonnés par identifiant (UID) : réimporter un même fichier met à jour au lieu de dupliquer.</p>
      </div>
      <FormMessage error={error} />
      {pending && !preview && <p className="text-sm text-muted-foreground">Analyse de {fileName}…</p>}

      {preview && (
        <div className="space-y-4 rounded-2xl border bg-card p-4">
          <h2 className="font-semibold">Aperçu de {fileName}</h2>
          {preview.errors.map((e) => (
            <FormMessage key={e} error={e} />
          ))}
          <ul className="grid gap-2 text-sm sm:grid-cols-3">
            <li className="rounded-lg bg-success/10 p-3">
              <strong>{preview.toCreate.length}</strong> à créer
            </li>
            <li className="rounded-lg bg-info/10 p-3">
              <strong>{preview.toUpdate.length}</strong> à mettre à jour
            </li>
            <li className="rounded-lg bg-muted p-3">
              <strong>{preview.skipped.length}</strong> ignoré(s)
            </li>
          </ul>
          {preview.toCreate.length > 0 && (
            <ul className="max-h-60 divide-y overflow-y-auto text-sm" aria-label="Évènements à créer">
              {preview.toCreate.slice(0, 50).map((e) => (
                <li key={e.uid} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="truncate font-medium">{e.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {e.allDay ? e.startsAt.slice(0, 10) : fmt(e.startsAt)}
                    {e.rrule ? " · récurrent" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {preview.skipped.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">Détail des éléments ignorés</summary>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {preview.skipped.map((s) => (
                  <li key={s.uid}>
                    {s.uid} : {s.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {(preview.toCreate.length > 0 || preview.toUpdate.length > 0) && (
            <div className="flex flex-wrap items-end gap-3 border-t pt-4">
              {professionals.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="ics-pro">Rattacher à une fiche pro</Label>
                  <select id="ics-pro" value={pro} onChange={(e) => setPro(e.target.value)} className="h-8 rounded-lg border bg-background px-2 text-sm">
                    <option value="none">Agenda personnel</option>
                    {professionals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.displayName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <Button
                disabled={pending || !text}
                aria-busy={pending}
                onClick={() =>
                  start(async () => {
                    const res = await onImport(text!, pro === "none" ? null : pro);
                    if (res.ok) {
                      toast.success(`${res.data.created} créé(s), ${res.data.updated} mis à jour.`);
                      router.push("/app/calendrier?view=agenda");
                    } else setError(res.error);
                  })
                }
              >
                 Importer {preview.toCreate.length + preview.toUpdate.length} évènement(s)
              </Button>
            </div>
          )}
        </div>
      )}
      {!preview && !pending && (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
           Sélectionnez un fichier pour afficher l'aperçu avant import.
        </div>
      )}
    </div>
  );
}
