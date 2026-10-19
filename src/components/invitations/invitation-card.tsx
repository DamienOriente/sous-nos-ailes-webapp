import { cn } from "@/lib/utils";
import type { InvitationTemplateKey } from "@/modules/invitations/domain/templates";

export type InvitationCardData = {
  templateKey: string;
  recipientName: string;
  customMessage: string | null;
  eventName: string;
  eventType: string;
  eventDate: string | null;
  startsAt: Date | null;
  timezone: string;
  venueName: string | null;
  city: string | null;
  showDate: boolean;
  showVenue: boolean;
};

function formatLongDate(date: string, timezone: string): string {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: timezone }).format(new Date(`${date}T12:00:00Z`));
}
function formatTime(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(d);
}

const EVENT_WORD: Record<string, string> = { wedding: "au mariage de", baptism: "au baptême de", birthday: "à l'anniversaire de", seminar: "au séminaire", corporate: "à l'évènement", family_gathering: "à la réunion de famille", other: "à" };

/**
 * Printable invitation card. Four templates share one data shape and one type
 * scale; styles are Tailwind classes (flat colours, so they print as shown).
 */
export function InvitationCard({ data, qrDataUrl, className }: { data: InvitationCardData; qrDataUrl?: string | null; className?: string }) {
  const key = (["classic", "rustic", "modern", "kids"].includes(data.templateKey) ? data.templateKey : "classic") as InvitationTemplateKey;
  const date = data.showDate && data.eventDate ? formatLongDate(data.eventDate, data.timezone) : null;
  const time = data.showDate && data.startsAt ? formatTime(data.startsAt, data.timezone) : null;
  const place = data.showVenue ? [data.venueName, data.city].filter(Boolean).join(" · ") : "";
  const body = (
    <>
      <p className="invitation-recipient">{data.recipientName},</p>
      <p className="invitation-lead">vous êtes invité(e) {EVENT_WORD[data.eventType] ?? "à"}</p>
      <h2 className="invitation-title">{data.eventName}</h2>
      {date && (
        <p className="invitation-date">
          {date}
          {time ? ` · ${time}` : ""}
        </p>
      )}
      {place && <p className="invitation-place">{place}</p>}
      {data.customMessage && <p className="invitation-message">{data.customMessage}</p>}
      {qrDataUrl && (
        <figure className="invitation-qr">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL generated server side */}
          <img src={qrDataUrl} alt="QR code d'accès (code anonyme à présenter à l'entrée)" width={112} height={112} />
          <figcaption>Code d'accès à présenter à l'entrée</figcaption>
        </figure>
      )}
    </>
  );

  // Layout and type scale are shared; each template only changes the paper, the ink and the alignment.
  const base = [
    "invitation-card relative mx-auto flex aspect-[1/1.414] w-full max-w-sm flex-col items-center justify-center overflow-hidden rounded-2xl p-9 text-center print:max-w-none print:rounded-none",
    "[&_.invitation-recipient]:text-base [&_.invitation-recipient]:italic",
    "[&_.invitation-lead]:mt-1 [&_.invitation-lead]:text-sm [&_.invitation-lead]:opacity-80",
    "[&_.invitation-title]:mt-5 [&_.invitation-title]:font-heading [&_.invitation-title]:text-4xl [&_.invitation-title]:leading-tight [&_.invitation-title]:font-semibold [&_.invitation-title]:text-balance",
    "[&_.invitation-date]:mt-6 [&_.invitation-date]:text-base [&_.invitation-date]:font-semibold [&_.invitation-date]:first-letter:capitalize",
    "[&_.invitation-place]:mt-1 [&_.invitation-place]:text-sm [&_.invitation-place]:opacity-80",
    "[&_.invitation-message]:mt-6 [&_.invitation-message]:max-w-[22rem] [&_.invitation-message]:text-sm [&_.invitation-message]:leading-relaxed [&_.invitation-message]:whitespace-pre-wrap [&_.invitation-message]:italic",
    "[&_.invitation-qr]:mt-7 [&_.invitation-qr]:flex [&_.invitation-qr]:flex-col [&_.invitation-qr]:items-center [&_.invitation-qr]:gap-1.5",
    "[&_.invitation-qr_img]:rounded-md [&_.invitation-qr_img]:bg-white [&_.invitation-qr_img]:p-1",
    "[&_.invitation-qr_figcaption]:text-[11px] [&_.invitation-qr_figcaption]:opacity-80",
  ].join(" ");

  switch (key) {
    case "rustic":
      return (
        <article className={cn(base, "border border-sage/60 bg-[#f6f2e8] text-[#3f3a30] [&_.invitation-date]:text-sage-deep", className)} data-template="rustic">
          {body}
        </article>
      );
    case "modern":
      return (
        <article className={cn(base, "items-start bg-[#1f2124] text-left text-[#f7f5f0] [&_.invitation-title]:text-5xl [&_.invitation-date]:w-full [&_.invitation-date]:border-t [&_.invitation-date]:border-gold [&_.invitation-date]:pt-4 [&_.invitation-date]:text-gold", className)} data-template="modern">
          {body}
        </article>
      );
    case "kids":
      return (
        <article className={cn(base, "bg-[#fdf3f6] text-[#4a4a5e] [&_.invitation-title]:text-[#4f77a3] [&_.invitation-date]:text-[#4f77a3]", className)} data-template="kids">
          {body}
        </article>
      );
    default:
      return (
        <article className={cn(base, "border border-[#d9d2c3] bg-white text-[#2f3437] [&_.invitation-date]:text-sage-deep", className)} data-template="classic">
          <span aria-hidden="true" className="pointer-events-none absolute inset-3 rounded-xl border border-[#d9d2c3]" />
          {body}
        </article>
      );
  }
}
