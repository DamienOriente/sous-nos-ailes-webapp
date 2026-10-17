"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { FileUpload } from "@/components/files/file-upload";
import type { ActionResult } from "@/lib/errors";
import { DOCUMENT_KIND_LABELS, type DocumentKind } from "@/modules/professionals/domain/verification";

/** Pick a document kind, upload through the files module, then record it on the listing. */
export function DocumentUploader({ professionalId, onAttach }: { professionalId: string; onAttach: (input: { professionalId: string; fileId: string; kind: string; label?: string }) => Promise<ActionResult<{ id: string }>> }) {
  const [kind, setKind] = useState<DocumentKind>("kbis_or_sirene");
  const [, start] = useTransition();
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="space-y-2">
        <Label htmlFor="doc-kind">Type de justificatif</Label>
        <select id="doc-kind" value={kind} onChange={(e) => setKind(e.target.value as DocumentKind)} className="h-9 w-full rounded-lg border bg-background px-3 text-sm sm:w-80">
          {(Object.keys(DOCUMENT_KIND_LABELS) as DocumentKind[]).map((k) => (
            <option key={k} value={k}>
              {DOCUMENT_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      <FileUpload
        scope="professional"
        scopeId={professionalId}
        purpose="supporting_document"
        accept="application/pdf,image/jpeg,image/png"
        maxFiles={5}
        label="Téléverser"
        onUploaded={(file) =>
          start(async () => {
            const r = await onAttach({ professionalId, fileId: file.id, kind, label: file.originalName });
            if (r.ok) toast.success("Justificatif transmis. Il sera examiné par notre équipe.");
            else toast.error(r.error);
          })
        }
      />
    </div>
  );
}
