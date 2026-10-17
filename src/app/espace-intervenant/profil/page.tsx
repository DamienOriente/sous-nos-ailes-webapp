import type { Metadata } from "next";
import { requireProvider } from "@/server/authz";
import { listQualificationsForProvider } from "@/server/services/portal-extras";
import { getSettings } from "@/server/services/settings";
import { QUALIFICATION_STATUS_LABELS, VETTING_STATUS_LABELS } from "@/domain/labels";
import { PageHeader } from "@/components/ui/page-header";
import { LabelCard } from "@/components/ui/label-card";
import { DataList } from "@/components/ui/data-list";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProviderProfileForm } from "@/components/portal/provider-profile-form";
import { QualificationForm } from "@/components/portal/qualification-form";
import { QUALIFICATION_STATUS_TONES } from "@/components/portal/tones";

export const metadata: Metadata = { title: "Mon profil" };

export default async function ProviderProfilePage() {
  const { user, profile } = await requireProvider("/espace-intervenant/profil");
  const [qualifications, settings] = await Promise.all([listQualificationsForProvider(profile.id), getSettings()]);
  const owner = settings.ownerFirstName;
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Mon profil" description={`Ce que ${owner} voit de vous lorsqu’elle constitue une équipe. Les conditions de rémunération se règlent directement avec elle et n’apparaissent pas ici.`} />

      <section aria-labelledby="identity-title" className="flex flex-col gap-4">
        <h2 id="identity-title" className="font-sans text-lg font-semibold text-ink-900">
          Identité
        </h2>
        <LabelCard>
          <DataList
            columns={2}
            items={[
              { label: "Nom", value: user.name },
              { label: "Adresse email", value: user.email },
              { label: "Statut du profil", value: VETTING_STATUS_LABELS[profile.vettingStatus] },
            ]}
          />
          <p className="mt-4 text-sm leading-snug text-ink-500">
            La vérification est effectuée manuellement par {owner} ; elle ne constitue pas une certification. Pour modifier votre nom ou votre adresse email, contactez {owner}.
          </p>
        </LabelCard>
      </section>

      <section aria-labelledby="profile-title" className="flex flex-col gap-4">
        <h2 id="profile-title" className="font-sans text-lg font-semibold text-ink-900">
          Présentation
        </h2>
        <LabelCard>
          <ProviderProfileForm
            ownerFirstName={owner}
            values={{ displayName: profile.displayName, city: profile.city, postalCode: profile.postalCode, sector: profile.sector, bio: profile.bio, skills: profile.skills }}
          />
        </LabelCard>
      </section>

      <section aria-labelledby="qualifications-title" className="flex flex-col gap-4">
        <h2 id="qualifications-title" className="font-sans text-lg font-semibold text-ink-900">
          Qualifications
        </h2>
        {qualifications.length ? (
          <ul className="divide-y divide-sage-100 rounded-md border border-sage-200 bg-ivory-50">
            {qualifications.map((qualification) => (
              <li key={qualification.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[15px] font-medium text-ink-900">{qualification.label}</span>
                  {qualification.issuer || qualification.year ? (
                    <span className="text-sm text-ink-500">
                      {[qualification.issuer, qualification.year ? String(qualification.year) : null].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                </span>
                <StatusBadge tone={QUALIFICATION_STATUS_TONES[qualification.status]} className="self-start sm:self-center">
                  {QUALIFICATION_STATUS_LABELS[qualification.status]}
                </StatusBadge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] leading-snug text-ink-500">Aucune qualification déclarée pour le moment.</p>
        )}
        <LabelCard title="Déclarer une qualification">
          <p className="mt-1 mb-4 text-sm leading-snug text-ink-500">Une qualification déclarée reste « déclarée » jusqu’à ce que {owner} l’ait vérifiée avec vous.</p>
          <QualificationForm />
        </LabelCard>
      </section>
    </div>
  );
}
