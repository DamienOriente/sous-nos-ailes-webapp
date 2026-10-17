import Link from "next/link";
import { Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { DemoPhoto } from "@/components/shared/demo-photo";
import { cn } from "@/lib/utils";
import type { DemoPhoto as DemoPhotoEntry } from "@/modules/media/demo-photos";

/** Centered card shared by every authentication page (the (auth) layout provides the centering). */
export function AuthCard({
  eyebrow,
  title,
  description,
  children,
  footer,
  className,
  flat = false,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** Inside an AuthSplit the card has no border of its own. */
  flat?: boolean;
}) {
  return (
    <Card className={cn("gap-6", flat ? "rounded-none border-0 bg-transparent shadow-none" : "mx-auto w-full max-w-md border-border/70 shadow-sm", className)}>
      <CardHeader className="gap-2">
        {eyebrow && <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">{eyebrow}</p>}
        <h1 className="font-heading text-2xl leading-tight font-semibold text-balance">{title}</h1>
        {description && <CardDescription className="text-pretty">{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer && <CardFooter className="flex-col items-start gap-2 border-t pt-5 text-sm text-muted-foreground">{footer}</CardFooter>}
    </Card>
  );
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-primary underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}

/**
 * Sign-in / sign-up shell: on large screens a visual panel (ambience photo,
 * scene, promise, three benefits) sits next to the form; on small screens
 * only a thin photo band remains above it.
 *
 * The (auth) layout centres a 28rem column. The split widens itself with
 * symmetric negative margins so it stays centred without touching the shared
 * layout (see the report: the clean fix is a wider column in that layout).
 */
export function AuthSplit({ panel, children, className }: { panel: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-3xl border bg-card shadow-soft", "lg:mx-auto lg:max-w-4xl lg:grid lg:grid-cols-[minmax(0,1fr)_28rem]", className)}>
      {panel}
      <div className="lg:border-l">{children}</div>
    </div>
  );
}

export function AuthPanel({ photo, scene, promise, benefits, caption }: { photo: DemoPhotoEntry; scene?: React.ReactNode; promise: string; benefits: string[]; caption?: string }) {
  return (
    <aside className="relative flex flex-col justify-end" aria-label="Pourquoi Sous Nos Ailes">
      <div className="relative h-28 lg:absolute lg:inset-0 lg:h-auto">
        <DemoPhoto photo={photo} width={1200} height={1200} sizes="(max-width: 1024px) 100vw, 560px" className="absolute inset-0" priority alt={`Photo d'ambiance de démonstration : ${photo.alt.toLowerCase()}`} />
        <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.2_0.02_150/0.85)] via-[oklch(0.2_0.02_150/0.35)] to-transparent" aria-hidden="true" />
        {scene && <div className="absolute right-4 top-2 w-24 opacity-90 lg:right-8 lg:top-8 lg:w-44">{scene}</div>}
      </div>
      <div className="relative hidden p-8 text-[oklch(0.98_0.005_85)] lg:block">
        <p className="font-heading text-3xl leading-tight text-balance">{promise}</p>
        <ul className="mt-6 space-y-2 text-sm">
          {benefits.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-[oklch(0.85_0.08_150)]" aria-hidden="true" />
              <span className="text-pretty">{b}</span>
            </li>
          ))}
        </ul>
        {caption && <p className="mt-6 text-xs opacity-80">{caption}</p>}
      </div>
    </aside>
  );
}
