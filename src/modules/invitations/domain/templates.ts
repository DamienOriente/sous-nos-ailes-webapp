/** Printable invitation templates. `classic` is the only one in the free tier. */
export const INVITATION_TEMPLATES = ["classic", "rustic", "modern", "kids"] as const;
export type InvitationTemplateKey = (typeof INVITATION_TEMPLATES)[number];

export const INVITATION_TEMPLATE_META: Record<InvitationTemplateKey, { label: string; description: string; premium: boolean }> = {
  classic: { label: "Classique", description: "Sobre et élégant, typographie serif, encadré fin.", premium: false },
  rustic: { label: "Champêtre", description: "Tons sable et sauge, feuillages, ambiance nature.", premium: true },
  modern: { label: "Moderne", description: "Aplats de couleur, typographie affirmée, mise en page asymétrique.", premium: true },
  kids: { label: "Enfantin raffiné", description: "Pastels doux, étoiles et confettis discrets, pour baptêmes et anniversaires.", premium: true },
};

export function isTemplateAllowed(key: string, premium: boolean): key is InvitationTemplateKey {
  if (!(INVITATION_TEMPLATES as readonly string[]).includes(key)) return false;
  return premium || !INVITATION_TEMPLATE_META[key as InvitationTemplateKey].premium;
}
