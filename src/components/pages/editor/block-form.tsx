"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BLOCK_LABELS, SOCIAL_NETWORKS, type Block, type BlockOf } from "@/modules/pages/domain/page-schema";
import type { PageRenderData } from "@/modules/pages/domain/render-data";
import { ImageField } from "./image-field";
import { richTextToText, textToRichText } from "./rich-text-codec";

/**
 * Typed edit form for the selected block. Each case receives its narrowed
 * block type and returns a new block (immutable updates); the builder owns the
 * array. Nothing here renders user content as HTML.
 */
type Props<T extends Block["type"]> = { block: BlockOf<T>; onChange: (b: Block) => void; professionalId: string; data: PageRenderData };

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <span className={`text-xs tabular-nums ${value > max ? "text-destructive" : "text-muted-foreground"}`} aria-live="polite">
      {value}/{max}
    </span>
  );
}

function HeadingField({ block, onChange }: { block: Block & { props: { heading?: string } }; onChange: (b: Block) => void }) {
  return (
    <Field id={`${block.id}-heading`} label="Titre de la section">
      <Input id={`${block.id}-heading`} value={block.props.heading ?? ""} maxLength={80} onChange={(e) => onChange({ ...block, props: { ...block.props, heading: e.target.value || undefined } } as Block)} />
    </Field>
  );
}

export function BlockForm({ block, onChange, professionalId, data }: { block: Block; onChange: (b: Block) => void; professionalId: string; data: PageRenderData }) {
  const meta = BLOCK_LABELS[block.type];
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold">{meta.label}</h3>
        <p className="text-xs text-muted-foreground">{meta.description}</p>
      </div>
      {renderForm({ block, onChange, professionalId, data })}
    </div>
  );
}

function renderForm(p: { block: Block; onChange: (b: Block) => void; professionalId: string; data: PageRenderData }) {
  switch (p.block.type) {
    case "hero":
      return <HeroForm {...(p as Props<"hero">)} />;
    case "about":
      return <AboutForm {...(p as Props<"about">)} />;
    case "services":
      return <ServicesForm {...(p as Props<"services">)} />;
    case "pricing":
      return <PricingForm {...(p as Props<"pricing">)} />;
    case "gallery":
      return <GalleryForm {...(p as Props<"gallery">)} />;
    case "testimonials":
      return <TestimonialsForm {...(p as Props<"testimonials">)} />;
    case "faq":
      return <FaqForm {...(p as Props<"faq">)} />;
    case "contact":
      return <ContactForm {...(p as Props<"contact">)} />;
    case "availability":
      return <NoteForm {...(p as Props<"availability">)} info="Les créneaux affichés viennent de votre fiche (onglet Disponibilités)." />;
    case "social":
      return <SocialForm {...(p as Props<"social">)} />;
    case "cta_quote":
      return <CtaForm {...(p as Props<"cta_quote">)} />;
    case "trust":
      return <NoteForm {...(p as Props<"trust">)} info="Seules les vérifications réellement effectuées par la plateforme apparaissent ; vous ne pouvez pas en ajouter ici." />;
    case "zone":
      return <ZoneForm {...(p as Props<"zone">)} />;
  }
}

