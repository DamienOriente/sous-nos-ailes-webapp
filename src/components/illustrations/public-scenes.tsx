import { cn } from "@/lib/utils";

/**
 * Scenes for the public site (home, marketing pages, directory). Same rules as
 * index.tsx: geometric shapes, brand tokens, decorative unless a title is given.
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

/** Search: three listing cards and a magnifier resting on the first one. */
export function SearchScene(props: IllustrationProps) {
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      <ellipse cx="240" cy="296" rx="200" ry="12" fill={P.sand} opacity="0.7" />
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${70 + i * 125} ${90 + (i === 1 ? -16 : 0)})`}>
          <rect width="110" height="150" rx="16" fill={P.paper} stroke={P.sandDeep} strokeWidth="2.5" />
          <rect x="10" y="10" width="90" height="56" rx="10" fill={[P.blush, P.sky, P.sageSoft][i]} />
          <rect x="14" y="78" width="60" height="8" rx="4" fill={P.ink} opacity="0.8" />
          <rect x="14" y="94" width="80" height="6" rx="3" fill={P.sandDeep} />
          <rect x="14" y="108" width="48" height="6" rx="3" fill={P.sandDeep} />
          <rect x="14" y="126" width="36" height="12" rx="6" fill={i === 0 ? P.sageDeep : P.sand} />
        </g>
      ))}
      <circle cx="120" cy="226" r="34" fill="none" stroke={P.sageDeep} strokeWidth="9" />
      <circle cx="120" cy="226" r="26" fill={P.sky} opacity="0.35" />
      <path d="M146 252l34 34" stroke={P.sageDeep} strokeWidth="11" strokeLinecap="round" />
      <circle cx="420" cy="60" r="6" fill={P.gold} />
    </Svg>
  );
}

/** Team: five figures of different roles linked under one line. */
export function TeamScene(props: IllustrationProps) {
  const people = [
    [100, P.sageDeep, P.sageSoft],
    [170, P.blushDeep, P.blush],
    [240, P.ink, P.sand],
    [310, P.skyDeep, P.sky],
    [380, P.gold, P.sand],
  ] as const;
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      <ellipse cx="240" cy="296" rx="210" ry="12" fill={P.sand} opacity="0.7" />
      <path d="M70 110Q240 40 410 110" fill="none" stroke={P.sage} strokeWidth="4" strokeLinecap="round" strokeDasharray="2 10" />
      {people.map(([x, head, body], i) => (
        <g key={x}>
          <circle cx={x} cy={150 + (i === 2 ? -14 : 0)} r={i === 2 ? 22 : 18} fill={head} />
          <path d={`M${x - 34} 262c0-46 68-46 68 0z`} fill={body} />
          <circle cx={x} cy={108 - (i === 2 ? 10 : 0)} r="5" fill={head} />
        </g>
      ))}
    </Svg>
  );
}

/** Hand-over: an adult gives a child's hand to another adult, a wristband between them. */
export function HandoverScene(props: IllustrationProps) {
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      <ellipse cx="240" cy="296" rx="200" ry="12" fill={P.sand} opacity="0.7" />
      <circle cx="120" cy="120" r="24" fill={P.sageDeep} />
      <path d="M72 270c0-70 96-70 96 0z" fill={P.sageSoft} />
      <circle cx="360" cy="124" r="24" fill={P.blushDeep} />
      <path d="M312 270c0-70 96-70 96 0z" fill={P.blush} />
      <circle cx="240" cy="178" r="16" fill={P.skyDeep} />
      <path d="M208 270c0-48 64-48 64 0z" fill={P.sky} />
      <path d="M160 200q40-30 64 0" fill="none" stroke={P.sageDeep} strokeWidth="8" strokeLinecap="round" />
      <path d="M256 200q40-30 64 0" fill="none" stroke={P.blushDeep} strokeWidth="8" strokeLinecap="round" />
      <rect x="222" y="206" width="36" height="10" rx="5" fill={P.gold} />
      <path d="M232 60h16M240 52v16" stroke={P.gold} strokeWidth="4" strokeLinecap="round" />
    </Svg>
  );
}

/** Map: a few pins over soft land shapes. */
export function MapScene(props: IllustrationProps) {
  const pins = [
    [140, 120, P.sageDeep],
    [250, 90, P.blushDeep],
    [330, 170, P.skyDeep],
    [200, 210, P.gold],
  ] as const;
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      <path d="M60 120c40-70 140-80 200-50s150 10 160 80-60 120-150 130S40 260 40 190s10-50 20-70z" fill={P.sageSoft} />
      <path d="M120 150c30-30 90-30 120 0s40 70 0 90-120 10-130-20 0-50 10-70z" fill={P.sand} opacity="0.8" />
      <path d="M90 200q100 30 220 0" fill="none" stroke={P.paper} strokeWidth="6" strokeLinecap="round" />
      {pins.map(([x, y, c]) => (
        <g key={`${x}-${y}`}>
          <path d={`M${x} ${y + 36}c-18-22-26-32-26-46a26 26 0 0 1 52 0c0 14-8 24-26 46z`} fill={c} />
          <circle cx={x} cy={y - 10} r="9" fill={P.paper} />
        </g>
      ))}
    </Svg>
  );
}

/** Letter: an envelope with a feather, for the contact page. */
export function LetterScene(props: IllustrationProps) {
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      <ellipse cx="240" cy="296" rx="180" ry="12" fill={P.sand} opacity="0.7" />
      <rect x="120" y="110" width="240" height="160" rx="18" fill={P.paper} stroke={P.sandDeep} strokeWidth="3" />
      <path d="M124 122l116 92 116-92" fill="none" stroke={P.sageDeep} strokeWidth="4" strokeLinejoin="round" />
      <path d="M124 262l92-76M356 262l-92-76" fill="none" stroke={P.sandDeep} strokeWidth="3" />
      <path d="M300 60c30-30 70-30 90-10-10 40-50 60-90 40 10-10 20-20 40-28" fill={P.sage} />
      <path d="M306 88l60-40" stroke={P.paper} strokeWidth="2" strokeLinecap="round" />
      <circle cx="90" cy="90" r="6" fill={P.gold} />
      <circle cx="420" cy="230" r="5" fill={P.blushDeep} />
    </Svg>
  );
}

/** Reading: a figure with a large open page and a magnifier, for the accessibility page. */
export function ReadingScene(props: IllustrationProps) {
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      <ellipse cx="240" cy="296" rx="190" ry="12" fill={P.sand} opacity="0.7" />
      <rect x="150" y="70" width="210" height="190" rx="16" fill={P.paper} stroke={P.sandDeep} strokeWidth="3" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x="176" y={100 + i * 28} width={i === 0 ? 120 : 160 - (i % 2) * 30} height={i === 0 ? 14 : 9} rx="5" fill={i === 0 ? P.ink : P.sandDeep} opacity={i === 0 ? 0.85 : 1} />
      ))}
      <circle cx="90" cy="150" r="22" fill={P.skyDeep} />
      <path d="M48 270c0-62 84-62 84 0z" fill={P.sky} />
      <circle cx="330" cy="210" r="30" fill={P.sageSoft} stroke={P.sageDeep} strokeWidth="7" opacity="0.95" />
      <path d="M352 232l30 30" stroke={P.sageDeep} strokeWidth="9" strokeLinecap="round" />
      <circle cx="420" cy="70" r="6" fill={P.gold} />
    </Svg>
  );
}

/** Inquiry: a message card leaving with a check mark. */
export function InquiryScene(props: IllustrationProps) {
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      <ellipse cx="240" cy="296" rx="190" ry="12" fill={P.sand} opacity="0.7" />
      <rect x="90" y="80" width="230" height="170" rx="22" fill={P.paper} stroke={P.sandDeep} strokeWidth="3" />
      <rect x="114" y="108" width="100" height="10" rx="5" fill={P.ink} opacity="0.8" />
      <rect x="114" y="132" width="180" height="7" rx="3.5" fill={P.sandDeep} />
      <rect x="114" y="150" width="150" height="7" rx="3.5" fill={P.sandDeep} />
      <rect x="114" y="168" width="170" height="7" rx="3.5" fill={P.sandDeep} />
      <rect x="114" y="200" width="88" height="24" rx="12" fill={P.sageDeep} />
      <path d="M300 60l24-24 24 24-24 24z" fill={P.gold} />
      <circle cx="380" cy="180" r="42" fill={P.sageSoft} />
      <path d="M360 182l14 14 26-30" fill="none" stroke={P.sageDeep} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export const PUBLIC_SCENES = {
  search: SearchScene,
  team: TeamScene,
  handover: HandoverScene,
  map: MapScene,
  letter: LetterScene,
  reading: ReadingScene,
  inquiry: InquiryScene,
} as const;
