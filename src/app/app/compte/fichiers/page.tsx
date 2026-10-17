import { PageHeader } from "@/components/shared";
import { FilesEmptyState } from "@/components/files/files-empty-state";
import { DeleteFileButton } from "@/components/files/delete-file-button";
import { FileList, formatFileSize } from "@/components/files/file-list";
import { ScopeFilesUploader } from "@/components/files/scope-files-uploader";
import { requireActor } from "@/lib/session";
import { listScopeFiles } from "@/modules/files/application/file-service";
import { scopeUsage } from "@/modules/files/application/upload-service";
import { SCOPE_QUOTA_BYTES } from "@/modules/files/domain/policy";
import { deleteMyFileAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function MyFilesPage() {
  const actor = await requireActor("/app/compte/fichiers");
  const [files, used] = await Promise.all([listScopeFiles(actor, "user", actor.userId), scopeUsage("user", actor.userId)]);
  const quota = SCOPE_QUOTA_BYTES.user;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Mon compte" title="Mes fichiers" description={`Photo de profil et documents personnels. ${formatFileSize(used)} utilisés sur ${formatFileSize(quota)}.`} />

      <section className="grid gap-6 md:grid-cols-2" aria-label="Envoyer un fichier">
        <div className="space-y-2">
          <h2 className="text-base font-semibold">Photo de profil</h2>
          <ScopeFilesUploader scope="user" scopeId={actor.userId} purpose="avatar" label="Glissez votre photo ici" description="JPEG, PNG, WebP ou AVIF, 3 Mo maximum. Les métadonnées (position GPS…) sont supprimées." />
        </div>
        <div className="space-y-2">
          <h2 className="text-base font-semibold">Documents personnels</h2>
          <ScopeFilesUploader scope="user" scopeId={actor.userId} purpose="document" maxFiles={5} label="Glissez vos documents ici" description="PDF, Word, Excel, PowerPoint, ODT/ODS ou image, 20 Mo maximum. Chaque fichier est analysé avant d'être disponible." />
        </div>
      </section>

      <section className="space-y-3" aria-label="Fichiers enregistrés">
        <h2 className="text-base font-semibold">Fichiers enregistrés</h2>
        {files.length === 0 ? (
          <FilesEmptyState />
        ) : (
          <FileList files={files} renderActions={(f) => <DeleteFileButton fileId={f.id} fileName={f.originalName} action={deleteMyFileAction} />} />
        )}
      </section>
    </div>
  );
}
