import { getEnv } from "@/lib/env";

/** Visible reminder that everything is fictitious and nothing leaves the machine. */
export function DemoBanner({ compact = false }: { compact?: boolean }) {
  const env = getEnv();
  if (!env.DEMO_MODE) return null;
  return (
    <div className="no-print border-b border-clay-200 bg-clay-100 text-clay-800" role="note">
      <p className={`container-page text-[13px] leading-snug ${compact ? "py-1.5" : "py-2"}`}>
        <span className="font-semibold">Mode démonstration.</span> Données fictives, aucun envoi réel : les emails sont visibles dans Mailpit sur{" "}
        <a href="http://localhost:8026" className="underline" target="_blank" rel="noreferrer">
          localhost:8026
        </a>
        . Site non indexable.
      </p>
    </div>
  );
}
