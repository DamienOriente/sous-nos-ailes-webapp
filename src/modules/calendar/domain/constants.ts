/** Pure constants shared by server services and client components (no IO imports here). */
export const ENTRY_KINDS = ["event", "service", "availability", "unavailability", "reminder", "other"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];
export const ENTRY_KIND_LABELS: Record<EntryKind, string> = {
  event: "Évènement",
  service: "Prestation",
  availability: "Disponibilité",
  unavailability: "Indisponibilité",
  reminder: "Rappel",
  other: "Autre",
};

export const SYNC_DIRECTIONS = ["export_only", "import_only", "both"] as const;
export type SyncDirection = (typeof SYNC_DIRECTIONS)[number];
export const SYNC_DIRECTION_LABELS: Record<SyncDirection, string> = {
  export_only: "Export seul (interne → externe)",
  import_only: "Import seul (externe → interne)",
  both: "Bidirectionnel",
};
