import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { inspectOfficeArchive } from "@/modules/files/domain/office-archive";

/** Minimal ZIP writer (store or deflate), enough to exercise the central directory reader. */
function buildZip(entries: Array<{ name: string; data: Buffer; fakeUncompressedSize?: number }>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, "utf8");
    const compressed = deflateRawSync(e.data);
    const uncompressedSize = e.fakeUncompressedSize ?? e.data.length;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(uncompressedSize, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, compressed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(uncompressedSize, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + compressed.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

const docxLike = (extra: Array<{ name: string; data: Buffer; fakeUncompressedSize?: number }> = []) =>
  buildZip([
    { name: "[Content_Types].xml", data: Buffer.from("<Types/>") },
    { name: "word/document.xml", data: Buffer.from("<w:document>Bonjour</w:document>") },
    ...extra,
  ]);

describe("office archive inspection", () => {
  it("accepts a plain docx-like archive", () => {
    const r = inspectOfficeArchive(docxLike());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.entries.map((e) => e.name)).toContain("word/document.xml");
  });
  it("rejects macros (vbaProject.bin)", () => {
    const r = inspectOfficeArchive(docxLike([{ name: "word/vbaProject.bin", data: Buffer.from("macro") }]));
    expect(r).toMatchObject({ ok: false, code: "macro" });
  });
  it("rejects path traversal entries", () => {
    const r = inspectOfficeArchive(docxLike([{ name: "../../evil.xml", data: Buffer.from("x") }]));
    expect(r).toMatchObject({ ok: false, code: "path_traversal" });
  });
  it("rejects decompression bombs by ratio", () => {
    const zeros = Buffer.alloc(200_000, 0); // compresses extremely well
    const r = inspectOfficeArchive(docxLike([{ name: "word/media/big.bin", data: zeros }]));
    expect(r).toMatchObject({ ok: false, code: "bomb_ratio" });
  });
  it("rejects declared uncompressed size above 200 MB", () => {
    const r = inspectOfficeArchive(docxLike([{ name: "word/media/huge.bin", data: Buffer.from("tiny"), fakeUncompressedSize: 201 * 1024 * 1024 }]));
    expect(["bomb_size", "bomb_ratio"]).toContain((r as { code: string }).code);
  });
  it("rejects non-zip bytes", () => {
    expect(inspectOfficeArchive(Buffer.from("%PDF-1.4 not a zip at all, padded to be long enough......"))).toMatchObject({ ok: false, code: "not_zip" });
  });
});
