"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, CloudOff, ExternalLink, Loader2, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { saveDraftAction, submitForReviewAction } from "@/app/app/pro/[id]/page/actions";
import { PageRenderer } from "@/components/pages/renderer";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { DraftState } from "@/modules/pages/application/page-service";
import { defaultBlockFor } from "@/modules/pages/domain/default-content";
import { BLOCK_LABELS, BLOCK_TYPES, newBlockId, type Block, type BlockType, type PageContent, type PageTheme } from "@/modules/pages/domain/page-schema";
import { BlockForm } from "./block-form";
import { SectionList } from "./section-list";
import { SeoPanel } from "./seo-panel";
import { TemplatePicker } from "./template-picker";
import { ThemePanel } from "./theme-panel";
import type { SaveStatus, TemplateSummary } from "./types";

/**
 * Two-pane builder: sections + edit panel on the left, live preview on the
 * right (same components as the public page). Every change is debounced
 * (1.5 s) into `saveDraftAction`; the status pill always says where we are.
 */
const AUTOSAVE_MS = 1500;

type EditorState = { templateKey: string; theme: PageTheme; content: PageContent; seoTitle: string | null; seoDescription: string | null };

export function PageBuilder({ professionalId, initial, templates }: { professionalId: string; initial: DraftState; templates: TemplateSummary[] }) {
  const [state, setState] = useState<EditorState>({
    templateKey: initial.draft.templateKey,
    theme: initial.draft.theme,
    content: initial.draft.content,
    seoTitle: initial.draft.seoTitle,
    seoDescription: initial.draft.seoDescription,
  });
  const [selectedId, setSelectedId] = useState<string | null>(initial.draft.content[0]?.id ?? null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [savedAt, setSavedAt] = useState<string | null>(initial.draft.updatedAt);
  const [versionNumber, setVersionNumber] = useState(initial.draft.versionNumber);
  const [pendingReview, setPendingReview] = useState(initial.pendingReview);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [submitting, startSubmit] = useTransition();
  const dirty = useRef<Partial<EditorState>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const template = useMemo(() => templates.find((t) => t.key === state.templateKey) ?? templates[0], [templates, state.templateKey]);
  const selected = state.content.find((b) => b.id === selectedId) ?? null;
  const renderData = useMemo(() => ({ ...initial.renderData, templateKey: state.templateKey, theme: state.theme, content: state.content }), [initial.renderData, state]);

  const flush = useCallback(async () => {
    const patch = dirty.current;
    dirty.current = {};
    if (Object.keys(patch).length === 0) return;
    setSaveStatus("saving");
    const res = await saveDraftAction({ professionalId, ...patch });
    if (res.ok) {
      setSaveStatus(Object.keys(dirty.current).length > 0 ? "dirty" : "saved");
      setSavedAt(res.data.savedAt);
      setVersionNumber(res.data.versionNumber);
      if (pendingReview) setPendingReview(false); // a frozen version was cloned into a fresh draft
    } else {
      setSaveStatus("error");
      dirty.current = { ...patch, ...dirty.current };
      toast.error(res.error);
    }
  }, [professionalId, pendingReview]);

  const schedule = useCallback(
    (patch: Partial<EditorState>) => {
      dirty.current = { ...dirty.current, ...patch };
      setSaveStatus("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
    },
    [flush],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (saveStatus === "dirty" || saveStatus === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveStatus]);

  const updateContent = (next: PageContent) => {
    setState((s) => ({ ...s, content: next }));
    schedule({ content: next });
  };
  const updateBlock = (b: Block) => updateContent(state.content.map((x) => (x.id === b.id ? b : x)));
  const move = (from: number, to: number) => {
    const next = [...state.content];
    const [item] = next.splice(from, 1);
    if (!item) return;
    next.splice(to, 0, item);
    updateContent(next);
  };
  const addBlock = (type: BlockType) => {
    const b = defaultBlockFor(type, renderData.professional, newBlockId());
    const next = type === "hero" ? [b, ...state.content] : [...state.content, b];
    updateContent(next);
    setSelectedId(b.id);
    setLibraryOpen(false);
  };
  const pickTemplate = (key: string) => {
    const t = templates.find((x) => x.key === key);
    if (!t) return;
    const theme = t.palettes.some((p) => p.key === state.theme.palette) ? state.theme : { ...state.theme, palette: t.palettes[0]?.key };
    setState((s) => ({ ...s, templateKey: key, theme }));
    schedule({ templateKey: key, theme });
  };
  const updateTheme = (theme: PageTheme) => {
    setState((s) => ({ ...s, theme }));
    schedule({ theme });
  };
  const updateSeo = (patch: { seoTitle?: string | null; seoDescription?: string | null }) => {
    setState((s) => ({ ...s, ...patch }));
    schedule(patch);
  };

  const submit = () =>
    startSubmit(async () => {
      if (timer.current) clearTimeout(timer.current);
      await flush();
      const res = await submitForReviewAction(professionalId);
      if (res.ok) {
        setPendingReview(true);
        toast.success("Page soumise à la modération. Vous serez prévenu(e) de la décision.");
      } else toast.error(res.error);
    });

  const hasHero = state.content.some((b) => b.type === "hero");
  const availableTypes = BLOCK_TYPES.filter((t) => t !== "hero" || !hasHero);

  return (
    <div className="-mx-4 flex min-h-[calc(100dvh-3.5rem)] flex-col sm:-mx-6 lg:-mx-8" data-testid="page-builder">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-background px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">Ma page publique</h2>
          <StatusBadge tone={initial.published ? "success" : "neutral"}>{initial.published ? `Version ${initial.published.versionNumber} en ligne` : "Jamais publiée"}</StatusBadge>
          <StatusBadge tone={pendingReview ? "warning" : "info"} dot={false}>
            {pendingReview ? `Version ${versionNumber} en attente de modération` : `Brouillon v${versionNumber}`}
          </StatusBadge>
          <SaveIndicator status={saveStatus} savedAt={savedAt} />
        </div>
        <div className="flex items-center gap-2">
          {initial.published && (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/pro/${initial.slug}`} target="_blank" rel="noopener">
                <ExternalLink aria-hidden="true" /> Page publiée
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/pro/${professionalId}/page/apercu`} data-testid="preview-link">
              Aperçu plein écran
            </Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" disabled={pendingReview || submitting} data-testid="submit-review">
                {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
                Soumettre à la modération
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Soumettre cette version ?</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>Notre équipe relit chaque page avant publication (en général sous 48 h ouvrées) : exactitude des informations, absence de contenu trompeur, respect des règles sur les avis et les mentions de vérification.</p>
                    <p>{initial.published ? "Votre page actuellement en ligne reste visible telle quelle jusqu'à l'approbation de cette nouvelle version." : "Une fois approuvée, votre fiche passe en ligne et devient visible dans l'annuaire."}</p>
                    <p>Vous pouvez continuer à modifier : vos changements iront dans un nouveau brouillon.</p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Pas maintenant</AlertDialogCancel>
                <AlertDialogAction onClick={submit} data-testid="confirm-submit">
                  Soumettre
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      {initial.draft.reviewNote && initial.draft.status === "draft" && (
        <div role="note" className="border-b border-warning/40 bg-warning/15 px-4 py-2 text-sm sm:px-6">
          <span className="font-medium">Retour de la modération :</span> {initial.draft.reviewNote}
        </div>
      )}

      <div className="grid flex-1 lg:grid-cols-[minmax(340px,420px)_1fr]">
        <aside className="border-b bg-background lg:border-r lg:border-b-0" aria-label="Édition">
          <Tabs defaultValue="sections" className="h-full">
            <TabsList className="m-3 grid w-auto grid-cols-4">
              <TabsTrigger value="sections">Sections</TabsTrigger>
              <TabsTrigger value="template">Template</TabsTrigger>
              <TabsTrigger value="theme">Couleurs</TabsTrigger>
              <TabsTrigger value="seo">SEO</TabsTrigger>
            </TabsList>
            <TabsContent value="sections" className="space-y-4 px-3 pb-6">
              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Complétude</span>
                  <span className="tabular-nums" data-testid="completeness-score">
                    {initial.completeness.score} %
                  </span>
                </div>
                <Progress value={initial.completeness.score} className="mt-2" aria-label={`Complétude ${initial.completeness.score} %`} />
                <p className="mt-2 text-xs text-muted-foreground">
                  {initial.completeness.recommendations.find((r) => !r.satisfied)?.message ?? "Tout est renseigné."}{" "}
                  <Link href={`/app/pro/${professionalId}/seo`} className="underline-offset-4 hover:underline">
                    Voir toutes les recommandations
                  </Link>
                </p>
              </div>
              <SectionList blocks={state.content} selectedId={selectedId} onSelect={setSelectedId} onMove={move} onToggleHidden={(id) => updateContent(state.content.map((b) => (b.id === id ? { ...b, hidden: !b.hidden } : b)))} onRemove={(id) => updateContent(state.content.filter((b) => b.id !== id))} />
              <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" className="w-full" disabled={state.content.length >= 30} data-testid="add-section">
                    <Plus aria-hidden="true" /> Ajouter une section
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Ajouter une section</DialogTitle>
                    <DialogDescription>Les sections vides ne s'affichent pas sur la page publique.</DialogDescription>
                  </DialogHeader>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {availableTypes.map((t) => (
                      <li key={t}>
                        <button type="button" onClick={() => addBlock(t)} className="w-full rounded-lg border p-3 text-left hover:bg-muted/60 focus-visible:outline-2">
                          <p className="text-sm font-medium">{BLOCK_LABELS[t].label}</p>
                          <p className="text-xs text-muted-foreground">{BLOCK_LABELS[t].description}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                </DialogContent>
              </Dialog>
              <div className="border-t pt-4" data-testid="block-form">
                {selected ? <BlockForm key={selected.id} block={selected} onChange={updateBlock} professionalId={professionalId} data={renderData} /> : <p className="text-sm text-muted-foreground">Sélectionnez une section pour la modifier.</p>}
              </div>
            </TabsContent>
            <TabsContent value="template" className="px-3 pb-6">
              <TemplatePicker templates={templates} suggested={initial.suggestedTemplates} current={state.templateKey} canUseAll={initial.access.canUseAllTemplates} professionalId={professionalId} onPick={pickTemplate} />
            </TabsContent>
            <TabsContent value="theme" className="px-3 pb-6">{template && <ThemePanel template={template} theme={state.theme} canCustomize={initial.access.canCustomize} professionalId={professionalId} onChange={updateTheme} />}</TabsContent>
            <TabsContent value="seo" className="px-3 pb-6">
              <SeoPanel seoTitle={state.seoTitle} seoDescription={state.seoDescription} professional={renderData.professional} professionalId={professionalId} onChange={updateSeo} />
            </TabsContent>
          </Tabs>
        </aside>

        <section className="flex min-w-0 flex-col bg-muted/40" aria-label="Aperçu en direct">
          <div className="flex items-center justify-between gap-3 border-b bg-background/60 px-4 py-2 text-xs text-muted-foreground">
            <span>Aperçu en direct · template {template?.name}</span>
            <div role="group" aria-label="Taille d'écran" className="flex gap-1">
              <Button type="button" size="xs" variant={device === "desktop" ? "secondary" : "ghost"} aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}>
                Ordinateur
              </Button>
              <Button type="button" size="xs" variant={device === "mobile" ? "secondary" : "ghost"} aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")}>
                Mobile
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-3 sm:p-6">
            <div className={cn("mx-auto overflow-hidden rounded-xl border bg-background shadow-soft transition-[max-width]", device === "mobile" ? "max-w-[390px]" : "max-w-6xl")} data-testid="live-preview">
              <PageRenderer data={renderData} mode="preview" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SaveIndicator({ status, savedAt }: { status: SaveStatus; savedAt: string | null }) {
  const time = savedAt ? new Date(savedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" role="status" data-testid="save-status" data-state={status}>
      {status === "saving" && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
      {status === "saved" && <Check className="size-3.5 text-success" aria-hidden="true" />}
      {status === "error" && <CloudOff className="size-3.5 text-destructive" aria-hidden="true" />}
      {status === "saving" ? "Enregistrement…" : status === "dirty" ? "Modifications en attente" : status === "error" ? "Échec de l'enregistrement" : `Enregistré${time ? ` à ${time}` : ""}`}
    </span>
  );
}
