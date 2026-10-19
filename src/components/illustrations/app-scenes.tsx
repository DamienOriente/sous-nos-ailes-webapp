import { cn } from "@/lib/utils";

/**
 * Scenes used by the authenticated area (onboarding, home, notifications,
 * account, admin). Same rules as index.tsx: simple shapes, brand tokens,
 * decorative unless a title is given.
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

/** A shop front with an awning: the professional listing. */
export function StorefrontScene(props: IllustrationProps) {
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      <ellipse cx="240" cy="296" rx="190" ry="12" fill={P.sand} opacity="0.7" />
      <rect x="120" y="130" width="240" height="150" rx="14" fill={P.paper} stroke={P.sandDeep} strokeWidth="3" />
      <path d="M100 130h280l-18-44H118z" fill={P.sageDeep} />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <path key={i} d={`M${100 + i * 40} 130q20 26 40 0z`} fill={i % 2 ? P.sageSoft : P.sage} />
      ))}
      <rect x="150" y="170" width="70" height="60" rx="8" fill={P.sky} />
      <rect x="260" y="170" width="70" height="110" rx="8" fill={P.sandDeep} opacity="0.7" />
      <circle cx="318" cy="228" r="4" fill={P.gold} />
      <rect x="150" y="238" width="70" height="42" rx="8" fill={P.blush} />
      <circle cx="185" cy="200" r="12" fill={P.blushDeep} />
      <rect x="200" y="96" width="80" height="16" rx="8" fill={P.gold} />
      <circle cx="70" cy="90" r="5" fill={P.gold} />
      <circle cx="420" cy="70" r="4" fill={P.blushDeep} />
    </Svg>
  );
}

/** Stack of message cards with a bell: notifications. */
export function InboxScene(props: IllustrationProps) {
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      <ellipse cx="240" cy="296" rx="180" ry="12" fill={P.sand} opacity="0.7" />
      <rect x="130" y="150" width="220" height="110" rx="16" fill={P.sandDeep} opacity="0.5" transform="rotate(-4 240 205)" />
      <rect x="130" y="140" width="220" height="110" rx="16" fill={P.paper} stroke={P.sandDeep} strokeWidth="3" />
      <circle cx="170" cy="178" r="16" fill={P.sageSoft} />
      <rect x="198" y="168" width="110" height="10" rx="5" fill={P.ink} opacity="0.8" />
      <rect x="198" y="186" width="80" height="8" rx="4" fill={P.sandDeep} />
      <rect x="156" y="214" width="170" height="8" rx="4" fill={P.sand} />
      <path d="M330 70a28 28 0 0 1 56 0v26l12 18h-80l12-18z" fill={P.gold} />
      <circle cx="358" cy="124" r="8" fill={P.blushDeep} />
      <circle cx="386" cy="60" r="7" fill={P.blushDeep} stroke={P.paper} strokeWidth="3" />
      <circle cx="90" cy="110" r="5" fill={P.skyDeep} />
      <circle cx="420" cy="200" r="4" fill={P.sage} />
    </Svg>
  );
}

/** Shield with a tick and a small key: account security. */
export function ShieldScene(props: IllustrationProps) {
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      <ellipse cx="240" cy="296" rx="150" ry="12" fill={P.sand} opacity="0.7" />
      <path d="M240 50l110 36v84c0 60-48 100-110 120-62-20-110-60-110-120V86z" fill={P.sageDeep} />
      <path d="M240 72l88 29v69c0 48-38 80-88 98-50-18-88-50-88-98v-69z" fill={P.sageSoft} />
      <path d="M200 170l28 26 52-60" fill="none" stroke={P.sageDeep} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="380" cy="230" r="22" fill={P.gold} />
      <circle cx="380" cy="230" r="8" fill={P.paper} />
      <rect x="396" y="226" width="40" height="8" rx="4" fill={P.gold} />
      <rect x="424" y="234" width="8" height="12" rx="2" fill={P.gold} />
      <circle cx="90" cy="90" r="5" fill={P.blushDeep} />
      <circle cx="120" cy="220" r="4" fill={P.skyDeep} />
    </Svg>
  );
}

/** Two paths leaving a signpost: the onboarding choice. */
export function PathsScene(props: IllustrationProps) {
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      <ellipse cx="240" cy="296" rx="200" ry="14" fill={P.sand} opacity="0.7" />
      <path d="M240 290C200 230 150 200 70 190" fill="none" stroke={P.sandDeep} strokeWidth="26" strokeLinecap="round" />
      <path d="M240 290c40-60 90-90 170-100" fill="none" stroke={P.sandDeep} strokeWidth="26" strokeLinecap="round" />
      <path d="M240 290C200 230 150 200 70 190" fill="none" stroke={P.sand} strokeWidth="4" strokeDasharray="10 14" strokeLinecap="round" />
      <path d="M240 290c40-60 90-90 170-100" fill="none" stroke={P.sand} strokeWidth="4" strokeDasharray="10 14" strokeLinecap="round" />
      <rect x="234" y="120" width="12" height="150" rx="4" fill={P.sageDeep} />
      <path d="M246 130h90l16 16-16 16h-90z" fill={P.blushDeep} />
      <path d="M234 176h-90l-16 16 16 16h90z" fill={P.skyDeep} />
      <circle cx="80" cy="160" r="18" fill={P.blush} />
      <rect x="66" y="174" width="28" height="20" rx="8" fill={P.blushDeep} />
      <rect x="380" y="150" width="40" height="36" rx="6" fill={P.sageSoft} stroke={P.sage} strokeWidth="3" />
      <path d="M376 150h48l-6-14h-36z" fill={P.sage} />
      <circle cx="420" cy="60" r="6" fill={P.gold} />
      <circle cx="60" cy="80" r="4" fill={P.gold} />
    </Svg>
  );
}

/** Rising bars with a trend line: statistics and dashboards. */
export function ChartScene(props: IllustrationProps) {
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      <ellipse cx="240" cy="296" rx="190" ry="12" fill={P.sand} opacity="0.7" />
      <rect x="100" y="70" width="280" height="200" rx="18" fill={P.paper} stroke={P.sandDeep} strokeWidth="3" />
      {[
        [130, 190, 60, P.sky],
        [180, 160, 90, P.sageSoft],
        [230, 130, 120, P.sage],
        [280, 150, 100, P.blush],
        [330, 100, 150, P.sageDeep],
      ].map(([x, y, h, c]) => (
        <rect key={String(x)} x={Number(x)} y={Number(y)} width="32" height={Number(h)} rx="6" fill={String(c)} />
      ))}
      <path d="M146 180l50-26 50-28 50 18 50-50" fill="none" stroke={P.gold} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="346" cy="94" r="8" fill={P.gold} stroke={P.paper} strokeWidth="3" />
      <circle cx="60" cy="110" r="5" fill={P.blushDeep} />
      <circle cx="430" cy="60" r="4" fill={P.skyDeep} />
    </Svg>
  );
}

export const APP_SCENES = {
  storefront: StorefrontScene,
  inbox: InboxScene,
  shield: ShieldScene,
  paths: PathsScene,
  chart: ChartScene,
} as const;
export type AppSceneKey = keyof typeof APP_SCENES;
