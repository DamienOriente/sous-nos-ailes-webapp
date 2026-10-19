/**
 * Upload policy — pure rules, no IO. Everything the pipeline decides about a
 * file (allowed types, sizes, quotas, naming) is derived from here so it can
 * be unit tested and audited in one place.
 */
export const FILE_SCOPES = ["user", "professional", "event", "organization", "system"] as const;
export type FileScope = (typeof FILE_SCOPES)[number];

export const FILE_PURPOSES = ["avatar", "logo", "cover", "gallery", "document", "quote", "contract", "supporting_document", "attachment", "receipt", "export"] as const;
export type FilePurpose = (typeof FILE_PURPOSES)[number];

export const FILE_STATUSES = ["quarantined", "scanning", "clean", "infected", "rejected", "deleted"] as const;
export type FileStatus = (typeof FILE_STATUSES)[number];

/** Purposes whose downloads are logged in file_access_logs. */
export const SENSITIVE_PURPOSES: ReadonlySet<FilePurpose> = new Set(["supporting_document", "contract", "quote", "document", "export"]);

/** Purposes that may be served publicly (when the owning listing is published). */
export const PUBLIC_IMAGE_PURPOSES: ReadonlySet<FilePurpose> = new Set(["logo", "cover", "gallery"]);

export const MB = 1024 * 1024;

type MimeFamily = "image" | "pdf" | "office";

/** Accepted mime types (as detected from magic bytes) with their canonical extensions. */
export const MIME_EXTENSIONS: Record<string, readonly string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/avif": ["avif"],
  "image/gif": ["gif"],
  "application/pdf": ["pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx"],
  "application/vnd.oasis.opendocument.text": ["odt"],
  "application/vnd.oasis.opendocument.spreadsheet": ["ods"],
};

export const IMAGE_MIMES: ReadonlySet<string> = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);
export const OFFICE_MIMES: ReadonlySet<string> = new Set(
  Object.keys(MIME_EXTENSIONS).filter((m) => m.startsWith("application/vnd.")),
);

export function mimeFamily(mime: string): MimeFamily | null {
  if (IMAGE_MIMES.has(mime)) return "image";
  if (mime === "application/pdf") return "pdf";
  if (OFFICE_MIMES.has(mime)) return "office";
  return null;
}

type PurposeRule = { families: readonly MimeFamily[]; maxBytes: number };

const IMAGE_ONLY: PurposeRule = { families: ["image"], maxBytes: 10 * MB };
const DOCUMENTS: PurposeRule = { families: ["pdf", "office", "image"], maxBytes: 20 * MB };

export const PURPOSE_RULES: Record<FilePurpose, PurposeRule> = {
  avatar: { families: ["image"], maxBytes: 3 * MB },
  logo: IMAGE_ONLY,
  cover: IMAGE_ONLY,
  gallery: IMAGE_ONLY,
  document: DOCUMENTS,
  quote: DOCUMENTS,
  contract: DOCUMENTS,
  supporting_document: DOCUMENTS,
  attachment: { families: ["pdf", "image"], maxBytes: 20 * MB },
  receipt: { families: ["pdf", "image"], maxBytes: 20 * MB },
  export: { families: ["pdf"], maxBytes: 20 * MB },
};

/** Hard ceiling applied before anything is read, whatever the purpose. */
export const ABSOLUTE_MAX_BYTES = 20 * MB;

/** Storage quota per scope (sum of non-deleted, non-rejected files). */
export const SCOPE_QUOTA_BYTES: Record<FileScope, number> = {
  user: 200 * MB,
  professional: 500 * MB,
  event: 2 * 1024 * MB,
  organization: 1024 * MB,
  system: Number.POSITIVE_INFINITY,
};

/** Purposes allowed per scope. Deny by default. */
export const SCOPE_PURPOSES: Record<FileScope, readonly FilePurpose[]> = {
  user: ["avatar", "document", "export"],
  professional: ["logo", "cover", "gallery", "document", "supporting_document", "quote", "contract"],
  event: ["document", "quote", "contract", "attachment", "receipt", "cover"],
  organization: ["logo", "document", "contract"],
  system: ["export", "document"],
};

export function isFileScope(v: string): v is FileScope {
  return (FILE_SCOPES as readonly string[]).includes(v);
}
export function isFilePurpose(v: string): v is FilePurpose {
  return (FILE_PURPOSES as readonly string[]).includes(v);
}

export function purposeAllowedInScope(scope: FileScope, purpose: FilePurpose): boolean {
  return SCOPE_PURPOSES[scope].includes(purpose);
}

export function maxBytesFor(purpose: FilePurpose): number {
  return PURPOSE_RULES[purpose].maxBytes;
}

/** Image mimes are allowed everywhere images are, but SVG is never accepted from users. */
export function mimeAllowedForPurpose(mime: string, purpose: FilePurpose): boolean {
  const family = mimeFamily(mime);
  if (!family) return false;
  return PURPOSE_RULES[purpose].families.includes(family);
}

/**
 * Lower-cased extension of a user supplied name, without the dot. Returns ""
 * when there is none. Only the LAST extension counts: "photo.jpg.exe" → "exe".
 */
export function declaredExtension(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? "";
  const idx = base.lastIndexOf(".");
  if (idx <= 0 || idx === base.length - 1) return "";
  return base.slice(idx + 1).toLowerCase();
}

