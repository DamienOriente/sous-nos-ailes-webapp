import Link from "next/link";
import { notFound } from "next/navigation";
import { ToolForm } from "@/components/admin/tool-form";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { NotFoundError } from "@/lib/errors";
import { getToolAdmin } from "@/modules/admin/application/catalog-admin";
import { requireAdminPage } from "../../_lib/admin-page";
import { updateToolAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditToolPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const { actor } = await requireAdminPage("admin.tools.manage", `/admin/outils/${key}`);
  let t;
  try {
    t = await getToolAdmin(actor, key);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  return (
    <div className="space-y-6">
      <Link href="/admin/outils" className="text-sm text-muted-foreground hover:underline">Retour aux outils</Link>
      <PageHeader  title={t.name} description={<code>{t.key}</code>} />
      <Card className="p-6">
        <ToolForm action={updateToolAction} isNew={false} submitLabel="Enregistrer" values={t} />
      </Card>
    </div>
  );
}
