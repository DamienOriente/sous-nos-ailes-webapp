import type { Metadata } from "next";
import Link from "next/link";
import { ProviderVettingStatus } from "@/generated/prisma/enums";
import { listProviders } from "@/server/services/providers";
import { VETTING_STATUS_LABELS } from "@/domain/labels";
import { formatEuros } from "@/lib/money";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { Button, LinkButton } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { COST_BASIS_LABELS, VettingBadge } from "@/components/admin/badges";

export const metadata: Metadata = { title: "Intervenant·es" };

const VETTING = Object.values(ProviderVettingStatus);

export default async function ProvidersPage({ searchParams }: PageProps<"/admin/intervenants">) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const vettingParam = typeof params.vetting === "string" ? params.vetting : "ALL";
  const vetting = VETTING.includes(vettingParam as ProviderVettingStatus) ? (vettingParam as ProviderVettingStatus) : "ALL";
  const providers = await listProviders({ search: search || undefined, vetting });
  const isFiltered = Boolean(search) || vetting !== "ALL";

  return (
    <>
      <PageHeader
        title="Intervenant·es"
        description="Le réseau d’indépendant·es que vous choisissez et vérifiez vous-même. Les coûts sont internes."
        actions={<LinkButton href="/admin/intervenants/nouveau">Ajouter un profil</LinkButton>}
      />

      <form method="get" className="grid gap-4 rounded-md border border-sage-200 bg-ivory-50 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" aria-label="Filtrer les intervenant·es">
        <Field label="Recherche" htmlFor="pv-q" help="Prénom d’affichage, commune ou secteur.">
          <Input id="pv-q" name="q" type="search" defaultValue={search} maxLength={120} />
        </Field>
        <Field label="Vérification" htmlFor="pv-vetting">
          <Select id="pv-vetting" name="vetting" defaultValue={vetting}>
            <option value="ALL">Tous les statuts</option>
            {VETTING.map((status) => (
              <option key={status} value={status}>
                {VETTING_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex gap-2 pb-0.5">
          <Button type="submit" variant="secondary" size="sm" className="h-11">
            Filtrer
          </Button>
          {isFiltered ? (
            <LinkButton href="/admin/intervenants" variant="ghost" size="sm" className="h-11">
              Réinitialiser
            </LinkButton>
          ) : null}
        </div>
      </form>

      {providers.length ? (
        <Table>
          <thead>
            <tr>
              <Th>Personne</Th>
              <Th>Commune et secteur</Th>
              <Th>Vérification</Th>
              <Th>Qualifications</Th>
              <Th className="text-right">Missions</Th>
              <Th className="text-right">Coût convenu</Th>
            </tr>
          </thead>
          <tbody>
            {providers.map((provider) => {
              const verified = provider.qualifications.filter((q) => q.status === "VERIFIED").length;
              return (
                <tr key={provider.id}>
                  <Td className="min-w-44">
                    <Link href={`/admin/intervenants/${provider.id}`} className="font-semibold text-sage-800 hover:underline">
                      {provider.displayName}
                    </Link>
                    <span className="block text-[13px] text-ink-500">{provider.user.email}</span>
                    {!provider.isActive ? (
                      <StatusBadge tone="neutral" className="mt-1">
                        Profil inactif
                      </StatusBadge>
                    ) : null}
                  </Td>
                  <Td className="min-w-44">
                    {provider.city}
                    <span className="block text-[13px] text-ink-500">{provider.sector}</span>
                  </Td>
                  <Td>
                    <VettingBadge status={provider.vettingStatus} />
                  </Td>
                  <Td className="whitespace-nowrap tabular">
                    {provider.qualifications.length} déclarée{provider.qualifications.length > 1 ? "s" : ""}
                    <span className="block text-[13px] text-ink-500">
                      {verified} vérifiée{verified > 1 ? "s" : ""}
                    </span>
                  </Td>
                  <Td className="text-right tabular">{provider._count.assignments}</Td>
                  <Td className="text-right whitespace-nowrap tabular">
                    {formatEuros(provider.agreedCostCents)}
                    <span className="block text-[13px] text-ink-500">{COST_BASIS_LABELS[provider.costBasis]}</span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      ) : (
        <EmptyState title={isFiltered ? "Aucun profil ne correspond" : "Aucun profil pour l’instant"} description={isFiltered ? "Modifiez la recherche ou le statut." : "Créez le premier profil : la personne reçoit un lien de connexion par email."} action={<LinkButton href={isFiltered ? "/admin/intervenants" : "/admin/intervenants/nouveau"} variant="secondary">{isFiltered ? "Voir tous les profils" : "Ajouter un profil"}</LinkButton>} />
      )}
    </>
  );
}