const EXECUTABLE_OR_SCRIPT_EXTENSIONS = new Set([
  "exe", "dll", "com", "bat", "cmd", "msi", "scr", "pif", "ps1", "vbs", "vbe", "js", "jse", "wsf", "wsh", "jar", "sh", "bash", "zsh", "php", "py", "rb", "pl", "hta", "cpl", "reg", "lnk", "iso", "img", "apk", "app", "dmg", "svg", "html", "htm", "xhtml", "shtml", "svgz", "xml",
]);

/**
 * "Double extension" trick: any dangerous extension appearing anywhere in the
 * name ("invoice.pdf.exe", "photo.exe.jpg") is refused outright.
 */
export function hasSuspiciousExtensionChain(fileName: string): boolean {
  const base = (fileName.split(/[\\/]/).pop() ?? "").toLowerCase();
  const parts = base.split(".").slice(1);
  if (parts.length === 0) return false;
  return parts.some((p) => EXECUTABLE_OR_SCRIPT_EXTENSIONS.has(p));
}

/**
 * The declared extension must match the detected mime type. An empty declared
 * extension is tolerated (clipboard pastes, camera uploads): the canonical
 * extension of the detected type is used.
 */
export function extensionMatchesMime(declared: string, mime: string): boolean {
  const allowed = MIME_EXTENSIONS[mime];
  if (!allowed) return false;
  if (declared === "") return true;
  return allowed.includes(declared);
}

export function canonicalExtension(mime: string): string {
  return MIME_EXTENSIONS[mime]?.[0] ?? "bin";
}

export type PolicyDecision = { ok: true; mime: string; extension: string } | { ok: false; reason: string; code: PolicyRejectCode };
export type PolicyRejectCode = "type_not_allowed" | "extension_mismatch" | "suspicious_name" | "too_large" | "purpose_not_in_scope" | "unknown_type";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Single entry point for the static policy checks (steps 5–8 of the pipeline).
 * `detectedMime` is null when magic bytes are unrecognised.
 */
export function evaluateUploadPolicy(input: { scope: FileScope; purpose: FilePurpose; originalName: string; detectedMime: string | null; sizeBytes: number }): PolicyDecision {
  if (!purposeAllowedInScope(input.scope, input.purpose)) {
    return { ok: false, code: "purpose_not_in_scope", reason: "Ce type de fichier n'est pas accepté ici." };
  }
  if (hasSuspiciousExtensionChain(input.originalName)) {
    return { ok: false, code: "suspicious_name", reason: "Le nom du fichier contient une extension interdite." };
  }
  if (!input.detectedMime) {
    return { ok: false, code: "unknown_type", reason: "Format de fichier non reconnu." };
  }
  if (!mimeAllowedForPurpose(input.detectedMime, input.purpose)) {
    return { ok: false, code: "type_not_allowed", reason: "Ce format de fichier n'est pas accepté pour cet usage." };
  }
  const declared = declaredExtension(input.originalName);
  if (!extensionMatchesMime(declared, input.detectedMime)) {
    return { ok: false, code: "extension_mismatch", reason: "L'extension du fichier ne correspond pas à son contenu." };
  }
  if (input.sizeBytes <= 0 || input.sizeBytes > maxBytesFor(input.purpose)) {
    return { ok: false, code: "too_large", reason: `Fichier trop volumineux (maximum ${Math.round(maxBytesFor(input.purpose) / MB)} Mo).` };
  }
  return { ok: true, mime: input.detectedMime, extension: declared || canonicalExtension(input.detectedMime) };
}

// ── Storage keys ─────────────────────────────────────────────────────────────
export function quarantineKey(uuid: string): string {
  return `q/${uuid}`;
}
export function storageKey(scope: FileScope, uuid: string, extension: string): string {
  return `f/${scope}/${uuid}.${extension}`;
}
export function variantKey(scope: FileScope, uuid: string, variant: string): string {
  return `f/${scope}/${uuid}_${variant}.webp`;
}
/** Every final key must embed a UUID and nothing from the user-supplied name. */
export function isValidStorageKey(key: string): boolean {
  const m = /^f\/(user|professional|event|organization|system)\/([0-9a-f-]{36})(?:_[a-z]+)?\.[a-z0-9]{2,5}$/i.exec(key);
  return Boolean(m && m[2] && UUID_RE.test(m[2]));
}

/** Image constraints. */
export const IMAGE_MAX_DIMENSION = 12_000;
export const IMAGE_MAX_PIXELS = 50_000_000; // 50 Mpx: above this a decompressed bitmap exceeds 200 MB
export const IMAGE_VARIANTS = [
  { name: "thumb", width: 320 },
  { name: "card", width: 640 },
  { name: "medium", width: 1024 },
  { name: "large", width: 1920 },
] as const;
export const WEBP_QUALITY = 82;

/** Human readable French label for a status (shared by UI + e-mails). */
export const FILE_STATUS_LABELS: Record<FileStatus, string> = {
  quarantined: "En attente d'analyse",
  scanning: "Analyse en cours",
  clean: "Vérifié",
  infected: "Infecté, supprimé",
  rejected: "Refusé",
  deleted: "Supprimé",
};
