"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileIcon, Loader2, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import { FILE_STATUS_LABELS, MIME_EXTENSIONS, PURPOSE_RULES, type FilePurpose, type FileScope, type FileStatus } from "@/modules/files/domain/policy";

export type UploadedFileInfo = { id: string; originalName: string; mimeType: string; sizeBytes: number; status: FileStatus };

export type FileUploadProps = {
  scope: FileScope;
  scopeId: string;
  purpose: FilePurpose;
  /** HTML accept attribute. Defaults to the allowlist of the purpose. */
  accept?: string;
  /** Maximum number of files that can be sent through this instance (default 1). */
  maxFiles?: number;
  /** Fired once the server accepted the upload (status may still be "scanning"). */
  onUploaded: (file: UploadedFileInfo) => void;
  /** Fired on every status transition observed while polling (scanning → clean/rejected/infected). */
  onStatusChange?: (file: UploadedFileInfo & { rejectionReason: string | null }) => void;
  label?: string;
  description?: string;
  className?: string;
  disabled?: boolean;
};

type Item = {
  key: string;
  name: string;
  sizeBytes: number;
  progress: number;
  phase: "uploading" | "processing" | "done" | "error";
  status?: FileStatus;
  id?: string;
  mimeType?: string;
  error?: string;
};

const TERMINAL: ReadonlySet<FileStatus> = new Set(["clean", "rejected", "infected", "deleted"]);
const POLL_MS = 1_500;
const POLL_MAX_MS = 3 * 60_000;

