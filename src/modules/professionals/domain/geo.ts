/**
 * Static French geography used by onboarding and the directory. No external
 * API: a postal code gives the department, the department gives the region,
 * and a short table of large cities + Occitanie/Nouvelle-Aquitaine prefectures
 * gives approximate coordinates for distance ranking.
 */
export type Department = { code: string; name: string; slug: string; region: string };

const D = (code: string, name: string, region: string): Department => ({ code, name, slug: slugifyGeo(name), region });

/** Lightweight slug (no dependency on lib/utils so the domain stays IO-free and importable by tests). */
export function slugifyGeo(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const DEPARTMENTS: readonly Department[] = [
  D("01", "Ain", "Auvergne-Rhône-Alpes"),
  D("02", "Aisne", "Hauts-de-France"),
  D("03", "Allier", "Auvergne-Rhône-Alpes"),
  D("04", "Alpes-de-Haute-Provence", "Provence-Alpes-Côte d'Azur"),
  D("05", "Hautes-Alpes", "Provence-Alpes-Côte d'Azur"),
  D("06", "Alpes-Maritimes", "Provence-Alpes-Côte d'Azur"),
  D("07", "Ardèche", "Auvergne-Rhône-Alpes"),
  D("08", "Ardennes", "Grand Est"),
  D("09", "Ariège", "Occitanie"),
  D("10", "Aube", "Grand Est"),
  D("11", "Aude", "Occitanie"),
  D("12", "Aveyron", "Occitanie"),
  D("13", "Bouches-du-Rhône", "Provence-Alpes-Côte d'Azur"),
  D("14", "Calvados", "Normandie"),
  D("15", "Cantal", "Auvergne-Rhône-Alpes"),
  D("16", "Charente", "Nouvelle-Aquitaine"),
  D("17", "Charente-Maritime", "Nouvelle-Aquitaine"),
  D("18", "Cher", "Centre-Val de Loire"),
  D("19", "Corrèze", "Nouvelle-Aquitaine"),
  D("2A", "Corse-du-Sud", "Corse"),
  D("2B", "Haute-Corse", "Corse"),
  D("21", "Côte-d'Or", "Bourgogne-Franche-Comté"),
  D("22", "Côtes-d'Armor", "Bretagne"),
  D("23", "Creuse", "Nouvelle-Aquitaine"),
  D("24", "Dordogne", "Nouvelle-Aquitaine"),
  D("25", "Doubs", "Bourgogne-Franche-Comté"),
  D("26", "Drôme", "Auvergne-Rhône-Alpes"),
  D("27", "Eure", "Normandie"),
  D("28", "Eure-et-Loir", "Centre-Val de Loire"),
  D("29", "Finistère", "Bretagne"),
  D("30", "Gard", "Occitanie"),
  D("31", "Haute-Garonne", "Occitanie"),
  D("32", "Gers", "Occitanie"),
  D("33", "Gironde", "Nouvelle-Aquitaine"),
  D("34", "Hérault", "Occitanie"),
  D("35", "Ille-et-Vilaine", "Bretagne"),
  D("36", "Indre", "Centre-Val de Loire"),
  D("37", "Indre-et-Loire", "Centre-Val de Loire"),
  D("38", "Isère", "Auvergne-Rhône-Alpes"),
  D("39", "Jura", "Bourgogne-Franche-Comté"),
  D("40", "Landes", "Nouvelle-Aquitaine"),
  D("41", "Loir-et-Cher", "Centre-Val de Loire"),
  D("42", "Loire", "Auvergne-Rhône-Alpes"),
  D("43", "Haute-Loire", "Auvergne-Rhône-Alpes"),
  D("44", "Loire-Atlantique", "Pays de la Loire"),
  D("45", "Loiret", "Centre-Val de Loire"),
  D("46", "Lot", "Occitanie"),
  D("47", "Lot-et-Garonne", "Nouvelle-Aquitaine"),
  D("48", "Lozère", "Occitanie"),
  D("49", "Maine-et-Loire", "Pays de la Loire"),
  D("50", "Manche", "Normandie"),
  D("51", "Marne", "Grand Est"),
  D("52", "Haute-Marne", "Grand Est"),
  D("53", "Mayenne", "Pays de la Loire"),
  D("54", "Meurthe-et-Moselle", "Grand Est"),
  D("55", "Meuse", "Grand Est"),
  D("56", "Morbihan", "Bretagne"),
  D("57", "Moselle", "Grand Est"),
  D("58", "Nièvre", "Bourgogne-Franche-Comté"),
  D("59", "Nord", "Hauts-de-France"),
  D("60", "Oise", "Hauts-de-France"),
  D("61", "Orne", "Normandie"),
  D("62", "Pas-de-Calais", "Hauts-de-France"),
  D("63", "Puy-de-Dôme", "Auvergne-Rhône-Alpes"),
  D("64", "Pyrénées-Atlantiques", "Nouvelle-Aquitaine"),
  D("65", "Hautes-Pyrénées", "Occitanie"),
  D("66", "Pyrénées-Orientales", "Occitanie"),
  D("67", "Bas-Rhin", "Grand Est"),
  D("68", "Haut-Rhin", "Grand Est"),
  D("69", "Rhône", "Auvergne-Rhône-Alpes"),
  D("70", "Haute-Saône", "Bourgogne-Franche-Comté"),
  D("71", "Saône-et-Loire", "Bourgogne-Franche-Comté"),
  D("72", "Sarthe", "Pays de la Loire"),
  D("73", "Savoie", "Auvergne-Rhône-Alpes"),
  D("74", "Haute-Savoie", "Auvergne-Rhône-Alpes"),
  D("75", "Paris", "Île-de-France"),
  D("76", "Seine-Maritime", "Normandie"),
  D("77", "Seine-et-Marne", "Île-de-France"),
  D("78", "Yvelines", "Île-de-France"),
  D("79", "Deux-Sèvres", "Nouvelle-Aquitaine"),
  D("80", "Somme", "Hauts-de-France"),
  D("81", "Tarn", "Occitanie"),
  D("82", "Tarn-et-Garonne", "Occitanie"),
  D("83", "Var", "Provence-Alpes-Côte d'Azur"),
  D("84", "Vaucluse", "Provence-Alpes-Côte d'Azur"),
  D("85", "Vendée", "Pays de la Loire"),
  D("86", "Vienne", "Nouvelle-Aquitaine"),
  D("87", "Haute-Vienne", "Nouvelle-Aquitaine"),
  D("88", "Vosges", "Grand Est"),
  D("89", "Yonne", "Bourgogne-Franche-Comté"),
  D("90", "Territoire de Belfort", "Bourgogne-Franche-Comté"),
  D("91", "Essonne", "Île-de-France"),
  D("92", "Hauts-de-Seine", "Île-de-France"),
  D("93", "Seine-Saint-Denis", "Île-de-France"),
  D("94", "Val-de-Marne", "Île-de-France"),
  D("95", "Val-d'Oise", "Île-de-France"),
  D("971", "Guadeloupe", "Guadeloupe"),
  D("972", "Martinique", "Martinique"),
  D("973", "Guyane", "Guyane"),
  D("974", "La Réunion", "La Réunion"),
  D("976", "Mayotte", "Mayotte"),
];

const byCode = new Map(DEPARTMENTS.map((d) => [d.code, d]));
const bySlug = new Map(DEPARTMENTS.map((d) => [d.slug, d]));

export function findDepartmentByCode(code: string): Department | null {
  return byCode.get(code.toUpperCase()) ?? null;
}

export function findDepartmentBySlug(slug: string): Department | null {
  return bySlug.get(slug.toLowerCase()) ?? null;
}

/** Department code from a 5-digit postal code (handles Corsica and overseas). */
export function departmentFromPostalCode(postalCode: string): Department | null {
  const pc = postalCode.replace(/\s+/g, "");
  if (!/^\d{5}$/.test(pc)) return null;
  if (pc.startsWith("97") || pc.startsWith("98")) return byCode.get(pc.slice(0, 3)) ?? null;
  if (pc.startsWith("20")) {
    const n = Number(pc);
    return byCode.get(n < 20200 ? "2A" : "2B") ?? null;
  }
  return byCode.get(pc.slice(0, 2)) ?? null;
}

export type CityPoint = { name: string; slug: string; departmentCode: string; latitude: number; longitude: number };

const C = (name: string, departmentCode: string, latitude: number, longitude: number): CityPoint => ({ name, slug: slugifyGeo(name), departmentCode, latitude, longitude });

/** ~40 largest cities + prefectures of Occitanie and Nouvelle-Aquitaine (launch regions). */
export const CITIES: readonly CityPoint[] = [
  C("Paris", "75", 48.8566, 2.3522),
  C("Marseille", "13", 43.2965, 5.3698),
  C("Lyon", "69", 45.764, 4.8357),
  C("Toulouse", "31", 43.6047, 1.4442),
  C("Nice", "06", 43.7102, 7.262),
  C("Nantes", "44", 47.2184, -1.5536),
  C("Montpellier", "34", 43.6108, 3.8767),
  C("Strasbourg", "67", 48.5734, 7.7521),
  C("Bordeaux", "33", 44.8378, -0.5792),
  C("Lille", "59", 50.6292, 3.0573),
  C("Rennes", "35", 48.1173, -1.6778),
  C("Reims", "51", 49.2583, 4.0317),
  C("Toulon", "83", 43.1242, 5.928),
  C("Saint-Étienne", "42", 45.4397, 4.3872),
  C("Le Havre", "76", 49.4944, 0.1079),
  C("Grenoble", "38", 45.1885, 5.7245),
  C("Dijon", "21", 47.322, 5.0415),
  C("Angers", "49", 47.4784, -0.5632),
  C("Nîmes", "30", 43.8367, 4.3601),
  C("Clermont-Ferrand", "63", 45.7772, 3.087),
  C("Aix-en-Provence", "13", 43.5297, 5.4474),
  C("Le Mans", "72", 48.0061, 0.1996),
  C("Brest", "29", 48.3904, -4.4861),
  C("Tours", "37", 47.3941, 0.6848),
  C("Amiens", "80", 49.8941, 2.2958),
  C("Limoges", "87", 45.8336, 1.2611),
  C("Annecy", "74", 45.8992, 6.1294),
  C("Perpignan", "66", 42.6887, 2.8948),
  C("Metz", "57", 49.1193, 6.1757),
  C("Besançon", "25", 47.2378, 6.0241),
  C("Orléans", "45", 47.9029, 1.9093),
  C("Rouen", "76", 49.4432, 1.0999),
  C("Mulhouse", "68", 47.7508, 7.3359),
  C("Caen", "14", 49.1829, -0.3707),
  C("Nancy", "54", 48.6921, 6.1844),
  C("Avignon", "84", 43.9493, 4.8055),
  C("Poitiers", "86", 46.5802, 0.3404),
  C("La Rochelle", "17", 46.1603, -1.1511),
  C("Pau", "64", 43.2951, -0.3708),
  C("Bayonne", "64", 43.4929, -1.4748),
  // Occitanie prefectures and notable towns
  C("Albi", "81", 43.9289, 2.1464),
  C("Montauban", "82", 44.0176, 1.3549),
  C("Auch", "32", 43.6461, 0.5858),
  C("Carcassonne", "11", 43.213, 2.3491),
  C("Cahors", "46", 44.4475, 1.4419),
  C("Rodez", "12", 44.3506, 2.575),
  C("Foix", "09", 42.9654, 1.6053),
  C("Tarbes", "65", 43.2328, 0.0781),
  C("Mende", "48", 44.5181, 3.5008),
  C("Béziers", "34", 43.3442, 3.2158),
  C("Sète", "34", 43.4028, 3.6967),
  C("Narbonne", "11", 43.1839, 3.0042),
  C("Castres", "81", 43.6061, 2.2404),
  C("Lavaur", "81", 43.6986, 1.8197),
  C("Colomiers", "31", 43.6113, 1.3345),
  C("Blagnac", "31", 43.6364, 1.3906),
  C("Muret", "31", 43.4615, 1.3269),
  C("Saint-Gaudens", "31", 43.1083, 0.7236),
  C("Alès", "30", 44.1251, 4.0816),
  // Nouvelle-Aquitaine prefectures
  C("Agen", "47", 44.2033, 0.6163),
  C("Angoulême", "16", 45.6484, 0.1562),
  C("Périgueux", "24", 45.1846, 0.7214),
  C("Mont-de-Marsan", "40", 43.8902, -0.4997),
  C("Niort", "79", 46.3237, -0.4648),
  C("Tulle", "19", 45.2663, 1.7712),
  C("Guéret", "23", 46.1716, 1.8715),
  C("Arcachon", "33", 44.6586, -1.1689),
  C("Libourne", "33", 44.9154, -0.2436),
  C("Mérignac", "33", 44.8386, -0.6436),
  C("Pessac", "33", 44.8067, -0.6311),
  C("Biarritz", "64", 43.4832, -1.5586),
];

const citiesBySlug = new Map(CITIES.map((c) => [c.slug, c]));

export function findCity(name: string): CityPoint | null {
  return citiesBySlug.get(slugifyGeo(name)) ?? null;
}

/** Fallback coordinates for a department: the first known city in it (prefecture-ish). */
export function departmentCentroid(code: string): { latitude: number; longitude: number } | null {
  const c = CITIES.find((x) => x.departmentCode === code);
  return c ? { latitude: c.latitude, longitude: c.longitude } : null;
}

export type ResolvedLocation = { department: Department | null; region: string | null; latitude: number | null; longitude: number | null };

/** City + postal code → department, region, approximate coordinates (city table, else department centroid). */
export function resolveLocation(city: string, postalCode: string): ResolvedLocation {
  const department = departmentFromPostalCode(postalCode);
  const known = findCity(city);
  const coords = known ?? (department ? departmentCentroid(department.code) : null);
  return {
    department,
    region: department?.region ?? null,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
  };
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in kilometres. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}
