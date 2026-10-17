import { NextResponse } from "next/server";
import { z } from "zod";
import { ValidationError } from "@/lib/errors";
import { requireActorOrThrow } from "@/lib/session";
import { createUpload } from "@/modules/files/application/upload-service";
import { ABSOLUTE_MAX_BYTES, FILE_PURPOSES, FILE_SCOPES } from "@/modules/files/domain/policy";
import { errorResponse, NO_STORE, requestMeta } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fieldsSchema = z.object({
  scope: z.enum(FILE_SCOPES),
  scopeId: z.string().trim().min(1).max(64),
  purpose: z.enum(FILE_PURPOSES),
});

/**
 * POST multipart/form-data: file, scope, scopeId, purpose.
 * 201 → { id, originalName, mimeType, sizeBytes, status, rejectionReason }.
 * The body is bounded by Content-Length before being read.
 */
export async function POST(request: Request) {
  try {
    const actor = await requireActorOrThrow();
    const declaredLength = Number(request.headers.get("content-length") ?? "0");
    if (declaredLength > ABSOLUTE_MAX_BYTES + 64 * 1024) {
      return NextResponse.json({ error: "Fichier trop volumineux (maximum 20 Mo).", code: "validation" }, { status: 413, headers: NO_STORE });
    }
    const form = await request.formData().catch(() => null);
    if (!form) throw new ValidationError("Formulaire multipart invalide.");
    const parsed = fieldsSchema.safeParse({ scope: form.get("scope"), scopeId: form.get("scopeId"), purpose: form.get("purpose") });
    if (!parsed.success) throw new ValidationError("Paramètres d'envoi invalides.");
    const file = form.get("file");
    if (!(file instanceof File)) throw new ValidationError("Aucun fichier reçu.");
    if (file.size > ABSOLUTE_MAX_BYTES) {
      return NextResponse.json({ error: "Fichier trop volumineux (maximum 20 Mo).", code: "validation" }, { status: 413, headers: NO_STORE });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await createUpload(actor, { ...parsed.data, originalName: file.name, bytes, ...requestMeta(request) });
    return NextResponse.json(
      { id: result.id, originalName: result.originalName, mimeType: result.mimeType, sizeBytes: result.sizeBytes, status: result.status, rejectionReason: result.rejectionReason, deduplicated: result.deduplicated },
      { status: result.deduplicated ? 200 : 201, headers: NO_STORE },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
