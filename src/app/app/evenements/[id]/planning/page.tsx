import Link from "next/link";
import { Timeline } from "@/components/events/timeline";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { requireActor } from "@/lib/session";
import { listMilestones } from "@/modules/events/application/milestone-service";
import { getCategoryOptions } from "@/modules/events/application/categories";
import { guardPage } from "../_guards";
import { addSuggestedMilestonesAction, createMilestoneAction, deleteMilestoneAction, updateMilestoneAction } from "./actions";

export default async function PlanningPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/app/evenements/${id}/planning`);
  const { event, milestones } = await guardPage(() => listMilestones(actor, id));
  const categories = await getCategoryOptions();
  const canManage = event.access.permissions.has("event.milestones.manage");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Planning du jour J"
        description="Le déroulé heure par heure, partagé avec les prestataires concernés. Toute modification les prévient."
        actions={
          <Button asChild variant="outline">
            <Link href={`/app/evenements/${id}/planning/ics`} prefetch={false}>
              Exporter (.ics)
            </Link>
          </Button>
        }
      />
      <Timeline
        eventId={id}
        eventType={event.type}
        eventDate={event.eventDate}
        timezone={event.timezone}
        milestones={milestones.map((m) => ({ id: m.id, title: m.title, description: m.description, startsAt: m.startsAt.toISOString(), endsAt: m.endsAt?.toISOString() ?? null, location: m.location, categorySlugs: m.categorySlugs }))}
        categories={categories}
        canManage={canManage}
        memberCategory={event.access.categorySlug}
        actions={{ create: createMilestoneAction, update: updateMilestoneAction, remove: deleteMilestoneAction, addSuggested: addSuggestedMilestonesAction }}
      />
    </div>
  );
}
