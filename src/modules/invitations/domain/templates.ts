/** Printable invitation templates. `classic` is the only one in the free tier. */
export const INVITATION_TEMPLATES = ["classic", "rustic", "modern", "kids"] as const;
export type InvitationTemplateKey = (typeof INVITATION_TEMPLATES)[number];

export const INVITATION_TEMPLATE_META: Record<InvitationTemplateKey, { label: string; description: string; premium: boolean }> = {
  classic: { label: "Classique", description: "Fond blanc, texte centré, un filet fin autour.", premium: false },
  rustic: { label: "Champêtre", description: "Fond sable, texte centré, date en vert sauge.", premium: true },
  modern: { label: "Moderne", description: "Fond sombre, texte aligné à gauche, très grand titre.", premium: true },
  kids: { label: "Enfantin raffiné", description: "Fond rose pâle, titre bleu, pour baptêmes et anniversaires.", premium: true },
};

export function isTemplateAllowed(key: string, premium: boolean): key is InvitationTemplateKey {
  if (!(INVITATION_TEMPLATES as readonly string[]).includes(key)) return false;
  return premium || !INVITATION_TEMPLATE_META[key as InvitationTemplateKey].premium;
}
