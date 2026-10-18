"use client";
import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { FileUpload } from "@/components/files/file-upload";
import { FormMessage } from "@/components/shared/form-message";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { unsplashUrl, type DemoPhoto } from "@/modules/media/demo-photos";
import { privateFileHref } from "@/modules/files/application/file-urls";

/**
 * Settings: choose the ambience picture among the catalogue of the event type
 * or upload a personal photo (scope event, purpose cover). Every choice is
 * saved immediately through the server action.
 */
export function CoverPicker({ eventId, catalog, currentPhotoId, currentFileId, action }: { eventId: string; catalog: DemoPhoto[]; currentPhotoId: string | null; currentFileId: string | null; action: (eventId: string, input: unknown) => Promise<ActionResult> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploaded, setUploaded] = useState<string | null>(currentFileId);

  function save(input: { coverPhotoId?: string | null; coverFileId?: string | null }, success: string) {
    start(async () => {
      const res = await action(eventId, input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      toast.success(success);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5" aria-label="Photos du catalogue">
        {catalog.map((p) => {
          const selected = !uploaded && currentPhotoId === p.id;
          return (
            <li key={p.id}>
              <button
                type="button"
                disabled={pending}
                aria-pressed={selected}
                aria-label={`${p.alt}${selected ? " (photo actuelle)" : ""}`}
                onClick={() => {
                  setUploaded(null);
                  save({ coverPhotoId: p.id, coverFileId: null }, "Photo de couverture mise à jour.");
                }}
                className={cn("relative block aspect-[4/3] w-full overflow-hidden rounded-xl ring-offset-2 ring-offset-card transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", selected ? "ring-2 ring-primary" : "hover:opacity-90")}
                style={{ backgroundColor: p.tone }}
              >
                <Image src={unsplashUrl(p.id, { w: 480, h: 360 })} alt="" fill sizes="(max-width: 640px) 33vw, 20vw" className="object-cover" />
                {selected && (
                  <span className="absolute right-1.5 top-1.5 inline-flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3.5" aria-hidden="true" />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="rounded-xl border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Votre propre photo</p>
          {uploaded ? (
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Photo utilisée</span>
              <a href={privateFileHref(uploaded)} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                Voir
              </a>
            </span>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setShowUpload((v) => !v)} aria-expanded={showUpload}>
              Téléverser une photo
            </Button>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">JPEG, PNG ou WebP, 10 Mo maximum. La photo est analysée puis redimensionnée ; elle n'est visible que par l'équipe de l'évènement.</p>
        {showUpload && !uploaded && (
          <div className="mt-3">
            <FileUpload
              scope="event"
              scopeId={eventId}
              purpose="cover"
              maxFiles={1}
              label="Photo de couverture"
              onUploaded={(f) => {
                setUploaded(f.id);
                setShowUpload(false);
                save({ coverFileId: f.id }, "Votre photo est maintenant la couverture de l'évènement.");
              }}
            />
          </div>
        )}
      </div>
      <FormMessage error={error} />
    </div>
  );
}
