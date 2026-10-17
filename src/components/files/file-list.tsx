import { FileText, ImageIcon } from "lucide-react";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { formatDateFr } from "@/lib/utils";
import type { FileStatusView } from "@/modules/files/application/file-service";
import { privateFileHref } from "@/modules/files/application/file-urls";
import { FILE_STATUS_LABELS, type FileStatus } from "@/modules/files/domain/policy";

function tone(status: FileStatus): StatusTone {
  if (status === "clean") return "success";
  if (status === "rejected" || status === "infected") return "danger";
  if (status === "scanning" || status === "quarantined") return "info";
  return "neutral";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/** Read-only list of files with download links (clean files only) and an optional action slot per row. */
export function FileList({ files, renderActions }: { files: FileStatusView[]; renderActions?: (file: FileStatusView) => React.ReactNode }) {
  return (
    <ul className="divide-y rounded-2xl border bg-card" data-testid="file-list">
      {files.map((f) => {
        const isImage = f.mimeType.startsWith("image/");
        return (
          <li key={f.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center" data-testid="file-row" data-status={f.status}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground" aria-hidden="true">
              {isImage ? <ImageIcon className="size-5" /> : <FileText className="size-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium" title={f.originalName}>
                {f.originalName}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(f.sizeBytes)}
                {f.width && f.height ? ` · ${f.width}×${f.height}` : ""} · {formatDateFr(f.createdAt, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
              {f.rejectionReason && <p className="mt-0.5 text-xs text-destructive">{f.rejectionReason}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={tone(f.status)}>{FILE_STATUS_LABELS[f.status]}</StatusBadge>
              {f.status === "clean" && (
                <Button asChild variant="outline" size="sm">
                  <a href={privateFileHref(f.id, { download: true })}>Télécharger</a>
                </Button>
              )}
              {renderActions?.(f)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
