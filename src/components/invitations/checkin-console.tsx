"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Camera, CameraOff, CheckCircle2, KeyRound, ShieldAlert, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { CheckinOutcome } from "@/modules/invitations/application/invitation-service";

type Outcome = Omit<CheckinOutcome, "scannedAt" | "previousScanAt"> & { scannedAt: string; previousScanAt: string | null };

/** Minimal typing of the BarcodeDetector API (not in lib.dom for every TS version). */
type BarcodeDetectorLike = { detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>> };
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike;

const RESULT_STYLE: Record<Outcome["result"], { tone: string; icon: typeof CheckCircle2 }> = {
  accepted: { tone: "border-success bg-success/10 text-success", icon: CheckCircle2 },
  duplicate: { tone: "border-warning bg-warning/15 text-warning-foreground", icon: ShieldAlert },
  revoked: { tone: "border-destructive bg-destructive/10 text-destructive", icon: XCircle },
  expired: { tone: "border-destructive bg-destructive/10 text-destructive", icon: XCircle },
  invalid: { tone: "border-destructive bg-destructive/10 text-destructive", icon: XCircle },
};

/**
 * Staff console: manual code entry (always) + camera scan when the browser
 * exposes BarcodeDetector (no third-party library). Each code is validated
 * server side through POST /api/checkin; the UI never trusts the QR content.
 */
export function CheckinConsole({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [last, setLast] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Feature detection without a hydration mismatch: null on the server, boolean on the client.
  const scannerSupported = useSyncExternalStore(
    () => () => undefined,
    () => "BarcodeDetector" in window && Boolean(navigator.mediaDevices?.getUserMedia),
    () => null,
  );
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanRef = useRef<{ value: string; at: number }>({ value: "", at: 0 });

  const validate = useCallback(
    async (raw: string) => {
      const value = raw.trim();
      if (!value) return;
      setPending(true);
      setError(null);
      try {
        const res = await fetch("/api/checkin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, code: value }) });
        const data = (await res.json()) as Outcome | { error: string };
        if (!res.ok || "error" in data) {
          setError("error" in data ? data.error : "Validation impossible.");
          return;
        }
        setLast(data);
        setCode("");
        router.refresh();
        if (typeof navigator.vibrate === "function") navigator.vibrate(data.result === "accepted" ? 80 : [60, 60, 60]);
      } catch {
        setError("Réseau indisponible : réessayez.");
      } finally {
        setPending(false);
      }
    },
    [eventId, router],
  );

  const stopScan = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => {
    if (!scanning) return;
    let cancelled = false;
    let raf = 0;
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!Detector) return;
    const detector = new Detector({ formats: ["qr_code"] });
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) return void stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const hit = codes[0]?.rawValue;
            const now = Date.now();
            // Debounce: the same code stays in the frame for a while after scanning.
            if (hit && (hit !== lastScanRef.current.value || now - lastScanRef.current.at > 4000)) {
              lastScanRef.current = { value: hit, at: now };
              await validate(hit);
            }
          } catch {
            // detection errors are transient (frame not ready)
          }
          raf = window.setTimeout(tick, 350);
        };
        void tick();
      } catch (err) {
        setCameraError(err instanceof Error && err.name === "NotAllowedError" ? "Accès caméra refusé (vérifiez aussi la politique Permissions-Policy du site). Utilisez la saisie manuelle." : "Caméra indisponible. Utilisez la saisie manuelle.");
        setScanning(false);
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(raf);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [scanning, validate]);

  const style = last ? RESULT_STYLE[last.result] : null;

  return (
    <div className="space-y-4">
      {last && style && (
        <div role="status" aria-live="polite" data-testid="checkin-result" data-result={last.result} className={cn("rounded-2xl border-2 p-5", style.tone)}>
          <div className="flex items-start gap-3">
            <style.icon className="mt-0.5 size-8 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-lg font-semibold">{last.label}</p>
              {last.invitation && (
                <p className="text-sm">
                  <span className="font-medium">{last.invitation.recipientName}</span> · {last.invitation.expectedCount} personne(s) attendue(s)
                </p>
              )}
              {last.previousScanAt && <p className="text-xs">Première validation : {new Date(last.previousScanAt).toLocaleTimeString("fr-FR")}</p>}
              <p className="mt-1 text-xs opacity-80">{new Date(last.scannedAt).toLocaleTimeString("fr-FR")}</p>
            </div>
          </div>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4 text-primary" aria-hidden="true" /> Saisie manuelle
          </CardTitle>
          <CardDescription>Collez l'URL du QR code ou tapez le code. La validation est faite côté serveur.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              void validate(code);
            }}
          >
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="checkin-code" className="sr-only">
                Code d'accès
              </Label>
              <Input id="checkin-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code ou URL du QR" autoComplete="off" autoCapitalize="off" spellCheck={false} className="h-12 text-base" />
            </div>
            <Button type="submit" size="lg" className="h-12 min-w-36" disabled={pending || !code.trim()} data-testid="checkin-submit">
              {pending ? "Validation…" : "Valider"}
            </Button>
          </form>
          {error && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="size-4 text-primary" aria-hidden="true" /> Scanner avec la caméra
          </CardTitle>
          <CardDescription>Utilise l'API native du navigateur (BarcodeDetector), sans bibliothèque tierce.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {scannerSupported === false && (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <CameraOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> Ce navigateur ne propose pas la lecture de QR code native (Chrome/Edge Android, Safari iOS 17+ la proposent). Utilisez la saisie manuelle ou l'appareil photo du téléphone, puis collez le code.
            </p>
          )}
          {scannerSupported && (
            <>
              {scanning ? (
                <div className="space-y-2">
                  <video ref={videoRef} muted playsInline className="aspect-video w-full rounded-xl bg-black object-cover" aria-label="Flux caméra pour le scan" />
                  <Button variant="outline" size="lg" className="w-full" onClick={stopScan}>
                    Arrêter le scan
                  </Button>
                </div>
              ) : (
                <Button size="lg" className="h-12 w-full sm:w-auto" onClick={() => { setCameraError(null); setScanning(true); }}>
                  <Camera className="size-4" aria-hidden="true" /> Démarrer le scan
                </Button>
              )}
              {cameraError && (
                <p role="alert" className="text-sm text-destructive">
                  {cameraError}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
