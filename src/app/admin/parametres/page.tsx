import type { Metadata } from "next";
import Link from "next/link";
import { getSettings, listAllOptions } from "@/server/services/settings";
import { getEnv } from "@/lib/env";
import { centsToEuroInput, formatEuros } from "@/lib/money";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { LinkButton } from "@/components/ui/button";
import { AdminSection, HelpText } from "@/components/admin/section";
import { PRICING_UNIT_LABELS } from "@/components/admin/badges";
import { SettingsForm } from "@/components/admin/settings-form";
import { OptionForm } from "@/components/admin/option-form";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage({ searchParams }: PageProps<"/admin/parametres">) {
  const query = await searchParams;
  const [settings, options] = await Promise.all([getSettings(), listAllOptions()]);
  const env = getEnv();
  const editingId = typeof query.option === "string" ? query.option : null;
  const editing = editingId ? options.find((option) => option.id === editingId) ?? null : null;

  return (
    <>
      <PageHeader title="Paramètres" description="Identité, tarification, repères d’encadrement et options. Tout ce qui alimente le site public, les propositions et les suggestions d’équipe." />

      <AdminSection id="reglages" title="Réglages généraux">
        <SettingsForm
          demoMode={env.DEMO_MODE}
          values={{
            brandName: settings.brandName,
            tagline: settings.tagline,
            ownerFirstName: settings.ownerFirstName,
            contactEmail: settings.contactEmail,
            contactPhone: settings.contactPhone,
            areaLabel: settings.areaLabel,
            hourlyRate: centsToEuroInput(settings.hourlyRateCents),
            minimumHours: settings.minimumHours,
            minimumAmount: settings.minimumAmountCents ? centsToEuroInput(settings.minimumAmountCents) : "",
            defaultTravelFee: centsToEuroInput(settings.defaultTravelFeeCents),
            nightSurchargeStartHour: settings.nightSurchargeStartHour,
            nightSurchargePercent: settings.nightSurchargePercent,
            sundaySurchargePercent: settings.sundaySurchargePercent,
            vatMode: settings.vatMode,
            vatRatePercent: centsToEuroInput(settings.vatRateBps),
            publicEstimateEnabled: settings.publicEstimateEnabled,
            publicEstimateMarginPct: settings.publicEstimateMarginPct,
            ratioUnder3: settings.ratioUnder3,
            ratio3to5: settings.ratio3to5,
            ratio6to10: settings.ratio6to10,
            ratio11plus: settings.ratio11plus,
            minProviders: settings.minProviders,
            travelBufferMinutes: settings.travelBufferMinutes,
            invitationExpiryHours: settings.invitationExpiryHours,
            dataRetentionMonths: settings.dataRetentionMonths,
          }}
        />
      </AdminSection>

      <AdminSection id="options" title="Options proposées" description="Prestations complémentaires que les clients peuvent cocher dans la demande et que le moteur ajoute aux propositions.">
        {options.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Libellé</Th>
                <Th className="text-right">Prix</Th>
                <Th>Unité</Th>
                <Th>État</Th>
                <Th className="text-right">Ordre</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {options.map((option) => (
                <tr key={option.id}>
                  <Td className="whitespace-nowrap tabular">{option.code}</Td>
                  <Td className="min-w-48">
                    {option.label}
                    {option.description ? <span className="block text-[13px] text-ink-500">{option.description}</span> : null}
                  </Td>
                  <Td className="text-right whitespace-nowrap tabular">{formatEuros(option.priceCents)}</Td>
                  <Td className="whitespace-nowrap">{PRICING_UNIT_LABELS[option.pricingUnit]}</Td>
                  <Td>{option.isActive ? <StatusBadge tone="sage">Proposée</StatusBadge> : <StatusBadge tone="neutral">Désactivée</StatusBadge>}</Td>
                  <Td className="text-right tabular">{option.sortOrder}</Td>
                  <Td className="whitespace-nowrap">
                    <Link href={`/admin/parametres?option=${option.id}#option-form`} className="font-semibold text-sage-800 hover:underline" aria-current={editing?.id === option.id ? "true" : undefined}>
                      Modifier
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <HelpText>Aucune option définie pour l’instant.</HelpText>
        )}

        <div id="option-form" className="rounded-md border border-sage-200 bg-ivory-50 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-sans text-[15px] font-semibold text-ink-900">{editing ? `Modifier l’option « ${editing.label} »` : "Nouvelle option"}</h3>
            {editing ? (
              <LinkButton href="/admin/parametres#option-form" variant="ghost" size="sm">
                Créer une nouvelle option à la place
              </LinkButton>
            ) : null}
          </div>
          <OptionForm
            key={editing?.id ?? "new"}
            option={
              editing
                ? { id: editing.id, code: editing.code, label: editing.label, description: editing.description, price: centsToEuroInput(editing.priceCents), pricingUnit: editing.pricingUnit, isActive: editing.isActive, sortOrder: editing.sortOrder }
                : undefined
            }
          />
        </div>
      </AdminSection>
    </>
  );
}
