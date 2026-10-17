"use client";
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

/** Countdown shown when better-auth answered 429 (X-Retry-After, in seconds). */
export function RateLimitNotice({ until, onExpire }: { until: number; onExpire?: () => void }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((until - Date.now()) / 1000)));
  useEffect(() => {
    const tick = () => {
      const next = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0) onExpire?.();
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [until, onExpire]);

  if (remaining <= 0) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg bg-warning/20 px-3 py-2 text-sm text-warning-foreground">
      <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        Trop de tentatives. Vous pourrez réessayer dans <strong className="tabular-nums">{remaining} s</strong>.
      </span>
    </p>
  );
}
