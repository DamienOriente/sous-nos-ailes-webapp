import { describe, expect, it } from "vitest";
import {
  canonicalExtension,
  declaredExtension,
  evaluateUploadPolicy,
  extensionMatchesMime,
  hasSuspiciousExtensionChain,
  isValidStorageKey,
  maxBytesFor,
  MB,
  mimeAllowedForPurpose,
  quarantineKey,
  storageKey,
  variantKey,
} from "@/modules/files/domain/policy";

describe("upload policy — allowlist per purpose", () => {
  it("accepts images for avatar/logo/cover/gallery only", () => {
    expect(mimeAllowedForPurpose("image/jpeg", "avatar")).toBe(true);
    expect(mimeAllowedForPurpose("image/png", "gallery")).toBe(true);
    expect(mimeAllowedForPurpose("application/pdf", "avatar")).toBe(false);
    expect(mimeAllowedForPurpose("application/pdf", "logo")).toBe(false);
  });
  it("accepts PDF and office documents for document/quote/contract/supporting_document", () => {
    for (const purpose of ["document", "quote", "contract", "supporting_document"] as const) {
      expect(mimeAllowedForPurpose("application/pdf", purpose)).toBe(true);
      expect(mimeAllowedForPurpose("application/vnd.openxmlformats-officedocument.wordprocessingml.document", purpose)).toBe(true);
      expect(mimeAllowedForPurpose("application/vnd.oasis.opendocument.spreadsheet", purpose)).toBe(true);
    }
    expect(mimeAllowedForPurpose("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "attachment")).toBe(false);
  });
  it("never accepts SVG, executables or scripts", () => {
    for (const mime of ["image/svg+xml", "application/x-msdownload", "application/javascript", "text/html", "application/zip"]) {
      expect(mimeAllowedForPurpose(mime, "document")).toBe(false);
      expect(mimeAllowedForPurpose(mime, "gallery")).toBe(false);
    }
  });
  it("applies size limits per purpose", () => {
    expect(maxBytesFor("avatar")).toBe(3 * MB);
    expect(maxBytesFor("gallery")).toBe(10 * MB);
    expect(maxBytesFor("contract")).toBe(20 * MB);
    const tooBig = evaluateUploadPolicy({ scope: "user", purpose: "avatar", originalName: "me.jpg", detectedMime: "image/jpeg", sizeBytes: 3 * MB + 1 });
    expect(tooBig.ok).toBe(false);
    if (!tooBig.ok) expect(tooBig.code).toBe("too_large");
  });
  it("restricts purposes to their scope", () => {
    const r = evaluateUploadPolicy({ scope: "user", purpose: "supporting_document", originalName: "kbis.pdf", detectedMime: "application/pdf", sizeBytes: 1000 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("purpose_not_in_scope");
  });
});

describe("upload policy — extensions", () => {
  it("extracts the last extension, lower-cased", () => {
    expect(declaredExtension("Photo.JPG")).toBe("jpg");
    expect(declaredExtension("archive.tar.gz")).toBe("gz");
    expect(declaredExtension("noext")).toBe("");
    expect(declaredExtension(".hidden")).toBe("");
    expect(declaredExtension("C:\\Users\\x\\doc.pdf")).toBe("pdf");
  });
  it("detects double extensions hiding executables", () => {
    expect(hasSuspiciousExtensionChain("invoice.pdf.exe")).toBe(true);
    expect(hasSuspiciousExtensionChain("photo.exe.jpg")).toBe(true);
    expect(hasSuspiciousExtensionChain("script.JS.png")).toBe(true);
    expect(hasSuspiciousExtensionChain("logo.svg")).toBe(true);
    expect(hasSuspiciousExtensionChain("photo.jpg")).toBe(false);
    expect(hasSuspiciousExtensionChain("mon.devis.2026.pdf")).toBe(false);
  });
  it("requires the declared extension to match the detected type", () => {
    expect(extensionMatchesMime("jpg", "image/jpeg")).toBe(true);
    expect(extensionMatchesMime("jpeg", "image/jpeg")).toBe(true);
    expect(extensionMatchesMime("png", "image/jpeg")).toBe(false);
    expect(extensionMatchesMime("", "image/png")).toBe(true);
    expect(extensionMatchesMime("pdf", "application/pdf")).toBe(true);
    expect(extensionMatchesMime("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(true);
  });
  it("rejects an EXE renamed .jpg (magic bytes win over the name)", () => {
    const r = evaluateUploadPolicy({ scope: "user", purpose: "avatar", originalName: "photo.jpg", detectedMime: "application/x-msdownload", sizeBytes: 512 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("type_not_allowed");
    const unknown = evaluateUploadPolicy({ scope: "user", purpose: "avatar", originalName: "photo.jpg", detectedMime: null, sizeBytes: 512 });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.code).toBe("unknown_type");
  });
  it("rejects a PNG declared as .jpg", () => {
    const r = evaluateUploadPolicy({ scope: "user", purpose: "avatar", originalName: "photo.jpg", detectedMime: "image/png", sizeBytes: 512 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("extension_mismatch");
  });
  it("accepts a valid file and derives the extension", () => {
    const r = evaluateUploadPolicy({ scope: "professional", purpose: "gallery", originalName: "IMG_0001.JPG", detectedMime: "image/jpeg", sizeBytes: 2 * MB });
    expect(r).toEqual({ ok: true, mime: "image/jpeg", extension: "jpg" });
    const noExt = evaluateUploadPolicy({ scope: "professional", purpose: "gallery", originalName: "blob", detectedMime: "image/webp", sizeBytes: 100 });
    expect(noExt).toEqual({ ok: true, mime: "image/webp", extension: "webp" });
    expect(canonicalExtension("image/jpeg")).toBe("jpg");
  });
});

describe("storage naming", () => {
  const uuid = "0f1e2d3c-4b5a-4968-8778-695a4b3c2d1e";
  it("never embeds the user-supplied name", () => {
    expect(quarantineKey(uuid)).toBe(`q/${uuid}`);
    expect(storageKey("event", uuid, "pdf")).toBe(`f/event/${uuid}.pdf`);
    expect(variantKey("professional", uuid, "thumb")).toBe(`f/professional/${uuid}_thumb.webp`);
  });
  it("validates final keys strictly", () => {
    expect(isValidStorageKey(storageKey("user", uuid, "jpg"))).toBe(true);
    expect(isValidStorageKey(variantKey("user", uuid, "medium"))).toBe(true);
    expect(isValidStorageKey("f/user/photo.jpg")).toBe(false);
    expect(isValidStorageKey("f/user/../../etc/passwd")).toBe(false);
    expect(isValidStorageKey(`f/unknown/${uuid}.jpg`)).toBe(false);
  });
});