function defaultAccept(purpose: FilePurpose): string {
  const families = PURPOSE_RULES[purpose].families;
  const mimes = Object.keys(MIME_EXTENSIONS).filter((m) => (m.startsWith("image/") && families.includes("image")) || (m === "application/pdf" && families.includes("pdf")) || (m.startsWith("application/vnd.") && families.includes("office")));
  const exts = mimes.flatMap((m) => MIME_EXTENSIONS[m] ?? []).map((e) => `.${e}`);
  return [...mimes, ...exts].join(",");
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function statusTone(status: FileStatus | undefined): StatusTone {
  switch (status) {
    case "clean":
      return "success";
    case "rejected":
    case "infected":
      return "danger";
    case "scanning":
      return "info";
    default:
      return "neutral";
  }
}

/**
 * Drag & drop + button uploader for the files pipeline. Sends multipart to
 * POST /api/files/upload with progress, then polls /api/files/[id]/status
 * until the antivirus/optimisation step reaches a terminal state.
 */
export function FileUpload({ scope, scopeId, purpose, accept, maxFiles = 1, onUploaded, onStatusChange, label, description, className, disabled }: FileUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const pollers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const maxBytes = PURPOSE_RULES[purpose].maxBytes;
  const sentCount = items.filter((i) => i.phase !== "error").length;
  const full = sentCount >= maxFiles;

  useEffect(() => {
    const map = pollers.current;
    return () => {
      for (const t of map.values()) clearTimeout(t);
      map.clear();
    };
  }, []);

  const update = useCallback((key: string, patch: Partial<Item>) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }, []);

  const poll = useCallback(
    (key: string, id: string, base: UploadedFileInfo, startedAt: number) => {
      const tick = async () => {
        try {
          const res = await fetch(`/api/files/${id}/status`, { cache: "no-store", credentials: "same-origin" });
          if (!res.ok) throw new Error(`status ${res.status}`);
          const data = (await res.json()) as { status: FileStatus; rejectionReason: string | null; mimeType: string; sizeBytes: number };
          update(key, { status: data.status, phase: TERMINAL.has(data.status) ? "done" : "processing", error: data.rejectionReason ?? undefined });
          onStatusChange?.({ ...base, mimeType: data.mimeType, sizeBytes: data.sizeBytes, status: data.status, rejectionReason: data.rejectionReason });
          if (TERMINAL.has(data.status)) return;
        } catch {
          // transient: keep polling
        }
        if (Date.now() - startedAt > POLL_MAX_MS) {
          update(key, { phase: "error", error: "L'analyse prend plus de temps que prévu. Le fichier restera disponible une fois vérifié." });
          return;
        }
        pollers.current.set(key, setTimeout(tick, POLL_MS));
      };
      pollers.current.set(key, setTimeout(tick, POLL_MS));
    },
    [onStatusChange, update],
  );

  const send = useCallback(
    (file: File) => {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (file.size > maxBytes) {
        setItems((prev) => [...prev, { key, name: file.name, sizeBytes: file.size, progress: 0, phase: "error", error: `Fichier trop volumineux (maximum ${formatSize(maxBytes)}).` }]);
        return;
      }
      setItems((prev) => [...prev, { key, name: file.name, sizeBytes: file.size, progress: 0, phase: "uploading" }]);
      const form = new FormData();
      form.set("file", file, file.name);
      form.set("scope", scope);
      form.set("scopeId", scopeId);
      form.set("purpose", purpose);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/files/upload");
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) update(key, { progress: Math.round((e.loaded / e.total) * 100) });
      };
      xhr.onerror = () => update(key, { phase: "error", error: "Échec de l'envoi. Vérifiez votre connexion." });
      xhr.onload = () => {
        let body: Record<string, unknown> = {};
        try {
          body = JSON.parse(xhr.responseText) as Record<string, unknown>;
        } catch {
          body = {};
        }
        if (xhr.status >= 200 && xhr.status < 300 && typeof body.id === "string") {
          const info: UploadedFileInfo = {
            id: body.id,
            originalName: String(body.originalName ?? file.name),
            mimeType: String(body.mimeType ?? file.type),
            sizeBytes: Number(body.sizeBytes ?? file.size),
            status: (body.status as FileStatus) ?? "scanning",
          };
          const terminal = TERMINAL.has(info.status);
          update(key, { id: info.id, mimeType: info.mimeType, status: info.status, progress: 100, phase: terminal ? "done" : "processing", error: typeof body.rejectionReason === "string" ? body.rejectionReason : undefined });
          onUploaded(info);
          if (!terminal) poll(key, info.id, info, Date.now());
          else onStatusChange?.({ ...info, rejectionReason: typeof body.rejectionReason === "string" ? body.rejectionReason : null });
        } else {
          const message = typeof body.error === "string" ? body.error : xhr.status === 413 ? "Fichier trop volumineux." : xhr.status === 401 ? "Connexion requise." : "Le fichier a été refusé.";
          update(key, { phase: "error", error: message, status: "rejected" });
        }
      };
      xhr.send(form);
    },
    [maxBytes, onStatusChange, onUploaded, poll, purpose, scope, scopeId, update],
  );

  const handleFiles = useCallback(
    (list: FileList | File[] | null) => {
      if (!list || disabled) return;
      const remaining = Math.max(0, maxFiles - sentCount);
      Array.from(list).slice(0, remaining).forEach(send);
      if (inputRef.current) inputRef.current.value = "";
    },
    [disabled, maxFiles, send, sentCount],
  );

  const remove = (key: string) => {
    const t = pollers.current.get(key);
    if (t) clearTimeout(t);
    pollers.current.delete(key);
    setItems((prev) => prev.filter((i) => i.key !== key));
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div
        role="group"
        aria-labelledby={`${inputId}-label`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !full) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!full) handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-border bg-card/60",
          (disabled || full) && "opacity-60",
        )}
      >
        <UploadCloud className="size-8 text-primary" aria-hidden="true" />
        <p id={`${inputId}-label`} className="text-sm font-medium">
          {label ?? (maxFiles > 1 ? "Glissez vos fichiers ici" : "Glissez votre fichier ici")}
        </p>
        <p className="text-xs text-muted-foreground">{description ?? `Maximum ${formatSize(maxBytes)} par fichier. Les fichiers sont analysés avant d'être disponibles.`}</p>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="sr-only"
          accept={accept ?? defaultAccept(purpose)}
          multiple={maxFiles > 1}
          disabled={disabled || full}
          onChange={(e) => handleFiles(e.target.files)}
          data-testid="file-upload-input"
        />
        <Button type="button" variant="secondary" size="sm" disabled={disabled || full} onClick={() => inputRef.current?.click()}>
          Choisir un fichier
        </Button>
      </div>

      {items.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {items.map((item) => (
            <li key={item.key} className="flex items-start gap-3 rounded-xl border bg-card px-3 py-2.5 text-sm" data-testid="file-upload-item" data-status={item.status ?? item.phase}>
              <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true">
                {item.phase === "uploading" || item.phase === "processing" ? <Loader2 className="size-4 animate-spin" /> : item.phase === "error" || item.status === "rejected" || item.status === "infected" ? <AlertCircle className="size-4 text-destructive" /> : item.status === "clean" ? <CheckCircle2 className="size-4 text-success" /> : <FileIcon className="size-4" />}
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="truncate font-medium" title={item.name}>
                    {item.name}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {formatSize(item.sizeBytes)}
                    {item.phase === "uploading" ? <StatusBadge tone="info">Envoi {item.progress}%</StatusBadge> : item.status ? <StatusBadge tone={statusTone(item.status)}>{FILE_STATUS_LABELS[item.status]}</StatusBadge> : null}
                  </span>
                </div>
                {item.phase === "uploading" && <Progress value={item.progress} aria-label={`Envoi de ${item.name}`} />}
                {item.error && (
                  <p className="text-xs text-destructive" role="alert">
                    {item.error}
                  </p>
                )}
              </div>
              <button type="button" onClick={() => remove(item.key)} className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Retirer ${item.name} de la liste`}>
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
