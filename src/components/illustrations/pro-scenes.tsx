import { cn } from "@/lib/utils";

/**
 * Scenes for the professional workspace, same language as index.tsx: flat
 * geometric shapes in the brand tokens, decorative unless a title is given.
 */
type IllustrationProps = { className?: string; title?: string };

function Svg({ className, title, viewBox, children }: IllustrationProps & { viewBox: string; children: React.ReactNode }) {
  return (
    <svg viewBox={viewBox} className={cn("block h-auto w-full", className)} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} xmlns="http://www.w3.org/2000/svg">
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

const P = {
  sage: "var(--sna-sage)",
  sageDeep: "var(--sna-sage-deep)",
  sageSoft: "var(--sna-sage-soft)",
  blush: "var(--sna-blush)",
  blushDeep: "var(--sna-blush-deep)",
  sky: "var(--sna-sky)",
  skyDeep: "var(--sna-sky-deep)",
  sand: "var(--sna-sand)",
  sandDeep: "var(--sna-sand-deep)",
  gold: "var(--sna-gold)",
  ink: "var(--sna-charcoal)",
  paper: "var(--card)",
};

/** A shop front with an awning and a small wing sign: "your page is open". */
export function StorefrontScene(props: IllustrationProps) {
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      <ellipse cx="240" cy="296" rx="200" ry="14" fill={P.sand} opacity="0.7" />
      <rect x="120" y="120" width="240" height="160" rx="10" fill={P.paper} stroke={P.sandDeep} strokeWidth="3" />
      <path d="M100 118h280l-18 34H118z" fill={P.sage} />
      {[118, 158, 198, 238, 278, 318].map((x, i) => (
        <path key={x} d={`M${x} 152h40l-6 14h-28z`} fill={i % 2 ? P.sageDeep : P.sage} />
      ))}
      <rect x="146" y="180" width="70" height="100" rx="6" fill={P.sky} />
      <rect x="156" y="190" width="50" height="60" rx="4" fill={P.paper} opacity="0.7" />
      <rect x="250" y="180" width="84" height="76" rx="6" fill={P.blush} />
      <rect x="262" y="192" width="60" height="8" rx="4" fill={P.paper} opacity="0.85" />
      <rect x="262" y="208" width="44" height="8" rx="4" fill={P.paper} opacity="0.85" />
      <rect x="262" y="230" width="30" height="12" rx="6" fill={P.sageDeep} />
      <circle cx="240" cy="90" r="22" fill={P.paper} stroke={P.sandDeep} strokeWidth="3" />
      <path d="M240 98c-6-2-12-7-15-13 5 0 10 2 15 6 5-4 10-6 15-6-3 6-9 11-15 13z" fill={P.sage} />
      <circle cx="400" cy="70" r="5" fill={P.gold} />
      <circle cx="80" cy="90" r="4" fill={P.blushDeep} />
    </Svg>
  );
}

/** Rising bars with a small flag: activity that grows. */
export function TrendScene(props: IllustrationProps) {
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      <ellipse cx="240" cy="296" rx="190" ry="12" fill={P.sand} opacity="0.7" />
      <path d="M90 270h300" stroke={P.sandDeep} strokeWidth="3" strokeLinecap="round" />
      {[
        [110, 70, P.sky],
        [170, 110, P.sageSoft],
        [230, 150, P.sage],
        [290, 190, P.blush],
        [350, 230, P.sageDeep],
      ].map(([x, h, c]) => (
        <rect key={String(x)} x={Number(x)} y={270 - Number(h)} width="40" height={Number(h)} rx="8" fill={String(c)} />
      ))}
      <path d="M120 180 C 190 150, 250 120, 370 60" fill="none" stroke={P.gold} strokeWidth="4" strokeLinecap="round" strokeDasharray="2 10" />
      <circle cx="370" cy="60" r="8" fill={P.gold} />
      <circle cx="120" cy="180" r="6" fill={P.gold} />
    </Svg>
  );
}

/** Two speech bubbles, one answered with a tick: inquiries and replies. */
export function ReplyScene(props: IllustrationProps) {
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      <ellipse cx="240" cy="296" rx="170" ry="12" fill={P.sand} opacity="0.7" />
      <path d="M80 90a24 24 0 0 1 24-24h150a24 24 0 0 1 24 24v60a24 24 0 0 1-24 24H150l-40 36v-36h-6a24 24 0 0 1-24-24z" fill={P.paper} stroke={P.sandDeep} strokeWidth="3" />
      <rect x="104" y="94" width="130" height="8" rx="4" fill={P.sand} />
      <rect x="104" y="112" width="100" height="8" rx="4" fill={P.sand} />
      <rect x="104" y="130" width="60" height="8" rx="4" fill={P.sand} />
      <path d="M400 160a24 24 0 0 1-24 24H246a24 24 0 0 1-24-24v-50a24 24 0 0 1 24-24h120l34-30v30a24 24 0 0 1 24 24z" fill={P.sage} transform="translate(0 90)" />
      <path d="M292 232l16 16 32-34" fill="none" stroke={P.paper} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="420" cy="60" r="5" fill={P.gold} />
      <circle cx="60" cy="230" r="4" fill={P.blushDeep} />
    </Svg>
  );
}
