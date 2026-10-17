import { formatInstantParis } from "@/lib/time";
import { AdminSection } from "@/components/admin/section";
import { auditActionLabel } from "@/domain/labels";

export type AuditRow = { id: string; action: string; summary: string | null; createdAt: Date; actor: { name: string; role: string } | null };

export function AuditSection({ id = "historique", entries, title = "Historique" }: { id?: string; entries: AuditRow[]; title?: string }) {
  return (
    <AdminSection id={id} title={title} description="Journal des actions sur ce dossier, le plus récent en premier.">
      {entries.length ? (
        <ol className="divide-y divide-sage-100 rounded-md border border-sage-200 bg-ivory-50 text-sm">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <p className="text-ink-900">
                <span className="font-medium">{auditActionLabel(entry.action)}</span>
                {entry.summary ? <span className="ml-2 text-[13px] text-ink-500">{entry.summary}</span> : null}
              </p>
              <p className="shrink-0 text-[13px] text-ink-500 tabular">
                {formatInstantParis(entry.createdAt)} · {entry.actor?.name ?? "Système"}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-[15px] text-ink-500">Aucune action enregistrée.</p>
      )}
    </AdminSection>
  );
}
