import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryForm } from "@/components/admin/category-form";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { NotFoundError } from "@/lib/errors";
import { getCategoryAdmin } from "@/modules/admin/application/catalog-admin";
import { requireAdminPage } from "../../_lib/admin-page";
import { updateCategoryAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor } = await requireAdminPage("admin.categories.manage", `/admin/categories/${id}`);
  let c;
  try {
    c = await getCategoryAdmin(actor, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  return (
    <div className="space-y-6">
      <Link href="/admin/categories" className="text-sm text-muted-foreground hover:underline">Retour aux catégories</Link>
      <PageHeader  title={c.name} description={`${c.usageCount} fiche(s) rattachée(s)`} />
      <Card className="p-6">
        <CategoryForm action={updateCategoryAction} submitLabel="Enregistrer" values={{ ...c, description: c.description }} />
      </Card>
    </div>
  );
}
