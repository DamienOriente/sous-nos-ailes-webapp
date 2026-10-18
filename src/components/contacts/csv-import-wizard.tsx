"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormMessage } from "@/components/shared/form-message";
import type { ActionResult } from "@/lib/errors";
import { parseCsv } from "@/modules/contacts/domain/csv";
import { findDuplicateGroups, rowsToContactDrafts, type ContactDraft } from "@/modules/contacts/domain/contact-import";
import { rowsToGuestDrafts, type GuestDraft } from "@/modules/guests/domain/guests";

const MAX_ROWS = 2000;

type Props =
  | {
      kind: "contacts";
      scopes: Array<{ value: string; label: string }>;
      onImport: (input: { drafts: ContactDraft[]; scope: string; skipDuplicates: boolean }) => Promise<ActionResult<{ created: number; skippedDuplicates: number; limitReached: boolean; limit: number | null }>>;
      doneHref: string;
    }
  | {
      kind: "guests";
      onImport: (input: { drafts: GuestDraft[] }) => Promise<ActionResult<{ created: number; groupsCreated: number }>>;
      doneHref: string;
    };

type Preview = { headers: string[]; unmapped: string[]; errors: Array<{ line: number; message: string }>; truncated: boolean; totalRows: number; contacts?: Array<ContactDraft & { line: number }>; guests?: GuestDraft[] };

/**
 * Client-side parsing (the parser is pure TypeScript) → preview → server action
 * with validated drafts. The file never leaves the browser as a blob; only the
 * mapped rows are sent, capped at 2000.
 */
export function CsvImportWizard(props: Props) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [scope, setScope] = useState(props.kind === "contacts" ? props.scopes[0]?.value ?? "personal" : "personal");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function onFile(file: File | null) {
    setError(null);
    setPreview(null);
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Fichier trop volumineux (5 Mo maximum).");
      return;
    }
    setFileName(file.name);
    const text = await file.text();
    const parsed = parseCsv(text, { maxRows: MAX_ROWS });
    if (parsed.headers.length === 0) {
      setError("Impossible de lire les en-têtes du fichier.");
      return;
    }
    if (props.kind === "contacts") {
      const r = rowsToContactDrafts(parsed.headers, parsed.rows);
      setPreview({ headers: parsed.headers, unmapped: r.unmappedHeaders, errors: r.errors, truncated: parsed.truncated, totalRows: parsed.totalRows, contacts: r.drafts });
    } else {
      const r = rowsToGuestDrafts(parsed.headers, parsed.rows);
      setPreview({ headers: parsed.headers, unmapped: r.unmappedHeaders, errors: r.errors, truncated: parsed.truncated, totalRows: parsed.totalRows, guests: r.drafts });
    }
  }

  const inFileDuplicates = useMemo(() => (preview?.contacts ? findDuplicateGroups(preview.contacts).length : 0), [preview]);
  const count = preview?.contacts?.length ?? preview?.guests?.length ?? 0;

  function submit() {
    if (!preview) return;
    start(async () => {
      const res =
        props.kind === "contacts"
          ? await props.onImport({ drafts: preview.contacts ?? [], scope, skipDuplicates })
          : await props.onImport({ drafts: preview.guests ?? [] });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if ("skippedDuplicates" in res.data) {
        const d = res.data;
        toast.success(`${d.created} contact(s) importé(s)${d.skippedDuplicates ? `, ${d.skippedDuplicates} doublon(s) ignoré(s)` : ""}.`);
        if (d.limitReached) toast.warning(`Limite de votre offre atteinte (${d.limit} contacts) : les lignes restantes n'ont pas été importées.`);
      } else {
        toast.success(`${res.data.created} invité(s) importé(s)${res.data.groupsCreated ? `, ${res.data.groupsCreated} groupe(s) créé(s)` : ""}.`);
      }
      router.push(props.doneHref);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-dashed bg-card/60 p-6">
        <Label htmlFor="csv-file" className="flex cursor-pointer flex-col items-center gap-2 text-center">
          <span className="font-medium">{fileName || "Choisir un fichier CSV"}</span>
          <span className="text-xs text-muted-foreground">Séparateur « ; » ou « , », en-têtes en français ou en anglais, {MAX_ROWS} lignes maximum.</span>
        </Label>
        <input id="csv-file" type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} />
      </div>
      <FormMessage error={error} />
      {preview && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium">{count} ligne(s) prête(s) à importer</span>
            {preview.errors.length > 0 && <span className="text-warning-foreground">{preview.errors.length} avertissement(s)</span>}
            {inFileDuplicates > 0 && <span className="text-warning-foreground">{inFileDuplicates} doublon(s) dans le fichier</span>}
            {preview.truncated && (
              <span className="flex items-center gap-1 text-destructive">
                 {preview.totalRows} lignes détectées : seules les {MAX_ROWS} premières seront importées.
              </span>
            )}
          </div>
          {preview.unmapped.length > 0 && <p className="text-xs text-muted-foreground">Colonnes ignorées : {preview.unmapped.join(", ")}</p>}
          {preview.errors.length > 0 && (
            <details className="rounded-lg border bg-muted/40 p-3 text-xs">
              <summary className="cursor-pointer font-medium">Détail des avertissements</summary>
              <ul className="mt-2 max-h-40 space-y-1 overflow-auto">
                {preview.errors.slice(0, 100).map((e, i) => (
                  <li key={i}>
                    Ligne {e.line} : {e.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ligne</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>{props.kind === "contacts" ? "Catégorie" : "Groupe"}</TableHead>
                  {props.kind === "guests" && <TableHead>Enfant</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(preview.contacts ?? preview.guests ?? []).slice(0, 15).map((d) => (
                  <TableRow key={d.line}>
                    <TableCell className="text-muted-foreground">{d.line}</TableCell>
                    <TableCell>{`${d.firstName} ${d.lastName}`.trim() || ("company" in d ? d.company : "")}</TableCell>
                    <TableCell>{d.email ?? "Non renseigné"}</TableCell>
                    <TableCell>{d.phone ?? "Non renseigné"}</TableCell>
                    <TableCell>{"category" in d ? (d.category ?? "Non renseignée") : d.groupName ?? "Non renseigné"}</TableCell>
                    {"isChild" in d && <TableCell>{d.isChild ? `oui${d.ageYears !== null ? ` (${d.ageYears} ans)` : ""}` : "non"}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {count > 15 && <p className="px-3 py-2 text-xs text-muted-foreground">… et {count - 15} autre(s) ligne(s).</p>}
          </div>
          {props.kind === "contacts" && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {props.scopes.length > 1 && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="import-scope">Carnet</Label>
                  <Select value={scope} onValueChange={setScope}>
                    <SelectTrigger id="import-scope" className="w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {props.scopes.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={skipDuplicates} onCheckedChange={(v) => setSkipDuplicates(v === true)} />
                Ignorer les doublons (même e-mail ou téléphone)
              </label>
            </div>
          )}
          <Button onClick={submit} disabled={pending || count === 0}>
            {pending ? "Import en cours…" : `Importer ${count} ligne(s)`}
          </Button>
        </div>
      )}
    </div>
  );
}
