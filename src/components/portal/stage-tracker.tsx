import { CLIENT_STAGE_LABELS, type ClientStage } from "@/domain/workflow";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/cn";

const STEPS = ["RECEIVED", "PROPOSAL", "TEAM", "CONFIRMED"] as const;
type Step = (typeof STEPS)[number];
type StepState = "done" | "current" | "upcoming" | "inactive";

const STATE_LABELS: Record<StepState, string> = {
  done: "Terminé",
  current: "En cours",
  upcoming: "À venir",
  inactive: "Non atteint",
};

function stepStates(stage: ClientStage): Record<Step, StepState> {
  if (stage === "CONFIRMED" || stage === "COMPLETED") {
    return { RECEIVED: "done", PROPOSAL: "done", TEAM: "done", CONFIRMED: "done" };
  }
  if (stage === "CLOSED") {
    return { RECEIVED: "inactive", PROPOSAL: "inactive", TEAM: "inactive", CONFIRMED: "inactive" };
  }
  const currentIndex = STEPS.indexOf(stage);
  const states = {} as Record<Step, StepState>;
  STEPS.forEach((step, index) => {
    states[step] = index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
  });
  return states;
}

/** Four-step progress of a client file. State is written out, never carried by colour alone. */
export function StageTracker({ stage, ownerFirstName }: { stage: ClientStage; ownerFirstName: string }) {
  const states = stepStates(stage);
  const awaitingConfirmation = stage === "RECEIVED" || stage === "PROPOSAL" || stage === "TEAM";
  return (
    <div className="flex flex-col gap-4">
      <ol aria-label="Avancement du dossier" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => {
          const state = states[step];
          const muted = state === "upcoming" || state === "inactive";
          return (
            <li
              key={step}
              aria-current={state === "current" ? "step" : undefined}
              className={cn(
                "flex items-start gap-3 rounded-sm border px-3 py-2.5",
                state === "current" ? "border-sage-700 bg-sage-50" : "border-sage-200 bg-ivory-50",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-1.5 size-3 shrink-0 rounded-full border",
                  state === "done" ? "border-sage-700 bg-sage-700" : state === "current" ? "border-clay-600 bg-clay-600" : "border-sage-400 bg-transparent",
                )}
              />
              <span className="flex min-w-0 flex-col">
                <span className={cn("text-[15px] leading-snug font-medium", muted ? "text-ink-500" : "text-ink-900")}>
                  <span className="tabular">{index + 1}.</span> {CLIENT_STAGE_LABELS[step]}
                </span>
                <span className="text-[13px] text-ink-500">{STATE_LABELS[state]}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {stage === "COMPLETED" ? (
        <Alert kind="success" role="status">
          Prestation réalisée. Merci de votre confiance.
        </Alert>
      ) : null}
      {stage === "CLOSED" ? (
        <Alert kind="info" role="status" title="Dossier clos">
          Ce dossier n’est plus actif. Pour toute question, contactez {ownerFirstName} directement.
        </Alert>
      ) : null}
      {awaitingConfirmation ? <p className="text-[15px] leading-snug text-ink-700">Aucune disponibilité n’est garantie avant la confirmation par {ownerFirstName}.</p> : null}
    </div>
  );
}
