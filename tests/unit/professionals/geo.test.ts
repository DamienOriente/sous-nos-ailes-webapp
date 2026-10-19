import { describe, expect, it } from "vitest";
import { departmentFromPostalCode, DEPARTMENTS, findCity, findDepartmentBySlug, haversineKm, resolveLocation } from "@/modules/professionals/domain/geo";
import { weekdayFromIsoDate } from "@/modules/directory/application/directory-search";

describe("haversineKm", () => {
  it("is 0 for the same point and symmetric", () => {
    expect(haversineKm(43.6047, 1.4442, 43.6047, 1.4442)).toBe(0);
    const ab = haversineKm(43.6047, 1.4442, 44.8378, -0.5792);
    const ba = haversineKm(44.8378, -0.5792, 43.6047, 1.4442);
    expect(ab).toBeCloseTo(ba, 6);
  });

  it("Toulouse → Bordeaux ≈ 212 km, Toulouse → Montpellier ≈ 196 km", () => {
    expect(haversineKm(43.6047, 1.4442, 44.8378, -0.5792)).toBeGreaterThan(205);
    expect(haversineKm(43.6047, 1.4442, 44.8378, -0.5792)).toBeLessThan(220);
    expect(haversineKm(43.6047, 1.4442, 43.6108, 3.8767)).toBeGreaterThan(190);
    expect(haversineKm(43.6047, 1.4442, 43.6108, 3.8767)).toBeLessThan(202);
  });
});

describe("departments and postal codes", () => {
  it("has 101 departments with unique codes and slugs", () => {
    expect(DEPARTMENTS.length).toBe(101);
    expect(new Set(DEPARTMENTS.map((d) => d.code)).size).toBe(101);
    expect(new Set(DEPARTMENTS.map((d) => d.slug)).size).toBe(101);
  });

  it("derives the department from a postal code, including Corsica and overseas", () => {
    expect(departmentFromPostalCode("31000")?.code).toBe("31");
    expect(departmentFromPostalCode("81500")?.name).toBe("Tarn");
    expect(departmentFromPostalCode("20000")?.code).toBe("2A");
    expect(departmentFromPostalCode("20200")?.code).toBe("2B");
    expect(departmentFromPostalCode("97400")?.code).toBe("974");
    expect(departmentFromPostalCode("75 008")?.code).toBe("75");
    expect(departmentFromPostalCode("ABCDE")).toBeNull();
    expect(departmentFromPostalCode("1234")).toBeNull();
  });

  it("maps departments to regions and slugs", () => {
    expect(departmentFromPostalCode("33000")?.region).toBe("Nouvelle-Aquitaine");
    expect(findDepartmentBySlug("haute-garonne")?.code).toBe("31");
    expect(findDepartmentBySlug("cote-d-or")?.code).toBe("21");
  });
});

describe("resolveLocation", () => {
  it("uses known city coordinates when available", () => {
    const r = resolveLocation("Toulouse", "31000");
    expect(r.department?.code).toBe("31");
    expect(r.region).toBe("Occitanie");
    expect(r.latitude).toBeCloseTo(43.6047, 3);
  });

  it("falls back to a department centroid for unknown towns", () => {
    const r = resolveLocation("Gaillac", "81600");
    expect(r.department?.code).toBe("81");
    expect(r.latitude).not.toBeNull();
    expect(findCity("Gaillac")).toBeNull();
  });

  it("is case/accent insensitive for city lookup", () => {
    expect(findCity("ALBI")?.slug).toBe("albi");
    expect(findCity("Nîmes")?.departmentCode).toBe("30");
  });
});

describe("weekdayFromIsoDate", () => {
  it("returns 0 for Monday … 6 for Sunday", () => {
    expect(weekdayFromIsoDate("2027-06-12")).toBe(5); // Saturday
    expect(weekdayFromIsoDate("2026-10-19")).toBe(0); // Monday
    expect(weekdayFromIsoDate("2026-10-18")).toBe(6); // Sunday
  });
});
