"use client";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";
import { FileUpload, type FileUploadProps } from "./file-upload";

/**
 * FileUpload wired to the current page: refreshes the server-rendered list
 * once a file reaches a terminal status. Used by "Mes fichiers" and reusable
 * by any page that lists the files of a scope.
 */
export function ScopeFilesUploader(props: Omit<FileUploadProps, "onUploaded" | "onStatusChange">) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  return (
    <FileUpload
      {...props}
      onUploaded={(f) => {
        if (f.status === "clean") {
          toast.success(`« ${f.originalName} » est vérifié et disponible.`);
          refresh();
        }
      }}
      onStatusChange={(f) => {
        if (f.status === "clean") {
          toast.success(`« ${f.originalName} » est vérifié et disponible.`);
          refresh();
        } else if (f.status === "rejected" || f.status === "infected") {
          toast.error(f.rejectionReason ?? `« ${f.originalName} » a été refusé.`);
          refresh();
        }
      }}
    />
  );
}
