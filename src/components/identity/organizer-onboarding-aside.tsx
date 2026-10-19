"use client";
import { useCallback, useState } from "react";
import { EventForm, type EventFormProps, type EventFormValues } from "@/components/events/event-form";
import { DemoPhoto } from "@/components/shared/demo-photo";
import { Button } from "@/components/ui/button";
import { eventPhoto } from "@/modules/media/demo-photos";
import { EVENT_TYPE_LABELS, type EventType } from "@/modules/events/domain/event-types";

/**
 * Live summary of the event being created, fed by the form's `onChange`;
 * "Utiliser cet exemple" remounts the form with example values.
 */
type Summary = { type: EventType; who: string; name: string; eventDate: string; city: string; venueName: string; guests: string; children: string; budget: string };

const EXAMPLE: Summary = { type: "wedding", who: "Lisa", name: "Mariage de Louis et Lisa", eventDate: "2027-06-12", city: "Lavaur", venueName: "Domaine d'Hélène", guests: "90", children: "12", budget: "15000" };
const EXAMPLE_POSTAL = "81500";

const TIPS: Record<EventType, string> = {
  wedding: "Comptez les enfants dès maintenant : c'est ce qui dimensionne la garde et le coin jeux. Un mariage de 90 invités compte souvent 10 à 15 enfants.",
  baptism: "Une réception courte, beaucoup de tout-petits : pensez à un espace sieste et à un traiteur qui propose des menus enfants.",
  birthday: "Pour un anniversaire d'enfant, l'animation remplace la garde : un animateur pour 12 à 15 enfants est une bonne base.",
  seminar: "Le lieu et l'hébergement se réservent en premier ; ajoutez une garde d'enfants si des familles sont invitées à la soirée.",
  corporate: "Une garde d'enfants sur place rend la soirée accessible aux parents : prévoyez-la dans le budget dès le départ.",
  family_gathering: "Les cousins de tous âges : un coin enfants encadré permet aux adultes de profiter du repas.",
  other: "Donnez un nom clair et une date, même provisoire : la liste de tâches et le budget s'adaptent ensuite.",
};


export function OrganizerOnboardingAside({ firstName, form }: { firstName: string; form: Omit<EventFormProps, "initialValues" | "onChange"> }) {
  const [summary, setSummary] = useState<Summary>({ type: "wedding", who: "", name: "", eventDate: "", city: "", venueName: "", guests: "", children: "", budget: "" });
  const [exampleMode, setExampleMode] = useState(false);
  const onChange = useCallback((v: EventFormValues) => setSummary({ type: v.type, who: v.who, name: v.name, eventDate: v.eventDate, city: v.city, venueName: v.venueName, guests: v.guests, children: v.children, budget: v.budget }), []);

  const photo = eventPhoto(summary.type, 0);
  const title = summary.name || `${EVENT_TYPE_LABELS[summary.type]} de ${firstName}`;
  const dateLabel = summary.eventDate ? new Date(`${summary.eventDate}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "À fixer";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      {/* Remounting with a new key applies the example as initial values; the user then edits freely. */}
      <div>
        <EventForm key={exampleMode ? "example" : "blank"} {...form} initialValues={exampleMode ? { ...EXAMPLE, postalCode: EXAMPLE_POSTAL } : undefined} onChange={onChange} />
      </div>
      <aside className="space-y-5 lg:sticky lg:top-6" aria-label="Résumé de votre évènement">
        <article className="overflow-hidden rounded-2xl border bg-card shadow-soft" data-testid="event-summary">
          <div className="relative aspect-[16/9]">
            <DemoPhoto key={photo.id} photo={photo} width={640} height={360} sizes="(max-width: 1024px) 100vw, 352px" className="absolute inset-0" alt={`Photo d'ambiance de démonstration : ${EVENT_TYPE_LABELS[summary.type].toLowerCase()}`} />
          </div>
          <p className="border-b px-4 py-1.5 text-xs text-muted-foreground">Photo d'ambiance de démonstration</p>
          <div className="space-y-3 p-4">
            <div>
              <h2 className="font-heading text-lg leading-snug font-semibold">{title}</h2>
              <p className="text-sm text-muted-foreground">{EVENT_TYPE_LABELS[summary.type]}</p>
            </div>
            <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
              <Row label="Date" value={dateLabel} muted={!summary.eventDate} />
              <Row label="Lieu" value={[summary.venueName, summary.city].filter(Boolean).join(", ") || "À préciser"} muted={!summary.city && !summary.venueName} />
              <Row label="Invités" value={summary.guests || "À estimer"} muted={!summary.guests} />
              <Row label="Enfants" value={summary.children ? `${summary.children}, garde à prévoir` : "À estimer"} muted={!summary.children} />
              <Row label="Budget" value={summary.budget ? `${Number(summary.budget).toLocaleString("fr-FR")} €, indicatif` : "Facultatif"} muted={!summary.budget} />
            </dl>
          </div>
        </article>
        <p className="rounded-2xl border bg-accent/40 p-4 text-sm text-pretty">{TIPS[summary.type]}</p>
        <div className="space-y-3 rounded-2xl border border-dashed p-4 text-sm" data-testid="onboarding-example">
          <p className="font-medium">Exemple : Mariage de Louis et Lisa</p>
          <p className="text-muted-foreground">12 juin 2027 au domaine d'Hélène à Lavaur, 90 invités dont 12 enfants, budget 15 000 €.</p>
          {exampleMode ? (
            <p className="text-xs text-muted-foreground">L'exemple est appliqué à toutes les étapes ; modifiez librement chaque champ.</p>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setExampleMode(true)}>
              Utiliser cet exemple
            </Button>
          )}
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted: boolean }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={muted ? "text-muted-foreground" : "font-medium"}>{value}</dd>
    </>
  );
}
