import Link from "next/link";
import { ToolForm } from "@/components/admin/tool-form";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { requireAdminPage } from "../../_lib/admin-page";
import { createToolAction } from "../actions";

export default async function NewToolPage() {
  await requireAdminPage("admin.tools.manage", "/admin/outils/nouveau");
  return (
    <div className="space-y-6">
      <Link href="/admin/outils" className="text-sm text-muted-foreground hover:underline">Retour aux outils</Link>
      <PageHeader  title="Nouvel outil" />
      <Card className="p-6">
        <ToolForm action={createToolAction} isNew submitLabel="Créer" values={{ key: "", name: "", description: "", audience: "both", requiredFeature: null, categorySlugs: [], isActive: true, sortOrder: 100 }} />
      </Card>
    </div>
  );
}
