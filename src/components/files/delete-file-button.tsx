"use client";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/errors";

export function DeleteFileButton({ fileId, fileName, action }: { fileId: string; fileName: string; action: (fileId: string) => Promise<ActionResult<undefined>> }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="icon" aria-label={`Supprimer ${fileName}`}>
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      }
      title="Supprimer ce fichier ?"
      description={`« ${fileName} » sera supprimé définitivement de votre espace. Cette action est irréversible.`}
      confirmLabel="Supprimer"
      successMessage="Fichier supprimé."
      onConfirm={async () => {
        const res = await action(fileId);
        if (res.ok) router.refresh();
        return res;
      }}
    />
  );
}
