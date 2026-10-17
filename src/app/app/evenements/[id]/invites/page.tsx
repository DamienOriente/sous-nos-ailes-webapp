import Link from "next/link";
import { notFound } from "next/navigation";
import { Baby, Check, Clock, Download, Plus, Upload, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { AddFromContactsDialog } from "@/components/guests/add-from-contacts-dialog";
import { GroupManager } from "@/components/guests/group-manager";
import { GuestFormDialog } from "@/components/guests/guest-form-dialog";
import { GuestsTable } from "@/components/guests/guests-table";
import { isAppError } from "@/lib/errors";
import { requireActor } from "@/lib/session";
import { can, requireEventPermission } from "@/modules/authorization";
import { RSVP_LABELS, RSVP_STATUSES, type RsvpStatus } from "@/modules/guests/domain/guests";
import { getGuestStats, listAddableContacts, listGroups, listGuests } from "@/modules/guests/application/guest-service";
import { addFromContactsAction, createGroupAction, createGuestAction, deleteGroupAction, deleteGuestAction, updateGroupAction, updateGuestAction } from "./actions";

export const metadata = { title: "Invités — Sous Nos Ailes" };

type Search = { q?: string; group?: string; rsvp?: string; enfants?: string };

export default async function GuestsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const { id } = await params;
  const sp = await searchParams;
  const actor = await requireActor(`/app/evenements/${id}/invites`);
  let access;
  try {
    access = await requireEventPermission(actor, id, "event.guests.view");
  } catch (e) {
    if (isAppError(e) && (e.code === "not_found" || e.code === "forbidden")) notFound();
    throw e;
  }
  const canManage = can(access, "event.guests.manage");
  const rsvp = RSVP_STATUSES.includes(sp.rsvp as RsvpStatus) ? (sp.rsvp as RsvpStatus) : undefined;
  const [guests, groups, stats, addable] = await Promise.all([
    listGuests(actor, id, { q: sp.q, groupId: sp.group, rsvp, children: sp.enfants === "1" }),
    listGroups(actor, id),
    getGuestStats(actor, id),
    canManage ? listAddableContacts(actor, id) : Promise.resolve([]),
  ]);
  const hasFilters = Boolean(sp.q || sp.group || rsvp || sp.enfants);
  const groupOptions = groups.map((g) => ({ id: g.id, name: g.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Évènement"
        title="Invités"
        description="Liste des invités, groupes et réponses. Les enfants peuvent ensuite être inscrits dans l'espace enfants pour la garde."
        actions={
          canManage ? (
            <>
              <Button asChild variant="outline" size="sm">
                <a href={`/api/events/${id}/guests/export`}>
                  <Download className="size-4" aria-hidden="true" /> Export CSV
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/app/evenements/${id}/invites/import`}>
                  <Upload className="size-4" aria-hidden="true" /> Importer
                </Link>
              </Button>
              <AddFromContactsDialog eventId={id} contacts={addable} groups={groupOptions} onAdd={addFromContactsAction} />
              <GuestFormDialog
                eventId={id}
                groups={groupOptions}
                onSubmit={createGuestAction.bind(null, id)}
                trigger={
                  <Button size="sm">
                    <Plus className="size-4" aria-hidden="true" /> Ajouter un invité
                  </Button>
                }
              />
            </>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Invités" value={stats.total} icon={Users} hint={`${stats.expectedHeadcount} personne(s) attendue(s)`} />
        <StatCard label="Acceptés" value={stats.accepted} icon={Check} tone="success" />
        <StatCard label="Refusés" value={stats.declined} icon={X} />
        <StatCard label="En attente" value={stats.pending + stats.maybe} icon={Clock} tone="warning" hint={stats.maybe ? `dont ${stats.maybe} peut-être` : undefined} />
        <StatCard label="Enfants" value={stats.children} icon={Baby} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <form className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_auto_auto_auto_auto]" role="search">
            <div>
              <label htmlFor="q" className="sr-only">
                Rechercher un invité
              </label>
              <Input id="q" name="q" placeholder="Rechercher un invité…" defaultValue={sp.q ?? ""} />
            </div>
            <select name="group" defaultValue={sp.group ?? ""} aria-label="Groupe" className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm">
              <option value="">Tous groupes</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <select name="rsvp" defaultValue={sp.rsvp ?? ""} aria-label="Réponse" className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm">
              <option value="">Toutes réponses</option>
              {RSVP_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {RSVP_LABELS[s]}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="enfants" value="1" defaultChecked={sp.enfants === "1"} className="size-4 accent-primary" /> Enfants
            </label>
            <Button type="submit" variant="secondary" size="sm">
              Filtrer
            </Button>
          </form>
          {guests.length === 0 ? (
            <EmptyState
              icon={Users}
              title={hasFilters ? "Aucun invité ne correspond" : "Aucun invité pour le moment"}
              description={hasFilters ? "Modifiez les filtres." : "Ajoutez vos invités un par un, depuis vos contacts ou par import CSV."}
              action={hasFilters ? <Button asChild variant="outline"><Link href={`/app/evenements/${id}/invites`}>Réinitialiser</Link></Button> : undefined}
            />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{guests.length} invité(s) affiché(s)</p>
              <GuestsTable eventId={id} guests={guests} groups={groupOptions} canManage={canManage} onUpdate={updateGuestAction} onDelete={deleteGuestAction} />
            </>
          )}
        </div>
        <GroupManager eventId={id} groups={groups} canManage={canManage} onCreate={createGroupAction} onUpdate={updateGroupAction} onDelete={deleteGroupAction} />
      </div>
    </div>
  );
}
