import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { formatDateFr } from "@/lib/utils";
import type { SecurityEventView } from "@/modules/identity/application/security-service";
import { describeUserAgent, SECURITY_EVENT_LABELS } from "@/modules/identity/domain/security";

const TONE: Record<SecurityEventView["severity"], StatusTone> = { info: "neutral", low: "info", medium: "warning", high: "danger", critical: "danger" };

export function SecurityLog({ events, timezone }: { events: SecurityEventView[]; timezone: string }) {
  if (events.length === 0) {
    return <EmptyState title="Aucune activité enregistrée" description="Les connexions, changements de mot de passe et réglages de sécurité apparaîtront ici." className="py-8" />;
  }
  return (
    <ol className="divide-y rounded-xl border">
      {events.map((ev) => (
        <li key={ev.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
          <time dateTime={ev.createdAt.toISOString()} className="w-40 shrink-0 text-muted-foreground tabular-nums">
            {formatDateFr(ev.createdAt, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }, timezone)}
          </time>
          <span className="min-w-0 flex-1 font-medium">{SECURITY_EVENT_LABELS[ev.type]}</span>
          <span className="text-muted-foreground">
            {describeUserAgent(ev.userAgent)}
            {ev.ipAddress ? ` · ${ev.ipAddress}` : ""}
          </span>
          <StatusBadge tone={TONE[ev.severity]} dot={false}>
            {ev.severity}
          </StatusBadge>
        </li>
      ))}
    </ol>
  );
}
