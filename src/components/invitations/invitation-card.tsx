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
 * Printable invitation card. Four templates share one data shape; styles are
 * Tailwind classes (print-safe: `print:` variants keep the colours).
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

  const base = "invitation-card relative mx-auto flex aspect-[1/1.414] w-full max-w-sm flex-col items-center justify-center overflow-hidden rounded-2xl p-8 text-center shadow-soft print:shadow-none print:max-w-none print:rounded-none [&_.invitation-recipient]:italic [&_.invitation-lead]:text-sm [&_.invitation-title]:text-balance [&_.invitation-title]:font-heading [&_.invitation-title]:text-3xl [&_.invitation-title]:font-semibold [&_.invitation-date]:mt-4 [&_.invitation-date]:text-sm [&_.invitation-date]:font-medium [&_.invitation-place]:text-xs [&_.invitation-message]:mt-5 [&_.invitation-message]:whitespace-pre-wrap [&_.invitation-message]:text-sm [&_.invitation-message]:italic [&_.invitation-qr]:mt-6 [&_.invitation-qr]:flex [&_.invitation-qr]:flex-col [&_.invitation-qr]:items-center [&_.invitation-qr]:gap-1 [&_.invitation-qr_img]:rounded-md [&_.invitation-qr_img]:bg-white [&_.invitation-qr_img]:p-1 [&_.invitation-qr_figcaption]:text-[10px] [&_.invitation-qr_figcaption]:uppercase [&_.invitation-qr_figcaption]:tracking-wider";

  switch (key) {
    case "rustic":
      return (
        <article className={cn(base, "border border-sage/50 bg-[#f6f2e8] text-[#3f3a30] [&_.invitation-date]:text-sage-deep [&_.invitation-qr_figcaption]:text-sage-deep", className)} data-template="rustic">
          <svg aria-hidden="true" className="pointer-events-none absolute -top-6 -left-6 size-40 text-sage/40" viewBox="0 0 100 100" fill="currentColor">
            <path d="M50 5c10 20 30 30 45 45-15 15-35 25-45 45C40 75 20 65 5 50 20 35 40 25 50 5z" />
          </svg>
          <svg aria-hidden="true" className="pointer-events-none absolute -right-8 -bottom-8 size-44 rotate-45 text-sage/30" viewBox="0 0 100 100" fill="currentColor">
            <path d="M50 5c10 20 30 30 45 45-15 15-35 25-45 45C40 75 20 65 5 50 20 35 40 25 50 5z" />
          </svg>
          <p className="mb-6 text-[10px] font-semibold tracking-[0.3em] text-sage-deep uppercase">Invitation</p>
          {body}
        </article>
      );
    case "modern":
      return (
        <article className={cn(base, "bg-[#1f2124] text-[#f7f5f0] [&_.invitation-date]:text-gold [&_.invitation-title]:text-left [&_.invitation-title]:self-start [&_.invitation-title]:text-4xl [&_.invitation-recipient]:self-start [&_.invitation-lead]:self-start [&_.invitation-place]:self-start [&_.invitation-date]:self-start [&_.invitation-message]:self-start [&_.invitation-message]:text-left [&_.invitation-qr_figcaption]:text-gold", "items-start text-left", className)} data-template="modern">
          <span aria-hidden="true" className="absolute top-0 right-0 h-40 w-3 bg-gold" />
          <span aria-hidden="true" className="absolute bottom-0 left-0 h-3 w-40 bg-gold" />
          <p className="mb-8 text-[10px] font-semibold tracking-[0.3em] text-gold uppercase">Vous êtes attendu(e)</p>
          {body}
        </article>
      );
    case "kids":
      return (
        <article className={cn(base, "bg-[#fdf3f6] text-[#4a4a5e] [&_.invitation-date]:text-sky-deep [&_.invitation-title]:text-[#5b86b4] [&_.invitation-qr_figcaption]:text-sky-deep", className)} data-template="kids">
          {[
            ["8%", "10%", "text-blush-deep"],
            ["85%", "14%", "text-sky-deep"],
            ["12%", "80%", "text-gold"],
            ["80%", "78%", "text-blush-deep"],
            ["50%", "6%", "text-sky-deep"],
          ].map(([x, y, c], i) => (
            <svg key={i} aria-hidden="true" className={cn("pointer-events-none absolute size-5 opacity-70", c)} style={{ left: x, top: y }} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2.9 6.6L22 9.3l-5.4 4.7L18.2 21 12 17.3 5.8 21l1.6-7L2 9.3l7.1-.7L12 2z" />
            </svg>
          ))}
          <p className="mb-6 rounded-full bg-white/70 px-3 py-1 text-[10px] font-semibold tracking-[0.25em] text-sky-deep uppercase">Une belle fête</p>
          {body}
        </article>
      );
    default:
      return (
        <article className={cn(base, "border border-[#d9d2c3] bg-white text-[#2f3437] [&_.invitation-date]:text-sage-deep [&_.invitation-qr_figcaption]:text-sage-deep", className)} data-template="classic">
          <span aria-hidden="true" className="pointer-events-none absolute inset-3 rounded-xl border border-[#d9d2c3]" />
          <p className="mb-6 text-[10px] font-semibold tracking-[0.3em] text-sage-deep uppercase">Invitation</p>
          {body}
        </article>
      );
  }
}
