import { connect, type Socket } from "node:net";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { instreamFrames, parseClamReply, type ClamVerdict } from "@/modules/files/domain/clamav-protocol";

export const CLAMAV_TIMEOUT_MS = 60_000;

/**
 * Scans a buffer with clamd over TCP using zINSTREAM (NUL-terminated replies).
 * Never throws: any transport problem is returned as an "error" verdict so the
 * caller decides (production: keep in quarantine and retry; local: skip).
 */
export async function scanBuffer(payload: Uint8Array, opts: { host?: string; port?: number; timeoutMs?: number } = {}): Promise<ClamVerdict> {
  const host = opts.host ?? env.CLAMAV_HOST;
  const port = opts.port ?? env.CLAMAV_PORT;
  const timeoutMs = opts.timeoutMs ?? CLAMAV_TIMEOUT_MS;

  return new Promise<ClamVerdict>((resolve) => {
    let settled = false;
    const chunks: Buffer[] = [];
    const done = (v: ClamVerdict) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(v);
    };
    const socket: Socket = connect({ host, port });
    socket.setTimeout(timeoutMs);
    socket.on("timeout", () => done({ verdict: "error", message: "clamd timeout" }));
    socket.on("error", (err) => done({ verdict: "error", message: `clamd connection error: ${err.message}` }));
    socket.on("data", (d: Buffer) => {
      chunks.push(d);
      // zINSTREAM replies are NUL terminated: parse as soon as we have one.
      if (d.includes(0)) done(parseClamReply(Buffer.concat(chunks).toString("utf8")));
    });
    socket.on("close", () => {
      if (!settled) done(chunks.length ? parseClamReply(Buffer.concat(chunks).toString("utf8")) : { verdict: "error", message: "clamd closed the connection" });
    });
    socket.on("connect", () => {
      socket.write(Buffer.from("zINSTREAM\0", "ascii"));
      writeFrames(socket, instreamFrames(payload)).catch((err: unknown) => done({ verdict: "error", message: `clamd write error: ${(err as Error).message}` }));
    });
  });
}

async function writeFrames(socket: Socket, frames: Generator<Uint8Array>): Promise<void> {
  for (const frame of frames) {
    if (socket.destroyed) return;
    if (!socket.write(frame)) {
      await new Promise<void>((res) => socket.once("drain", () => res()));
    }
  }
}

export async function pingClamav(opts: { host?: string; port?: number; timeoutMs?: number } = {}): Promise<boolean> {
  const host = opts.host ?? env.CLAMAV_HOST;
  const port = opts.port ?? env.CLAMAV_PORT;
  return new Promise<boolean>((resolve) => {
    const socket = connect({ host, port });
    let out = "";
    const finish = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(opts.timeoutMs ?? 3_000);
    socket.on("timeout", () => finish(false));
    socket.on("error", () => finish(false));
    socket.on("data", (d: Buffer) => {
      out += d.toString("utf8");
      if (out.includes("PONG")) finish(true);
    });
    socket.on("close", () => finish(out.includes("PONG")));
    socket.on("connect", () => socket.write(Buffer.from("zPING\0", "ascii")));
  });
}

/** Whether a scan error should block the file (production) or be recorded as skipped (local/test). */
export function scanIsMandatory(): boolean {
  return env.CLAMAV_ENABLED || env.APP_ENV === "production";
}

export function logScanSkipped(fileId: string, reason: string): void {
  logger.warn({ fileId, reason }, "antivirus scan skipped (non-production only)");
}
