import type { Metadata } from "next";
import Link from "next/link";
import { DependencySelect, LiveButton, LiveRefresh } from "@/components/live/live-controls";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireActor } from "@/lib/session";
import { getLiveDay } from "@/modules/events/application/live-day-service";
import { guardPage } from "../_guards";
import { chainStepsAction, reportDelayAction, setDependencyAction, setLiveStatusAction } from "./actions";

export const metadata: Metadata = { title: "Jour J en direct" };

function hhmm(d: Date, timeZone: string) {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone }).format(d);
}

/** The day minute by minute, shared by organisers and providers; delays propagate to what depends on them. */
export default async function LiveDayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/app/evenements/${id}/jour-j`);
  const data = await guardPage(() => getLiveDay(actor, id));
  const tz = data.event.timezone;
  const unchained = data.steps.slice(1).some((s) => !s.dependsOnMilestoneId);
  return (
    <div className="space-y-6">
      <LiveRefresh />
      <PageHeader
        title="Jour J en direct"
        description="Le déroulé commun à toute l'équipe. Quand une étape prend du retard, les étapes qui en dépendent sont décalées et les personnes concernées sont prévenues. La page se met à jour toute seule."
        actions={
          data.canManage && unchained && data.steps.length > 1 ? <LiveButton act={chainStepsAction.bind(null, id)} label="Enchaîner les étapes successives" done="Étapes enchaînées." /> : undefined
        }
      />
      {data.steps.length === 0 ? (
        <EmptyState
          title="Pas encore de déroulé"
          description="Ajoutez les étapes de la journée dans le planning : elles apparaîtront ici le jour J."
          action={
            <Link href={`/app/evenements/${id}/planning`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              Ouvrir le planning
            </Link>
          }
        />
      ) : (
        <ol className="space-y-3" data-testid="live-steps">
          {data.steps.map((s) => {
            const shifted = s.timing.shiftMinutes !== 0;
            return (
              <li key={s.id} className="rounded-xl border bg-card p-4" data-testid="live-step">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-4">
                    <div className="w-20 shrink-0 tabular-nums">
                      <p className="text-lg font-semibold">{hhmm(s.timing.expectedStart, tz)}</p>
                      {shifted && (
                        <p className="text-xs text-muted-foreground">
                          prévu <span className="line-through">{hhmm(s.startsAt, tz)}</span>
                        </p>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-heading text-lg font-semibold">{s.title}</h2>
                      <p className="text-sm text-muted-foreground">
                        {s.timing.expectedEnd ? `Jusqu'à ${hhmm(s.timing.expectedEnd, tz)}` : "Durée libre"}
                        {s.dependsOnTitle ? `, après « ${s.dependsOnTitle} »` : ""}
                      </p>
                      {shifted && (
                        <p className="mt-1 text-sm" data-testid="live-shift">
                          {s.timing.shiftMinutes > 0 ? `Décalé de ${s.timing.shiftMinutes} min` : `Avancé de ${-s.timing.shiftMinutes} min`}
                          {s.timing.pushedBy && s.timing.pushedBy !== s.id ? ` à cause de « ${data.steps.find((x) => x.id === s.timing.pushedBy)?.title ?? "une étape précédente"} »` : ""}
                          {s.delayReason ? ` : ${s.delayReason}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  <StatusBadge tone={s.liveStatus === "done" ? "success" : s.liveStatus === "in_progress" ? "info" : shifted ? "warning" : "neutral"}>
                    {s.liveStatus === "done" ? "Terminé" : s.liveStatus === "in_progress" ? "En cours" : shifted ? "Décalé" : "À l'heure"}
                  </StatusBadge>
                </div>
                {(s.canAct || data.canManage) && s.liveStatus !== "done" && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                    {s.canAct && s.liveStatus === "planned" && <LiveButton act={setLiveStatusAction.bind(null, id, s.id, "in_progress")} label="Commencé" done={`« ${s.title} » a commencé.`} variant="default" />}
                    {s.canAct && <LiveButton act={setLiveStatusAction.bind(null, id, s.id, "done")} label="Terminé" done={`« ${s.title} » est terminé.`} />}
                    {s.canAct &&
                      [10, 20, 30].map((m) => <LiveButton key={m} act={reportDelayAction.bind(null, id, s.id, m)} label={`Retard ${m} min`} done={`Retard de ${m} min signalé.`} ariaLabel={`Signaler ${m} minutes de retard sur ${s.title}`} />)}
                    {data.canManage && (
                      <DependencySelect id={`dep-${s.id}`} value={s.dependsOnMilestoneId ?? ""} options={data.steps.filter((o) => o.id !== s.id).map((o) => ({ id: o.id, title: o.title }))} act={setDependencyAction.bind(null, id, s.id)} />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
