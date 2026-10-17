"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { FileUpload } from "@/components/files/file-upload";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormMessage } from "@/components/shared/form-message";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ActionResult } from "@/lib/errors";
import { DOCUMENT_KIND_LABELS, DOCUMENT_KINDS } from "@/modules/events/domain/document-labels";

export function AddDocumentDialog({ eventId, providers, action }: { eventId: string; providers: Array<{ id: string; label: string }>; action: (eventId: string, input: unknown) => Promise<ActionResult<{ id: string }>> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<string>("other");
  const [visibility, setVisibility] = useState<string>("organizers");
  const [provider, setProvider] = useState<string>("");
  const [fileId, setFileId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = { title: fd.get("title"), kind, fileId, visibility, eventProfessionalId: visibility === "provider" ? provider || null : null };
    start(async () => {
      const res = await action(eventId, input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Document ajouté.");
      setOpen(false);
      setFileId(null);
      setFileName("");
      router.refresh();
    });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden="true" />
          Ajouter un document
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau document</DialogTitle>
          <DialogDescription>Le fichier est analysé avant d'être disponible. Jamais de donnée de santé dans un document partagé à l'équipe.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="doc-title">Titre</Label>
            <Input id="doc-title" name="title" required minLength={2} maxLength={160} defaultValue={fileName.replace(/\.[^.]+$/, "")} key={fileName} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="doc-kind">Type</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger id="doc-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {DOCUMENT_KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-vis">Visibilité</Label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger id="doc-vis">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="organizers">Organisateurs seulement</SelectItem>
                  <SelectItem value="team">Toute l'équipe</SelectItem>
                  <SelectItem value="provider">Un prestataire précis</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {visibility === "provider" && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="doc-pro">Prestataire</Label>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger id="doc-pro">
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Fichier</p>
            {fileId ? (
              <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span className="truncate">{fileName || "Fichier prêt"}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setFileId(null)}>
                  Changer
                </Button>
              </div>
            ) : (
              <FileUpload
                scope="event"
                scopeId={eventId}
                purpose="document"
                maxFiles={1}
                onUploaded={(f) => {
                  setFileId(f.id);
                  setFileName(f.originalName);
                }}
              />
            )}
          </div>
          <FormMessage error={error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending || !fileId}>
              {pending ? "Ajout…" : "Ajouter"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteDocumentButton({ eventId, documentId, title, action, icon }: { eventId: string; documentId: string; title: string; action: (eventId: string, documentId: string) => Promise<ActionResult>; icon: React.ReactNode }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Supprimer ${title}`}>
          {icon}
        </Button>
      }
      title={`Supprimer « ${title} » ?`}
      description="Le document ne sera plus accessible à l'équipe. Cette action est journalisée."
      confirmLabel="Supprimer"
      successMessage="Document supprimé."
      onConfirm={async () => {
        const res = await action(eventId, documentId);
        if (res.ok) router.refresh();
        return res;
      }}
    />
  );
}
