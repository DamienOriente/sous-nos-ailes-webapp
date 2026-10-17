/**
 * Minimal ZIP central-directory reader for office documents (docx/xlsx/pptx/
 * odt/ods are ZIP containers). We do NOT decompress anything: the central
 * directory already tells us entry names and sizes, which is enough to refuse
 * macros, path traversal and decompression bombs. ZIP64 archives are refused.
 */
export type ZipEntry = { name: string; compressedSize: number; uncompressedSize: number };

export type ArchiveInspection = { ok: true; entries: ZipEntry[]; totalUncompressed: number; ratio: number } | { ok: false; reason: string; code: ArchiveRejectCode };
export type ArchiveRejectCode = "not_zip" | "zip64" | "too_many_entries" | "macro" | "path_traversal" | "bomb_ratio" | "bomb_size" | "corrupt";

export const ARCHIVE_LIMITS = {
  maxEntries: 10_000,
  maxUncompressedBytes: 200 * 1024 * 1024,
  maxRatio: 100,
} as const;

const EOCD_SIG = 0x06054b50;
const CDH_SIG = 0x02014b50;

export function inspectOfficeArchive(buf: Uint8Array): ArchiveInspection {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (buf.length < 22 || view.getUint32(0, true) !== 0x04034b50) {
    return { ok: false, code: "not_zip", reason: "Le document n'est pas une archive Office valide." };
  }
  // EOCD is in the last 22 + 65535 bytes (comment length is 16-bit).
  const minPos = Math.max(0, buf.length - 22 - 0xffff);
  let eocd = -1;
  for (let i = buf.length - 22; i >= minPos; i -= 1) {
    if (view.getUint32(i, true) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return { ok: false, code: "corrupt", reason: "Archive Office corrompue." };
  const entryCount = view.getUint16(eocd + 10, true);
  const cdSize = view.getUint32(eocd + 12, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  if (entryCount === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    return { ok: false, code: "zip64", reason: "Archive ZIP64 non prise en charge." };
  }
  if (entryCount > ARCHIVE_LIMITS.maxEntries) {
    return { ok: false, code: "too_many_entries", reason: "Le document contient trop de fichiers internes." };
  }
  if (cdOffset + cdSize > buf.length) return { ok: false, code: "corrupt", reason: "Archive Office corrompue." };

  const entries: ZipEntry[] = [];
  let pos = cdOffset;
  let totalCompressed = 0;
  let totalUncompressed = 0;
  for (let n = 0; n < entryCount; n += 1) {
    if (pos + 46 > buf.length || view.getUint32(pos, true) !== CDH_SIG) {
      return { ok: false, code: "corrupt", reason: "Archive Office corrompue." };
    }
    const compressedSize = view.getUint32(pos + 20, true);
    const uncompressedSize = view.getUint32(pos + 24, true);
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      return { ok: false, code: "zip64", reason: "Archive ZIP64 non prise en charge." };
    }
    const nameBytes = buf.subarray(pos + 46, pos + 46 + nameLen);
    const name = new TextDecoder("utf-8", { fatal: false }).decode(nameBytes);
    entries.push({ name, compressedSize, uncompressedSize });
    totalCompressed += compressedSize;
    totalUncompressed += uncompressedSize;
    pos += 46 + nameLen + extraLen + commentLen;
  }

  for (const e of entries) {
    const lower = e.name.toLowerCase();
    if (lower.includes("..") || lower.startsWith("/") || /^[a-z]:/.test(lower) || lower.includes("\\")) {
      return { ok: false, code: "path_traversal", reason: "Le document contient des chemins internes suspects." };
    }
    if (lower.endsWith("vbaproject.bin") || lower.endsWith(".bin") && lower.includes("vba") || lower.includes("macros/") || lower.endsWith("/basic/script-lc.xml")) {
      return { ok: false, code: "macro", reason: "Les documents contenant des macros ne sont pas acceptés." };
    }
  }
  if (totalUncompressed > ARCHIVE_LIMITS.maxUncompressedBytes) {
    return { ok: false, code: "bomb_size", reason: "Le document décompressé est trop volumineux." };
  }
  const ratio = totalCompressed === 0 ? (totalUncompressed === 0 ? 1 : Number.POSITIVE_INFINITY) : totalUncompressed / totalCompressed;
  if (ratio >= ARCHIVE_LIMITS.maxRatio) {
    return { ok: false, code: "bomb_ratio", reason: "Le taux de compression du document est anormal." };
  }
  return { ok: true, entries, totalUncompressed, ratio };
}
