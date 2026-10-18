import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, ActionSubmit } from "@/components/admin/action-form";
import { dateTime } from "@/components/admin/admin-table";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { NotFoundError } from "@/lib/errors";
import { canGlobal } from "@/modules/authorization";
import { getReportedMessage } from "@/modules/moderation/application/content-moderation";
import { requireAdminPage } from "../../../_lib/admin-page";
import { hideMessageAction } from "../../actions";

export const dynamic = "force-dynamic";

/** Only the reported message is shown — never the channel or the rest of the conversation. */
export default async function ReportedMessagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor } = await requireAdminPage("moderation.queue", `/admin/moderation/messages/${id}`);
  let msg;
  try {
    msg = await getReportedMessage(actor, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/admin/moderation" className="text-sm text-muted-foreground hover:underline">Retour à la modération</Link>
      <PageHeader  title="Message signalé" description="Seul le message signalé est accessible. Le reste du canal reste privé." />
      <Card className="gap-3 p-6">
        <p className="text-sm text-muted-foreground">
          Par {msg.authorName} · {dateTime(msg.createdAt)} · {msg.reportCount} signalement{msg.reportCount > 1 ? "s" : ""}
          {msg.deletedAt ? " · masqué" : ""}
        </p>
        <blockquote className="rounded-lg bg-muted/50 p-4 whitespace-pre-wrap">{msg.body}</blockquote>
        {!msg.deletedAt && canGlobal(actor, "moderation.decide") && (
          <ActionForm action={hideMessageAction} successMessage="Message masqué.">
            <input type="hidden" name="messageId" value={msg.id} />
            <Textarea name="reason" required minLength={10} rows={2} placeholder="Motif du masquage (journalisé)" aria-label="Motif du masquage" />
            <ActionSubmit variant="destructive">Masquer ce message</ActionSubmit>
          </ActionForm>
        )}
      </Card>
    </div>
  );
}