function HeroForm({ block, onChange, professionalId }: Props<"hero">) {
  const set = (patch: Partial<typeof block.props>) => onChange({ ...block, props: { ...block.props, ...patch } });
  return (
    <>
      <Field id={`${block.id}-title`} label="Titre">
        <Input id={`${block.id}-title`} value={block.props.title} maxLength={90} required onChange={(e) => set({ title: e.target.value })} data-testid="hero-title-input" />
      </Field>
      <Field id={`${block.id}-kicker`} label="Ligne au-dessus du titre" hint="Par défaut : métier et ville.">
        <Input id={`${block.id}-kicker`} value={block.props.kicker ?? ""} maxLength={80} onChange={(e) => set({ kicker: e.target.value || undefined })} />
      </Field>
      <Field id={`${block.id}-subtitle`} label="Accroche">
        <Textarea id={`${block.id}-subtitle`} value={block.props.subtitle ?? ""} maxLength={220} rows={3} onChange={(e) => set({ subtitle: e.target.value || undefined })} />
      </Field>
      <ImageField id={`${block.id}-img`} label="Image principale" professionalId={professionalId} purpose="cover" fileId={block.props.imageFileId} alt={block.props.imageAlt} onChange={(n) => set({ imageFileId: n.fileId, imageAlt: n.alt })} />
      <Field id={`${block.id}-cta`} label="Texte du bouton" hint="Le bouton mène au formulaire de demande.">
        <Input id={`${block.id}-cta`} value={block.props.cta?.label ?? ""} maxLength={60} onChange={(e) => set({ cta: e.target.value ? { label: e.target.value, action: "quote" } : undefined })} />
      </Field>
    </>
  );
}

function AboutForm({ block, onChange, professionalId }: Props<"about">) {
  const set = (patch: Partial<typeof block.props>) => onChange({ ...block, props: { ...block.props, ...patch } });
  const text = richTextToText(block.props.body);
  return (
    <>
      <HeadingField block={block} onChange={onChange} />
      <Field id={`${block.id}-body`} label="Texte" hint="Une ligne vide sépare les paragraphes. « - » en début de ligne pour une liste, **gras**, _italique_.">
        <Textarea id={`${block.id}-body`} defaultValue={text} rows={12} maxLength={6000} onChange={(e) => set({ body: textToRichText(e.target.value) })} data-testid="about-body-input" />
        <Counter value={text.length} max={6000} />
      </Field>
      <ImageField id={`${block.id}-img`} label="Image d'illustration (facultative)" professionalId={professionalId} purpose="gallery" fileId={block.props.imageFileId} alt={block.props.imageAlt} onChange={(n) => set({ imageFileId: n.fileId, imageAlt: n.alt })} />
    </>
  );
}

