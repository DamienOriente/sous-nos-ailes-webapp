import { EVENT_TYPE_LABELS, TRI_STATE_LABELS, formatHeadcount, type HeadcountByAge } from "@/domain/labels";
import { formatEventWindow } from "@/lib/time";
import type { EventType, TriState } from "@/generated/prisma/enums";

export type MissionBriefProps = {
  brandName: string;
  ownerFirstName: string;
  ownerPhone?: string | null;
  demoMode: boolean;
  event: {
    reference: string;
    title: string;
    eventType: EventType;
    date: Date | null;
    startsAt: Date | null;
    endsAt: Date | null;
    city: string;
    postalCode: string;
    venueName: string | null;
    venueAccessInfo?: string | null;
    venueConstraints?: string | null;
    venueChildrenSpaces?: string | null;
    headcount: HeadcountByAge;
    parentsOnSite: TriState;
    dedicatedSpace: TriState;
    spaceDescription: string | null;
    meetingPoint: string | null;
    onSiteContactName: string | null;
    onSiteContactPhone: string | null;
    scheduleNotes: string | null;
    optionLabels: string[];
  };
  team: Array<{ displayName: string; roleLabel: string | null; phone?: string | null }>;
  checklist?: Array<{ label: string; isDone: boolean }>;
};

/** Printable brief for the assigned team: operational facts only, no child data, no costs. */
export function MissionBrief({ brandName, ownerFirstName, ownerPhone, demoMode, event, team, checklist }: MissionBriefProps) {
  const rows: Array<[string, string]> = [
    ["Référence", event.reference],
    ["Type", EVENT_TYPE_LABELS[event.eventType]],
    ["Date et horaires de la garde", formatEventWindow({ date: event.date, startsAt: event.startsAt, endsAt: event.endsAt })],
    ["Lieu", `${event.venueName ? `${event.venueName}, ` : ""}${event.postalCode} ${event.city}`],
    ["Point de rendez-vous de l’équipe", event.meetingPoint ?? "À confirmer avec " + ownerFirstName],
    ["Contact opérationnel sur place", event.onSiteContactName ? `${event.onSiteContactName}${event.onSiteContactPhone ? ` · ${event.onSiteContactPhone}` : ""}` : "À confirmer"],
    ["Effectifs par âge", formatHeadcount(event.headcount)],
    ["Parents sur place", TRI_STATE_LABELS[event.parentsOnSite]],
    ["Espace enfants", `${TRI_STATE_LABELS[event.dedicatedSpace]}${event.spaceDescription ? ` — ${event.spaceDescription}` : ""}`],
    ["Options prévues", event.optionLabels.length ? event.optionLabels.join(", ") : "Aucune"],
  ];
  return (
    <article className="mx-auto w-full max-w-3xl bg-white px-6 py-10 text-ink-900 shadow-card print:max-w-none print:px-0 print:py-0 print:shadow-none sm:px-12 sm:py-14">
      <header className="border-b border-sage-200 pb-6">
        <p className="font-display text-2xl text-sage-800">{brandName}</p>
        <h1 className="mt-4 font-display text-[1.75rem] leading-tight">Brief de mission — {event.title}</h1>
        <p className="mt-1 text-sm text-ink-500">
          Coordination : {ownerFirstName}
          {ownerPhone ? ` · ${ownerPhone}` : ""}. Document réservé à l’équipe affectée.
        </p>
        {demoMode ? <p className="mt-4 rounded-sm border border-clay-200 bg-clay-100 px-3 py-2 text-[13px] text-clay-800">Brief de démonstration : données fictives.</p> : null}
      </header>
      <dl className="mt-6 divide-y divide-sage-100">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 py-3 sm:grid-cols-[220px_1fr] sm:gap-6">
            <dt className="text-[13px] font-semibold text-ink-500">{label}</dt>
            <dd className="text-[15px]">{value}</dd>
          </div>
        ))}
      </dl>
      {event.scheduleNotes ? (
        <section className="mt-6">
          <h2 className="font-sans text-lg font-semibold">Organisation prévue</h2>
          <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-line">{event.scheduleNotes}</p>
        </section>
      ) : null}
      {event.venueAccessInfo || event.venueConstraints || event.venueChildrenSpaces ? (
        <section className="mt-6">
          <h2 className="font-sans text-lg font-semibold">Le lieu</h2>
          <dl className="mt-2 grid gap-3 text-[15px]">
            {event.venueChildrenSpaces ? (
              <div>
                <dt className="text-[13px] font-semibold text-ink-500">Espaces pour les enfants</dt>
                <dd>{event.venueChildrenSpaces}</dd>
              </div>
            ) : null}
            {event.venueConstraints ? (
              <div>
                <dt className="text-[13px] font-semibold text-ink-500">Points de vigilance</dt>
                <dd>{event.venueConstraints}</dd>
              </div>
            ) : null}
            {event.venueAccessInfo ? (
              <div>
                <dt className="text-[13px] font-semibold text-ink-500">Accès</dt>
                <dd>{event.venueAccessInfo}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}
      <section className="mt-6">
        <h2 className="font-sans text-lg font-semibold">Équipe affectée</h2>
        {team.length ? (
          <ul className="mt-2 divide-y divide-sage-100 text-[15px]">
            {team.map((member) => (
              <li key={member.displayName} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span className="font-medium">
                  {member.displayName}
                  {member.roleLabel ? <span className="ml-2 text-[13px] text-ink-500">{member.roleLabel}</span> : null}
                </span>
                {member.phone ? <span className="tabular text-ink-700">{member.phone}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[15px] text-ink-500">Équipe en cours de constitution.</p>
        )}
      </section>
      {checklist?.length ? (
        <section className="mt-6">
          <h2 className="font-sans text-lg font-semibold">Préparation</h2>
          <ul className="mt-2 grid gap-1.5 text-[15px]">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-start gap-2">
                <span aria-hidden="true" className={`mt-1.5 size-3 shrink-0 rounded-full border ${item.isDone ? "border-sage-700 bg-sage-700" : "border-sage-400"}`} />
                <span className={item.isDone ? "text-ink-500 line-through" : ""}>{item.label}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="mt-8 border-t border-sage-200 pt-4 text-[13px] leading-relaxed text-ink-500">Ce brief ne contient aucune information nominative ou médicale sur les enfants. Les consignes particulières sont transmises de vive voix par les parents à l’arrivée.</p>
    </article>
  );
}
