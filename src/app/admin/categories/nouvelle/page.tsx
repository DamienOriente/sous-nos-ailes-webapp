import Link from "next/link";
import { CategoryForm } from "@/components/admin/category-form";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { requireAdminPage } from "../../_lib/admin-page";
import { createCategoryAction } from "../actions";

export default async function NewCategoryPage() {
  await requireAdminPage("admin.categories.manage", "/admin/categories/nouvelle");
  return (
    <div className="space-y-6">
      <Link href="/admin/categories" className="text-sm text-muted-foreground hover:underline">Retour aux catégories</Link>
      <PageHeader  title="Nouvelle catégorie" />
      <Card className="p-6">
        <CategoryForm action={createCategoryAction} submitLabel="Créer" values={{ name: "", slug: "", group: "", icon: "sparkles", description: "", isChildcare: false, formSchemaKey: "generic", defaultTools: ["calendar", "inquiries"], suggestedTemplates: [], sortOrder: 100, isActive: true }} />
      </Card>
    </div>
  );
}