function ServicesForm({ block, onChange, data }: Props<"services">) {
  const set = (patch: Partial<typeof block.props>) => onChange({ ...block, props: { ...block.props, ...patch } });
  const items = block.props.items;
  return (
    <>
      <HeadingField block={block} onChange={onChange} />
      <Field id={`${block.id}-intro`} label="Introduction (facultative)">
        <Textarea id={`${block.id}-intro`} value={block.props.intro ?? ""} maxLength={300} rows={2} onChange={(e) => set({ intro: e.target.value || undefined })} />
      </Field>
      <Field id={`${block.id}-source`} label="Source des prestations">
        <Select value={block.props.source} onValueChange={(v) => set({ source: v as "catalog" | "custom" })}>
          <SelectTrigger id={`${block.id}-source`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="catalog">Mon catalogue ({data.services.length} prestation{data.services.length > 1 ? "s" : ""})</SelectItem>
            <SelectItem value="custom">Texte libre</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {block.props.source === "custom" && (
        <div className="space-y-3">
          {items.map((it, i) => (
            <div key={i} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Prestation {i + 1}</p>
                <Button type="button" variant="ghost" size="icon-xs" aria-label={`Supprimer la prestation ${i + 1}`} onClick={() => set({ items: items.filter((_, j) => j !== i) })}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
              <Input aria-label="Nom de la prestation" value={it.name} maxLength={80} placeholder="Nom" onChange={(e) => set({ items: items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
              <Textarea aria-label="Description" value={it.description ?? ""} maxLength={400} rows={2} placeholder="Description" onChange={(e) => set({ items: items.map((x, j) => (j === i ? { ...x, description: e.target.value || undefined } : x)) })} />
              <Input aria-label="Prix indicatif" value={it.priceLabel ?? ""} maxLength={40} placeholder="à partir de 350 €" onChange={(e) => set({ items: items.map((x, j) => (j === i ? { ...x, priceLabel: e.target.value || undefined } : x)) })} />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" disabled={items.length >= 12} onClick={() => set({ items: [...items, { name: "" }] })}>
            <Plus aria-hidden="true" /> Ajouter une prestation
          </Button>
        </div>
      )}
    </>
  );
}

function PricingForm({ block, onChange }: Props<"pricing">) {
  const set = (patch: Partial<typeof block.props>) => onChange({ ...block, props: { ...block.props, ...patch } });
  const items = block.props.items;
  return (
    <>
      <HeadingField block={block} onChange={onChange} />
      <div className="space-y-3">
        {items.map((it, i) => (
          <div key={i} className="grid gap-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Tarif {i + 1} — affiché « à partir de »</p>
              <Button type="button" variant="ghost" size="icon-xs" aria-label={`Supprimer le tarif ${i + 1}`} onClick={() => set({ items: items.filter((_, j) => j !== i) })}>
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
            <Input aria-label="Intitulé" value={it.label} maxLength={80} placeholder="Intitulé" onChange={(e) => set({ items: items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
            <div className="grid grid-cols-2 gap-2">
              <Input aria-label="Montant en euros" type="number" min={0} step={1} value={Math.round(it.priceCents / 100)} onChange={(e) => set({ items: items.map((x, j) => (j === i ? { ...x, priceCents: Math.max(0, Math.round(Number(e.target.value) || 0)) * 100 } : x)) })} />
              <Input aria-label="Unité" value={it.unit ?? ""} maxLength={30} placeholder="la soirée" onChange={(e) => set({ items: items.map((x, j) => (j === i ? { ...x, unit: e.target.value || undefined } : x)) })} />
            </div>
            <Input aria-label="Précision" value={it.note ?? ""} maxLength={160} placeholder="Précision (facultative)" onChange={(e) => set({ items: items.map((x, j) => (j === i ? { ...x, note: e.target.value || undefined } : x)) })} />
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" disabled={items.length >= 8} onClick={() => set({ items: [...items, { label: "", priceCents: 0 }] })}>
          <Plus aria-hidden="true" /> Ajouter un tarif
        </Button>
      </div>
      <Field id={`${block.id}-disc`} label="Mention">
        <Textarea id={`${block.id}-disc`} value={block.props.disclaimer ?? ""} maxLength={200} rows={2} onChange={(e) => set({ disclaimer: e.target.value || undefined })} />
      </Field>
    </>
  );
}

function GalleryForm({ block, onChange, professionalId }: Props<"gallery">) {
  const set = (patch: Partial<typeof block.props>) => onChange({ ...block, props: { ...block.props, ...patch } });
  const images = block.props.images;
  return (
    <>
      <HeadingField block={block} onChange={onChange} />
      <div className="space-y-3">
        {images.map((img, i) => (
          <ImageField
            key={img.fileId}
            id={`${block.id}-${i}`}
            label={`Image ${i + 1}`}
            professionalId={professionalId}
            purpose="gallery"
            fileId={img.fileId}
            alt={img.alt}
            onChange={(n) => set({ images: n.fileId ? images.map((x, j) => (j === i ? { ...x, alt: n.alt ?? "" } : x)) : images.filter((_, j) => j !== i) })}
          />
        ))}
        {images.length < 24 && <ImageField id={`${block.id}-new`} label="Ajouter une photo" professionalId={professionalId} purpose="gallery" onChange={(n) => n.fileId && set({ images: [...images, { fileId: n.fileId, alt: "" }] })} />}
      </div>
    </>
  );
}

function TestimonialsForm({ block, onChange, data }: Props<"testimonials">) {
  const set = (patch: Partial<typeof block.props>) => onChange({ ...block, props: { ...block.props, ...patch } });
  const ids = block.props.reviewIds;
  return (
    <>
      <HeadingField block={block} onChange={onChange} />
      <p className="text-xs text-muted-foreground">Seuls les avis vérifiés et publiés peuvent apparaître. Sans sélection, les trois plus récents sont affichés.</p>
      {data.reviews.length === 0 ? (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Aucun avis publié pour l'instant.</p>
      ) : (
        <ul className="space-y-2">
          {data.reviews.map((r) => {
            const checked = ids.includes(r.id);
            return (
              <li key={r.id} className="flex items-start gap-3 rounded-lg border p-3">
                <Switch id={`${block.id}-${r.id}`} checked={checked} onCheckedChange={(v) => set({ reviewIds: v ? [...ids, r.id].slice(0, 6) : ids.filter((x) => x !== r.id) })} />
                <Label htmlFor={`${block.id}-${r.id}`} className="flex-1 cursor-pointer flex-col items-start gap-1">
                  <span className="text-sm">
                    {r.authorName} · {r.rating}/5
                  </span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">{r.body}</span>
                </Label>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function FaqForm({ block, onChange }: Props<"faq">) {
  const set = (patch: Partial<typeof block.props>) => onChange({ ...block, props: { ...block.props, ...patch } });
  const items = block.props.items;
  return (
    <>
      <HeadingField block={block} onChange={onChange} />
      <div className="space-y-3">
        {items.map((it, i) => (
          <div key={i} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Question {i + 1}</p>
              <Button type="button" variant="ghost" size="icon-xs" aria-label={`Supprimer la question ${i + 1}`} onClick={() => set({ items: items.filter((_, j) => j !== i) })}>
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
            <Input aria-label="Question" value={it.question} maxLength={160} placeholder="Question" onChange={(e) => set({ items: items.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)) })} />
            <Textarea aria-label="Réponse" value={it.answer} maxLength={1000} rows={3} placeholder="Réponse" onChange={(e) => set({ items: items.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)) })} />
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" disabled={items.length >= 12} onClick={() => set({ items: [...items, { question: "", answer: "" }] })}>
          <Plus aria-hidden="true" /> Ajouter une question
        </Button>
      </div>
    </>
  );
}

function ContactForm({ block, onChange, data }: Props<"contact">) {
  const set = (patch: Partial<typeof block.props>) => onChange({ ...block, props: { ...block.props, ...patch } });
  const pro = data.professional;
  const toggles: Array<{ key: "showEmail" | "showPhone" | "showWebsite"; label: string; value: string | null }> = [
    { key: "showEmail", label: "Afficher l'e-mail", value: pro.publicEmail },
    { key: "showPhone", label: "Afficher le téléphone", value: pro.publicPhone },
    { key: "showWebsite", label: "Afficher le site web", value: pro.website },
  ];
  return (
    <>
      <HeadingField block={block} onChange={onChange} />
      <Field id={`${block.id}-note`} label="Message d'introduction">
        <Textarea id={`${block.id}-note`} value={block.props.note ?? ""} maxLength={300} rows={2} onChange={(e) => set({ note: e.target.value || undefined })} />
      </Field>
      <div className="space-y-2">
        {toggles.map((t) => (
          <div key={t.key} className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <Label htmlFor={`${block.id}-${t.key}`} className="flex-col items-start gap-0.5">
              <span>{t.label}</span>
              <span className="text-xs font-normal text-muted-foreground">{t.value ?? "non renseigné dans la fiche"}</span>
            </Label>
            <Switch id={`${block.id}-${t.key}`} checked={block.props[t.key]} disabled={!t.value} onCheckedChange={(v) => set({ [t.key]: v })} />
          </div>
        ))}
      </div>
    </>
  );
}

function NoteForm({ block, onChange, info }: Props<"availability" | "trust"> & { info: string }) {
  const set = (patch: { heading?: string; note?: string }) => onChange({ ...block, props: { ...block.props, ...patch } } as Block);
  return (
    <>
      <HeadingField block={block} onChange={onChange} />
      <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">{info}</p>
      <Field id={`${block.id}-note`} label="Note (facultative)">
        <Textarea id={`${block.id}-note`} value={block.props.note ?? ""} maxLength={300} rows={2} onChange={(e) => set({ note: e.target.value || undefined })} />
      </Field>
    </>
  );
}

function SocialForm({ block, onChange }: Props<"social">) {
  const set = (patch: Partial<typeof block.props>) => onChange({ ...block, props: { ...block.props, ...patch } });
  const links = block.props.links;
  return (
    <>
      <HeadingField block={block} onChange={onChange} />
      <div className="space-y-2">
        {links.map((l, i) => (
          <div key={i} className="grid grid-cols-[120px_1fr_auto] items-center gap-2">
            <Select value={l.network} onValueChange={(v) => set({ links: links.map((x, j) => (j === i ? { ...x, network: v as (typeof SOCIAL_NETWORKS)[number] } : x)) })}>
              <SelectTrigger aria-label="Réseau">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOCIAL_NETWORKS.map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input aria-label="Adresse" type="url" value={l.url} placeholder="https://…" onChange={(e) => set({ links: links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
            <Button type="button" variant="ghost" size="icon-xs" aria-label={`Supprimer le lien ${i + 1}`} onClick={() => set({ links: links.filter((_, j) => j !== i) })}>
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" disabled={links.length >= 7} onClick={() => set({ links: [...links, { network: "instagram", url: "https://" }] })}>
          <Plus aria-hidden="true" /> Ajouter un lien
        </Button>
        <p className="text-xs text-muted-foreground">Seules les adresses http(s) sont acceptées.</p>
      </div>
    </>
  );
}

function CtaForm({ block, onChange }: Props<"cta_quote">) {
  const set = (patch: Partial<typeof block.props>) => onChange({ ...block, props: { ...block.props, ...patch } });
  return (
    <>
      <Field id={`${block.id}-title`} label="Titre">
        <Input id={`${block.id}-title`} value={block.props.title} maxLength={90} onChange={(e) => set({ title: e.target.value })} />
      </Field>
      <Field id={`${block.id}-text`} label="Texte">
        <Textarea id={`${block.id}-text`} value={block.props.text ?? ""} maxLength={300} rows={2} onChange={(e) => set({ text: e.target.value || undefined })} />
      </Field>
      <Field id={`${block.id}-btn`} label="Bouton">
        <Input id={`${block.id}-btn`} value={block.props.buttonLabel} maxLength={60} onChange={(e) => set({ buttonLabel: e.target.value })} />
      </Field>
    </>
  );
}

function ZoneForm({ block, onChange, data }: Props<"zone">) {
  const set = (patch: Partial<typeof block.props>) => onChange({ ...block, props: { ...block.props, ...patch } });
  const pro = data.professional;
  return (
    <>
      <HeadingField block={block} onChange={onChange} />
      <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
        Ville et rayon viennent de votre fiche : {pro.city ?? "ville non renseignée"}, {pro.interventionRadiusKm} km.
      </p>
      <Field id={`${block.id}-deps`} label="Départements couverts" hint="Numéros séparés par des virgules (31, 81, 82).">
        <Input
          id={`${block.id}-deps`}
          defaultValue={block.props.departments.join(", ")}
          onChange={(e) =>
            set({
              departments: e.target.value
                .split(/[,\s]+/)
                .map((d) => d.trim().toUpperCase())
                .filter((d) => /^(\d{2,3}|2A|2B)$/.test(d))
                .slice(0, 20),
            })
          }
        />
      </Field>
      <Field id={`${block.id}-note`} label="Précision (facultative)">
        <Textarea id={`${block.id}-note`} value={block.props.note ?? ""} maxLength={300} rows={2} onChange={(e) => set({ note: e.target.value || undefined })} />
      </Field>
    </>
  );
}
