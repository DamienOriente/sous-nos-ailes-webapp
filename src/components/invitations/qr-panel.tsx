"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActionResult } from "@/lib/errors";
import type { QrPayload } from "@/modules/invitations/application/invitation-service";

/**
 * Generates and shows the single-use check-in QR. The image is a data URL
 * produced server side; the download links go through the protected route.
 */
export function QrPanel({ eventId, invitationId, hasToken, disabled, onGenerate }: { eventId: string; invitationId: string; hasToken: boolean; disabled?: boolean; onGenerate: (eventId: string, invitationId: string, regenerate?: boolean) => Promise<ActionResult<QrPayload>> }) {
  const router = useRouter();
  const [qr, setQr] = useState<QrPayload | null>(null);
  const [pending, start] = useTransition();
  const generate = (regenerate: boolean) =>
    start(async () => {
      const res = await onGenerate(eventId, invitationId, regenerate);
      if (res.ok) {
        setQr(res.data);
        if (res.data.regenerated) toast.success("Nouveau QR code généré : l'ancien est invalidé.");
        router.refresh();
      } else toast.error(res.error);
    });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
           QR code d'accès
        </CardTitle>
        <CardDescription>Code anonyme à usage unique, validé à l'entrée par votre équipe. Il ne contient aucune donnée personnelle.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {qr ? (
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL */}
            <img src={qr.pngDataUrl} alt="QR code d'accès" width={192} height={192} className="rounded-lg border bg-white p-2" data-testid="qr-image" />
            <p className="max-w-xs text-center font-mono text-[11px] break-all text-muted-foreground" data-testid="qr-url">
              {qr.url}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={`/api/invitations/qr/${invitationId}?format=png`} download={`qr-${invitationId.slice(0, 8)}.png`}>
                  <Download className="size-4" aria-hidden="true" /> PNG
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={`/api/invitations/qr/${invitationId}?format=svg`} download={`qr-${invitationId.slice(0, 8)}.svg`}>
                  <Download className="size-4" aria-hidden="true" /> SVG
                </a>
              </Button>
              <Button variant="outline" size="sm" disabled={pending} onClick={() => generate(true)}>
                 Régénérer
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => generate(false)} disabled={pending || disabled} data-testid="generate-qr">
             {pending ? "Génération…" : hasToken ? "Afficher le QR code" : "Générer le QR code"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
