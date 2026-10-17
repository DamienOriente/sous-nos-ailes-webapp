/**
 * "Prochaines actions" of the home page: concrete, dated suggestions derived
 * from the read model (pure, testable). Ordered by urgency; the caller shows
 * the first few. Every action names the thing it concerns, never a generic
 * "complete your profile".
 */
export type NextAction = {
  key: string;
  title: string;
  detail: string;
  href: string;
  tone: "warning" | "primary" | "neutral";
};

export type NextActionInput = {
  today: Date;
  emailVerified: boolean;
  twoFactorRequiredButMissing: boolean;
  unreadCount: number;
  events: Array<{ id: string; name: string; eventDate: string | null; expectedChildren: number | null; status: string; role: string }>;
  professionals: Array<{ id: string; displayName: string; status: string; completenessScore: number }>;
};

const DAY = 86_400_000;

function daysUntil(iso: string, today: Date): number {
  const d = new Date(`${iso}T12:00:00Z`).getTime();
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 12);
  return Math.round((d - t) / DAY);
}

export function deriveNextActions(input: NextActionInput, limit = 4): NextAction[] {
  const out: NextAction[] = [];
  if (!input.emailVerified) out.push({ key: "verify-email", title: "Confirmer votre adresse e-mail", detail: "Sans confirmation, aucune notification ne vous parvient par e-mail.", href: "/verification-email", tone: "warning" });
  if (input.twoFactorRequiredButMissing) out.push({ key: "two-factor", title: "Activer la double authentification", detail: "Obligatoire pour votre rôle : un code à chaque nouvelle connexion.", href: "/app/compte/securite#double-authentification", tone: "warning" });

  for (const p of input.professionals) {
    const name = p.displayName.trim() || "votre fiche";
    if (p.status === "draft") out.push({ key: `pro-draft-${p.id}`, title: `Terminer l'inscription de ${name}`, detail: `Fiche complète à ${p.completenessScore} % : reprenez là où vous vous étiez arrêté.`, href: `/onboarding/professionnel?id=${p.id}&step=2`, tone: "primary" });
    else if (p.status === "changes_requested") out.push({ key: `pro-changes-${p.id}`, title: `Répondre aux modifications demandées sur ${name}`, detail: "Notre équipe a laissé un motif précis ; la fiche repart en relecture dès l'enregistrement.", href: `/app/pro/${p.id}`, tone: "warning" });
    else if (p.completenessScore < 70) out.push({ key: `pro-complete-${p.id}`, title: `Compléter ${name} (${p.completenessScore} %)`, detail: "Une fiche complète est mieux classée dans l'annuaire.", href: `/app/pro/${p.id}`, tone: "neutral" });
  }

  for (const e of input.events) {
    const organiser = e.role === "owner" || e.role === "lead_organizer" || e.role === "co_organizer" || e.role === "wedding_planner";
    if (!e.eventDate) {
      if (organiser) out.push({ key: `event-date-${e.id}`, title: `Fixer la date de ${e.name}`, detail: "La liste de tâches et les échéances se calculent à partir de la date.", href: `/app/evenements/${e.id}/parametres`, tone: "primary" });
      continue;
    }
    const days = daysUntil(e.eventDate, input.today);
    if (days < 0) continue;
    if (days <= 7) out.push({ key: `event-week-${e.id}`, title: `${e.name} : partager le planning du jour J`, detail: days === 0 ? "C'est aujourd'hui." : `Dans ${days} jour${days > 1 ? "s" : ""} : chaque prestataire doit avoir le déroulé.`, href: `/app/evenements/${e.id}/planning`, tone: "warning" });
    else if (organiser && (e.expectedChildren ?? 0) > 0 && days <= 120) out.push({ key: `event-childcare-${e.id}`, title: `Réserver la garde d'enfants pour ${e.name}`, detail: `${e.expectedChildren} enfant${(e.expectedChildren ?? 0) > 1 ? "s" : ""} annoncé${(e.expectedChildren ?? 0) > 1 ? "s" : ""}, dans ${days} jours : les professionnels se réservent 3 mois à l'avance.`, href: `/app/evenements/${e.id}/prestataires`, tone: "primary" });
    else if (organiser && days <= 45) out.push({ key: `event-guests-${e.id}`, title: `Relancer les invités sans réponse pour ${e.name}`, detail: `Dans ${days} jours : le traiteur attend le nombre de convives.`, href: `/app/evenements/${e.id}/invites`, tone: "neutral" });
  }

  if (input.unreadCount > 0) out.push({ key: "notifications", title: `Lire ${input.unreadCount} notification${input.unreadCount > 1 ? "s" : ""} non lue${input.unreadCount > 1 ? "s" : ""}`, detail: "Invitations, demandes et décisions de modération.", href: "/app/notifications", tone: "neutral" });

  const rank = { warning: 0, primary: 1, neutral: 2 };
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]).slice(0, limit);
}
