import type { FontPairingKey } from "@/modules/pages/templates/registry";
import type { RadiusOption } from "@/modules/pages/domain/page-schema";

/** Serialisable template summary handed from the server page to the client editor. */
export type TemplateSummary = {
  key: string;
  name: string;
  universe: string;
  description: string;
  isFree: boolean;
  palettes: Array<{ key: string; name: string; bg: string; accent: string; text: string }>;
  fontPairings: FontPairingKey[];
  radius: RadiusOption;
};

export type SaveStatus = "saved" | "dirty" | "saving" | "error";
