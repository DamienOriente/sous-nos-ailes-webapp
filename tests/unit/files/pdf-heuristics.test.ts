import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { inspectPdfBytes, inspectPdfDocument, looksLikePdf } from "@/modules/files/domain/pdf-heuristics";

const enc = (s: string) => new TextEncoder().encode(s);
const MINIMAL = "%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF";

describe("PDF heuristics", () => {
  it("accepts a plain document", () => {
    expect(looksLikePdf(enc(MINIMAL))).toBe(true);
    expect(inspectPdfBytes(enc(MINIMAL))).toEqual({ ok: true });
  });
  it("rejects JavaScript, Launch, OpenAction, AA and embedded files", () => {
    for (const token of ["/JavaScript", "/JS", "/Launch", "/OpenAction", "/AA", "/EmbeddedFile"]) {
      const doc = MINIMAL.replace("/Type /Catalog", `/Type /Catalog ${token} 5 0 R`);
      const r = inspectPdfBytes(enc(doc));
      expect(r.ok, token).toBe(false);
      if (!r.ok) expect(r.token).toBe(token);
    }
  });
  it("catches hex-escaped names (/J#53 → /JS)", () => {
    const doc = MINIMAL.replace("/Type /Catalog", "/Type /Catalog /J#53 (app.alert(1))");
    expect(inspectPdfBytes(enc(doc))).toEqual({ ok: false, token: "/JS" });
  });
  it("does not trip on longer names sharing a prefix", () => {
    const doc = MINIMAL.replace("/Type /Catalog", "/Type /Catalog /JSONData 1 /AAPL:Keywords [] /Launcher 2");
    expect(inspectPdfBytes(enc(doc))).toEqual({ ok: true });
  });
  it("refuses non-PDF bytes", () => {
    expect(looksLikePdf(enc("MZ this is not a pdf"))).toBe(false);
  });
});

describe("PDF structural inspection (object streams)", () => {
  it("finds JavaScript hidden in compressed object streams that the raw scan misses", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.addJavaScript("evil", "app.alert(1)");
    const bytes = await doc.save({ useObjectStreams: true });
    // Raw scan is blind here…
    expect(inspectPdfBytes(bytes).ok).toBe(true);
    // …the parsed graph is not.
    const parsed = await PDFDocument.load(bytes);
    const r = inspectPdfDocument(parsed);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(["/JavaScript", "/JS"]).toContain(r.token);
  });
  it("accepts a plain generated document", async () => {
    const doc = await PDFDocument.create();
    doc.addPage().drawText("Bonjour", { x: 10, y: 10 });
    const parsed = await PDFDocument.load(await doc.save());
    expect(inspectPdfDocument(parsed)).toEqual({ ok: true });
  });
  it("flags embedded files", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    await doc.attach(new Uint8Array([1, 2, 3]), "payload.bin", { mimeType: "application/octet-stream" });
    const parsed = await PDFDocument.load(await doc.save());
    expect(inspectPdfDocument(parsed).ok).toBe(false);
  });
});
