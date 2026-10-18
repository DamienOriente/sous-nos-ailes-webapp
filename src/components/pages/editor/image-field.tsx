"use client";

import Image from "next/image";
import { FileUpload } from "@/components/files/file-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { publicImageHref } from "@/modules/files/application/file-urls";

/**
 * One image slot: upload (files module), preview, alt text, remove. The alt
 * text is mandatory for accessibility and counted by the SEO assistant.
 */
export function ImageField({
  id,
  label,
  professionalId,
  purpose,
  fileId,
  alt,
  onChange,
}: {
  id: string;
  label: string;
  professionalId: string;
  purpose: "cover" | "gallery" | "logo";
  fileId?: string;
  alt?: string;
  onChange: (next: { fileId?: string; alt?: string }) => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-sm font-medium">{label}</p>
      {fileId ? (
        <div className="flex items-start gap-3">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-muted">
            <Image src={publicImageHref(fileId, "thumb")} alt={alt || ""} fill sizes="80px" unoptimized className="object-cover" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="space-y-1">
              <Label htmlFor={`${id}-alt`}>Description de l'image</Label>
              <Input id={`${id}-alt`} value={alt ?? ""} maxLength={160} placeholder="Ce que montre la photo, en une phrase" onChange={(e) => onChange({ fileId, alt: e.target.value })} />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => onChange({ fileId: undefined, alt: undefined })}>
              Retirer l'image
            </Button>
          </div>
        </div>
      ) : (
        <FileUpload scope="professional" scopeId={professionalId} purpose={purpose} maxFiles={1} onUploaded={(f) => onChange({ fileId: f.id, alt: alt ?? "" })} />
      )}
    </div>
  );
}
