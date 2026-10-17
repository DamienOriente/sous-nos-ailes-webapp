import { addNoteAction, deleteNoteAction } from "@/server/actions/admin/notes";
import { formatInstantParis } from "@/lib/time";
import { Field, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { AdminSection, Disclosure } from "@/components/admin/section";

export type NoteRow = { id: string; body: string; createdAt: Date; author: { name: string } };

type Target = { eventId?: string; venueId?: string; providerId?: string };

/**
 * Internal notes list with add/delete forms. Only ever rendered in Marie's
 * space: the services never expose notes to clients, providers or partners.
 */
export function NotesSection({ id = "notes", title = "Notes internes", description, notes, target, returnPath, emptyLabel = "Aucune note pour l’instant." }: { id?: string; title?: string; description?: string; notes: NoteRow[]; target: Target; returnPath: string; emptyLabel?: string }) {
  return (
    <AdminSection id={id} title={title} description={description ?? "Visibles uniquement dans l’espace de gestion."}>
      {notes.length ? (
        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-md border border-sage-200 bg-ivory-50 px-4 py-3">
              <p className="text-[15px] leading-relaxed whitespace-pre-line text-ink-900">{note.body}</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink-500">
                <span>
                  {note.author.name} · {formatInstantParis(note.createdAt)}
                </span>
                <form action={deleteNoteAction.bind(null, note.id, returnPath)}>
                  <Button type="submit" variant="ghost" size="sm" className="text-danger-600 hover:bg-danger-100">
                    Supprimer
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[15px] text-ink-500">{emptyLabel}</p>
      )}
      <Disclosure summary="Ajouter une note">
        <form action={addNoteAction.bind(null, target, returnPath)} className="flex flex-col gap-3">
          <Field label="Note" htmlFor={`${id}-body`} required>
            <Textarea id={`${id}-body`} name="body" maxLength={4000} required className="min-h-24" />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" variant="secondary" size="sm">
              Enregistrer la note
            </Button>
          </div>
        </form>
      </Disclosure>
    </AdminSection>
  );
}
