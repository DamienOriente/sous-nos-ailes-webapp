import { cn, formatDateFr } from "@/lib/utils";
import type { EventShowcase } from "@/modules/directory/application/public-showcase";
import { DemoLabel } from "./photo-frame";

/**
 * Miniature, read-only renderings of the organiser's tools, fed with the real
 * demo event rows (never invented numbers). They are rendered in React so they
 * stay crisp, themable and accessible; they are not screenshots.
 */

const EVENT_TYPE_LABELS: Record<string, string> = {
  wedding: "Mariage",
  baptism: "Baptême",
  birthday: "Anniversaire",
  seminar: "Séminaire",
  corporate: "Évènement d'entreprise",
  family_gathering: "Réunion de famille",
  other: "Évènement",
};

const PROVIDER_STATUS: Record<string, { label: string; tone: string }> = {
  confirmed: { label: "Confirmé", tone: "bg-success/15 text-sage-deep dark:text-success" },
  quoted: { label: "Devis reçu", tone: "bg-info/15 text-[oklch(0.42_0.1_235)] dark:text-info" },
  requested: { label: "Demande envoyée", tone: "bg-gold/20 text-foreground" },
  shortlisted: { label: "Présélection", tone: "bg-muted text-muted-foreground" },
  declined: { label: "Décliné", tone: "bg-muted text-muted-foreground" },
  cancelled: { label: "Annulé", tone: "bg-muted text-muted-foreground" },
};

/** Days between today (Europe/Paris calendar) and a YYYY-MM-DD date. */
export function daysUntil(isoDate: string, now = new Date()): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const target = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / 86_400_000);
}

