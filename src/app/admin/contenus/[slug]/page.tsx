import Link from "next/link";
import { EditorialEditor } from "@/components/admin/editorial-editor";
import { PageHeader } from "@/components/shared/page-header";
import { NotFoundError } from "@/lib/errors";
import { getEditorialPage } from "@/modules/admin/application/editorial-service";
import { DRAFT_NOTICE } from "@/modules/legal/domain/defaults";
import { requireAdminPage } from "../../_lib/admin-page";
import { previewEditorialAction, saveEditorialAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditEditorialPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { actor } = await requireAdminPage("admin.content.manage", `/admin/contenus/${slug}`);
  const isNew = slug === "nouvelle-page";
  let initial: { slug: string; title: string; body: string; isPublished: "draft" | "published" };
  if (isNew) {
    initial = { slug: "", title: "", body: `> ${DRAFT_NOTICE}\n\n## Titre de section\nTexte…`, isPublished: "draft" };
  } else {
    try {
      const page = await getEditorialPage(actor, slug);
      initial = { slug: page.slug, title: page.title, body: page.body, isPublished: page.isPublished };
    } catch (e) {
      if (e instanceof NotFoundError) initial = { slug, title: "", body: `> ${DRAFT_NOTICE}\n\n## Section\n`, isPublished: "draft" };
      else throw e;
    }
  }
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={<Link href="/admin/contenus" className="hover:underline">← Pages éditoriales</Link>} title={isNew ? "Nouvelle page" : initial.title || slug} description={isNew ? undefined : `URL publique : /${slug}`} />
      <EditorialEditor save={saveEditorialAction} preview={previewEditorialAction} initial={initial} isNew={isNew || !initial.title} />
    </div>
  );
}
