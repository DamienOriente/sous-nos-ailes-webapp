import { describe, expect, it } from "vitest";
import { detectDelimiter, mapHeaders, normalizeHeader, parseCsv, serializeCsv } from "@/modules/contacts/domain/csv";
import { CONTACT_HEADER_ALIASES, findDuplicateGroups, mergeContacts, rowsToContactDrafts } from "@/modules/contacts/domain/contact-import";

describe("parseCsv", () => {
  it("handles BOM, semicolons, quotes with embedded delimiters and newlines, CRLF", () => {
    const input = '﻿Prénom;Nom;E-mail;Notes\r\nJean;Dupont;jean@ex.fr;"Ligne 1\r\nLigne 2; avec point-virgule"\r\n"Marie ""Mimi""";Durand;;\r\n';
    const r = parseCsv(input);
    expect(r.delimiter).toBe(";");
    expect(r.headers).toEqual(["Prénom", "Nom", "E-mail", "Notes"]);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toEqual(["Jean", "Dupont", "jean@ex.fr", "Ligne 1\nLigne 2; avec point-virgule"]);
    expect(r.rows[1]![0]).toBe('Marie "Mimi"');
  });
  it("detects commas and tabs", () => {
    expect(detectDelimiter("a,b,c")).toBe(",");
    expect(detectDelimiter("a\tb\tc")).toBe("\t");
    expect(detectDelimiter('"x;y",b')).toBe(",");
    expect(parseCsv("first name,last name\nAnna,Lee\n").rows).toEqual([["Anna", "Lee"]]);
  });
  it("skips empty lines and truncates at maxRows", () => {
    const body = Array.from({ length: 10 }, (_, i) => `P${i};N${i}`).join("\n");
    const r = parseCsv(`Prénom;Nom\n\n${body}\n\n`, { maxRows: 4 });
    expect(r.truncated).toBe(true);
    expect(r.totalRows).toBe(10);
    expect(r.rows).toHaveLength(4);
  });
  it("round-trips through serializeCsv", () => {
    const csv = serializeCsv(["Nom", "Notes"], [["Dupont", 'a;b "c"\nd'], ["Durand", null]]);
    expect(csv.startsWith("﻿")).toBe(true);
    const back = parseCsv(csv);
    expect(back.rows[0]).toEqual(["Dupont", 'a;b "c"\nd']);
    expect(back.rows[1]).toEqual(["Durand", ""]);
  });
});

describe("mapHeaders", () => {
  it("maps FR/EN aliases regardless of accents and case", () => {
    expect(normalizeHeader(" Prénom ")).toBe("prenom");
    const { columns, unmapped } = mapHeaders(["PRÉNOM", "Nom de famille", "Email address", "Société", "Couleur préférée"], CONTACT_HEADER_ALIASES);
    expect(columns).toMatchObject({ firstName: 0, lastName: 1, email: 2, company: 3 });
    expect(unmapped).toEqual(["Couleur préférée"]);
  });
});

describe("rowsToContactDrafts", () => {
  it("builds drafts, splits full names, reports invalid rows", () => {
    const { drafts, errors } = rowsToContactDrafts(
      ["Nom complet", "Email", "Téléphone", "Catégorie", "Tags"],
      [
        ["jean dupont", "JEAN@ex.fr", "06 12 34 56 78", "Prestataire", "mariage, Traiteur"],
        ["", "", "", "", ""],
        ["Zoé Martin", "pas-un-mail", "", "famille", ""],
      ],
    );
    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({ line: 2, firstName: "Jean", lastName: "Dupont", email: "jean@ex.fr", phone: "+33612345678", category: "provider", tags: ["mariage", "traiteur"], dedupeKey: "email:jean@ex.fr" });
    expect(drafts[1]).toMatchObject({ firstName: "Zoé", email: null, category: "family" });
    expect(errors.map((e) => e.line)).toEqual([3, 4]);
  });
});

describe("duplicates & merge", () => {
  it("groups by dedupe key and merges fields", () => {
    const a = { id: "a", firstName: "Maxime", lastName: "Girard", company: null, email: "maxime@ex.fr", phone: null, category: "friend", tags: ["amis"], notes: "témoin", dedupeKey: "email:maxime@ex.fr" };
    const b = { id: "b", firstName: "Max", lastName: "", company: "ACME", email: "maxime@ex.fr", phone: "+33612345678", category: null, tags: ["ancien", "amis"], notes: "autre note", dedupeKey: "email:maxime@ex.fr" };
    const c = { id: "c", firstName: "Solo", lastName: "", company: null, email: null, phone: null, category: null, tags: [], notes: null, dedupeKey: null };
    const groups = findDuplicateGroups([a, b, c]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.items.map((i) => i.id)).toEqual(["a", "b"]);
    const merged = mergeContacts(a, [b]);
    expect(merged).toMatchObject({ firstName: "Maxime", lastName: "Girard", company: "ACME", phone: "+33612345678", category: "friend", tags: ["amis", "ancien"], notes: "témoin\nautre note" });
  });
});