function Panel({ title, children, className, footer }: { title: string; children: React.ReactNode; className?: string; footer?: React.ReactNode }) {
  return (
    <div className={cn("min-w-0 overflow-hidden rounded-3xl border bg-card", className)}>
      <div className="border-b bg-muted/60 px-4 py-2.5 text-sm font-semibold">{title}</div>
      <div className="p-4">{children}</div>
      {footer && <div className="border-t px-4 py-2.5 text-xs text-muted-foreground">{footer}</div>}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl bg-muted/70 p-3">
      <p className="font-heading text-2xl font-semibold leading-none">{value}</p>
      <p className="mt-1.5 text-xs font-medium">{label}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** The organiser's "tour de contrôle": counters, checklist progress, next moments. */
export function ControlTowerMockup({ event, className }: { event: EventShowcase; className?: string }) {
  const days = event.eventDate ? daysUntil(event.eventDate) : null;
  const pct = event.tasks.total ? Math.round((event.tasks.done / event.tasks.total) * 100) : 0;
  return (
    <Panel title="Tour de contrôle" className={className} footer={event.isDemo ? <DemoLabel>Données de démonstration, évènement fictif</DemoLabel> : undefined}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <p className="font-heading text-lg font-semibold leading-tight">{event.name}</p>
          <p className="text-sm text-muted-foreground">
            {EVENT_TYPE_LABELS[event.type] ?? "Évènement"}
            {event.eventDate ? ` · ${formatDateFr(event.eventDate)}` : ""}
            {event.city ? ` · ${event.city}` : ""}
          </p>
        </div>
        {days !== null && days >= 0 && (
          <p className="rounded-full bg-sage-soft px-3 py-1 text-sm font-medium text-sage-deep dark:text-foreground">
            J−{days}
          </p>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Invités confirmés" value={`${event.guests.accepted}/${event.guests.total}`} hint={event.guests.pending ? `${event.guests.pending} sans réponse` : undefined} />
        <Stat label="Prestataires" value={event.providers.confirmed} hint={event.providers.pending ? `${event.providers.pending} en cours` : "tous confirmés"} />
        <Stat label="Enfants inscrits" value={event.children.total} hint={event.children.youngest !== null && event.children.oldest !== null ? `de ${event.children.youngest} à ${event.children.oldest} ans` : undefined} />
        <Stat label="Tâches faites" value={`${event.tasks.done}/${event.tasks.total}`} hint={`${pct} %`} />
      </div>
      {event.tasks.sections.length > 0 && (
        <ul className="mt-4 space-y-1.5" aria-label="Avancement par étape">
          {event.tasks.sections.slice(0, 5).map((s) => {
            const p = s.total ? Math.round((s.done / s.total) * 100) : 0;
            return (
              <li key={s.section} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-2 text-xs">
                <span className="truncate font-medium">{s.section}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <span className="block h-full rounded-full bg-sage" style={{ width: `${p}%` }} />
                </span>
                <span className="text-right text-muted-foreground">
                  {s.done}/{s.total}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {event.milestones.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold">Planning du jour J</p>
          <ol className="mt-1.5 divide-y text-sm">
            {event.milestones.slice(0, 4).map((m) => (
              <li key={`${m.title}-${m.startsAt.toISOString()}`} className="flex items-baseline gap-3 py-1.5">
                <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">{formatDateFr(m.startsAt, { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="flex-1 truncate">{m.title}</span>
                {m.location && <span className="hidden truncate text-xs text-muted-foreground sm:inline">{m.location}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </Panel>
  );
}

/** The providers list as the organiser sees it (status per provider slot). */
export function ProvidersMockup({ event, className }: { event: EventShowcase; className?: string }) {
  return (
    <Panel title="Prestataires" className={className} footer={event.isDemo ? <DemoLabel>Données de démonstration</DemoLabel> : undefined}>
      <ul className="divide-y text-sm">
        {event.providers.list.slice(0, 7).map((p) => {
          const st = PROVIDER_STATUS[p.status] ?? { label: p.status, tone: "bg-muted" };
          return (
            <li key={`${p.name}-${p.status}`} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.name}</span>
                {p.category && <span className="block text-xs text-muted-foreground">{p.category}</span>}
              </span>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", st.tone)}>{st.label}</span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/** Seating plan: real table positions from the demo event on the 1000×700 canvas. */
export function SeatingPlanMockup({ event, className }: { event: EventShowcase; className?: string }) {
  const tables = event.seating.tables;
  if (tables.length === 0) return null;
  const total = tables.reduce((n, t) => n + t.capacity, 0);
  return (
    <Panel title="Plan de table" className={className} footer={<span>{event.seating.seated} invités placés sur {total} places{event.isDemo ? ". Données de démonstration." : ""}</span>}>
      <svg viewBox="0 0 1000 640" className="mx-auto h-auto w-full max-w-3xl" role="img" aria-label={`Plan de table avec ${tables.length} tables`}>
        <rect x="0" y="0" width="1000" height="640" rx="28" fill="var(--sna-sand)" opacity="0.35" />
        <rect x="380" y="20" width="240" height="40" rx="10" fill="var(--sna-sage-soft)" />
        <text x="500" y="46" textAnchor="middle" fontSize="20" fill="var(--sna-sage-deep)" fontFamily="var(--font-sans)">
          Piste de danse
        </text>
        {tables.map((t) => {
          const full = t.seated >= t.capacity;
          const w = t.shape === "rectangle" ? 200 : t.shape === "oval" ? 150 : 110;
          const h = t.shape === "rectangle" ? 80 : t.shape === "oval" ? 90 : 110;
          const r = t.shape === "square" ? 14 : t.shape === "rectangle" ? 16 : Math.min(w, h) / 2;
          const x = Math.min(Math.max(t.x, w / 2), 1000 - w / 2);
          const y = Math.min(Math.max(t.y + 60, h / 2 + 70), 640 - h / 2 - 10);
          return (
            <g key={t.name} transform={`translate(${x} ${y})`}>
              <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={r} fill={full ? "var(--sna-sage)" : "var(--card)"} stroke="var(--sna-sage-deep)" strokeWidth="3" />
              <text y="-4" textAnchor="middle" fontSize="20" fontWeight="600" fill={full ? "var(--sna-ivory)" : "var(--sna-charcoal)"} fontFamily="var(--font-sans)">
                {t.name}
              </text>
              <text y="22" textAnchor="middle" fontSize="17" fill={full ? "var(--sna-ivory)" : "var(--sna-charcoal-soft)"} fontFamily="var(--font-sans)">
                {t.seated}/{t.capacity}
              </text>
            </g>
          );
        })}
      </svg>
    </Panel>
  );
}

/** Kids space as the care team sees it: first names, ages, care team, children's moments. */
export function KidsSpaceMockup({ event, className }: { event: EventShowcase; className?: string }) {
  const kidsMoments = event.milestones.filter((m) => /enfant|goûter|sieste|petits/i.test(m.title)).slice(0, 3);
  return (
    <Panel title="Espace enfants" className={className} footer={<span>Réservé à l'équipe de garde. Allergies et consignes médicales chiffrées, jamais affichées ici.{event.isDemo ? " Données de démonstration." : ""}</span>}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-medium">{event.children.total} enfant{event.children.total > 1 ? "s" : ""} inscrit{event.children.total > 1 ? "s" : ""}</span>
        {event.careTeam > 0 && (
          <span className="text-muted-foreground">
            {event.careTeam} personne{event.careTeam > 1 ? "s" : ""} de l'équipe de garde affectée{event.careTeam > 1 ? "s" : ""}
          </span>
        )}
      </div>
      {event.children.list.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Enfants inscrits (prénom et âge)">
          {event.children.list.map((c, i) => (
            <li key={`${c.firstName}-${c.ageYears}`} className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs", ["bg-blush/60", "bg-sky/60", "bg-sage-soft", "bg-sand"][i % 4])}>
              <span className="font-medium">{c.firstName}</span>
              <span className="text-muted-foreground">{c.ageYears} ans</span>
            </li>
          ))}
        </ul>
      )}
      {kidsMoments.length > 0 && (
        <ol className="mt-4 space-y-1.5 text-sm">
          {kidsMoments.map((m) => (
            <li key={m.title} className="flex items-center gap-3">
              <span className="w-11 shrink-0 text-xs text-muted-foreground tabular-nums">{formatDateFr(m.startsAt, { hour: "2-digit", minute: "2-digit" })}</span>
              <span className="truncate">{m.title}</span>
            </li>
          ))}
        </ol>
      )}
      <ul className="mt-4 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
        {["Présences : arrivée et départ horodatés", "Remise uniquement aux personnes autorisées", "Consignes des parents, accès journalisé", "Anonymisation automatique après l'évènement"].map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </Panel>
  );
}

/**
 * What a quote request looks like once sent. Static example clearly marked as
 * such: it mirrors the real inquiry form fields on a professional's page.
 */
export function InquiryExample({ professionalName, categoryName, className }: { professionalName?: string; categoryName?: string; className?: string }) {
  const rows = [
    ["Type d'évènement", "Mariage"],
    ["Date envisagée", "samedi 12 juin 2027"],
    ["Lieu", "Lavaur (81)"],
    ["Invités", "120, dont 9 enfants de 2 à 11 ans"],
    ["Besoin", "Garde et animation de 12 h 30 à 23 h, espace sieste pour les plus petits"],
  ];
  return (
    <div data-testid="inquiry-example" className={cn("min-w-0 overflow-hidden rounded-3xl border bg-card", className)}>
      <div className="flex items-center justify-between gap-3 border-b bg-muted/60 px-4 py-2.5">
        <p className="text-sm font-semibold">Demande de devis{professionalName ? ` à ${professionalName}` : ""}</p>
        <DemoLabel>Exemple</DemoLabel>
      </div>
      <dl className="divide-y px-4 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-0.5 py-2.5 sm:grid-cols-[9rem_1fr] sm:gap-4">
            <dt className="text-xs font-medium text-muted-foreground sm:pt-0.5">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="border-t px-4 py-3 text-xs leading-5 text-muted-foreground">
        Le professionnel{categoryName ? ` (${categoryName.toLowerCase()})` : ""} reçoit la demande dans son espace et répond par e-mail. Aucune donnée de santé ne transite par ce formulaire : les consignes des parents se renseignent plus tard, dans l'espace enfants chiffré de l'évènement.
      </p>
    </div>
  );
}
