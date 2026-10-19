import { cn } from "@/lib/utils";

/**
 * Scenes used by the event workspace (empty states, dashboard). Same rules as
 * ./index.tsx: simple shapes, brand tokens, decorative unless a title is given.
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

/** Checklist on a clipboard, two ticks and an empty line. */
export function ChecklistScene(props: IllustrationProps) {
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      <ellipse cx="240" cy="296" rx="160" ry="12" fill={P.sand} opacity="0.7" />
      <rect x="150" y="60" width="180" height="220" rx="18" fill={P.paper} stroke={P.sandDeep} strokeWidth="3" />
      <rect x="205" y="44" width="70" height="30" rx="10" fill={P.sageDeep} />
      <circle cx="240" cy="59" r="6" fill={P.paper} />
      {[110, 160, 210].map((y, i) => (
        <g key={y}>
          <rect x="176" y={y} width="22" height="22" rx="6" fill={i < 2 ? P.sage : P.sand} />
          {i < 2 && <path d={`M181 ${y + 11}l6 6 10-12`} fill="none" stroke={P.paper} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
          <rect x="210" y={y + 4} width={i === 2 ? 60 : 94} height="6" rx="3" fill={i < 2 ? P.sandDeep : P.sand} />
          <rect x="210" y={y + 14} width={i === 2 ? 40 : 70} height="5" rx="2.5" fill={P.sand} />
        </g>
      ))}
      <circle cx="372" cy="98" r="7" fill={P.gold} />
      <circle cx="110" cy="130" r="5" fill={P.blushDeep} />
      <path d="M350 200q24 16 48 0" fill="none" stroke={P.skyDeep} strokeWidth="4" strokeLinecap="round" />
    </Svg>
  );
}

/** Coins stacked beside a small jar: budget. */
export function BudgetScene(props: IllustrationProps) {
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      <ellipse cx="240" cy="296" rx="170" ry="12" fill={P.sand} opacity="0.7" />
      <path d="M190 120h100l-6 160h-88z" fill={P.sky} opacity="0.9" />
      <rect x="182" y="104" width="116" height="22" rx="8" fill={P.skyDeep} />
      <rect x="210" y="170" width="60" height="14" rx="7" fill={P.paper} opacity="0.7" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <ellipse cx="120" cy={270 - i * 16} rx="40" ry="12" fill={P.gold} />
          <ellipse cx="120" cy={266 - i * 16} rx="40" ry="12" fill={P.sandDeep} />
        </g>
      ))}
      <ellipse cx="120" cy="200" rx="40" ry="12" fill={P.gold} />
      <circle cx="360" cy="230" r="34" fill={P.gold} />
      <circle cx="360" cy="230" r="24" fill="none" stroke={P.sandDeep} strokeWidth="3" />
      <path d="M352 222h16M352 238h16M360 214v32" stroke={P.ink} strokeWidth="3" strokeLinecap="round" opacity="0.6" />
      <circle cx="400" cy="90" r="6" fill={P.blushDeep} />
      <circle cx="80" cy="110" r="5" fill={P.sageDeep} />
    </Svg>
  );
}

/** Envelope with a card peeking out: invitations. */
export function EnvelopeScene(props: IllustrationProps) {
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      <ellipse cx="240" cy="296" rx="180" ry="12" fill={P.sand} opacity="0.7" />
      <rect x="150" y="120" width="180" height="130" rx="14" fill={P.blush} />
      <rect x="170" y="80" width="140" height="120" rx="10" fill={P.paper} stroke={P.sandDeep} strokeWidth="2" />
      <rect x="190" y="104" width="100" height="6" rx="3" fill={P.sandDeep} />
      <rect x="200" y="120" width="80" height="5" rx="2.5" fill={P.sand} />
      <rect x="205" y="134" width="70" height="5" rx="2.5" fill={P.sand} />
      <path d="M150 134l90 70 90-70v116H150z" fill={P.blushDeep} />
      <path d="M150 250l90-70 90 70" fill={P.blush} />
      <circle cx="240" cy="224" r="12" fill={P.gold} />
      <path d="M360 110q20-20 40 0" fill="none" stroke={P.skyDeep} strokeWidth="4" strokeLinecap="round" />
      <circle cx="100" cy="100" r="6" fill={P.sageDeep} />
    </Svg>
  );
}

/** Two speech bubbles with an @ mention: messaging. */
export function ChatScene(props: IllustrationProps) {
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      <ellipse cx="240" cy="296" rx="180" ry="12" fill={P.sand} opacity="0.7" />
      <path d="M90 90h190a18 18 0 0 1 18 18v70a18 18 0 0 1-18 18H150l-40 36v-36H90a18 18 0 0 1-18-18v-70a18 18 0 0 1 18-18z" fill={P.sageSoft} stroke={P.sage} strokeWidth="3" />
      <rect x="100" y="118" width="130" height="8" rx="4" fill={P.sageDeep} opacity="0.6" />
      <rect x="100" y="140" width="170" height="8" rx="4" fill={P.sageDeep} opacity="0.35" />
      <rect x="100" y="162" width="90" height="8" rx="4" fill={P.sageDeep} opacity="0.35" />
      <path d="M220 170h170a18 18 0 0 1 18 18v56a18 18 0 0 1-18 18h-30v34l-36-34H220a18 18 0 0 1-18-18v-56a18 18 0 0 1 18-18z" fill={P.blush} stroke={P.blushDeep} strokeWidth="3" />
      <circle cx="250" cy="216" r="14" fill={P.blushDeep} />
      <text x="250" y="222" textAnchor="middle" fontSize="18" fontWeight="700" fill={P.paper} fontFamily="system-ui, sans-serif">
        @
      </text>
      <rect x="274" y="206" width="110" height="8" rx="4" fill={P.blushDeep} opacity="0.7" />
      <rect x="274" y="226" width="70" height="8" rx="4" fill={P.blushDeep} opacity="0.4" />
      <circle cx="420" cy="80" r="6" fill={P.gold} />
    </Svg>
  );
}

/** A stack of documents with a folded corner and a stamp. */
export function DocumentsScene(props: IllustrationProps) {
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      <ellipse cx="240" cy="296" rx="170" ry="12" fill={P.sand} opacity="0.7" />
      <rect x="140" y="96" width="170" height="200" rx="12" fill={P.sand} transform="rotate(-6 225 196)" />
      <rect x="170" y="70" width="170" height="210" rx="12" fill={P.paper} stroke={P.sandDeep} strokeWidth="3" />
      <path d="M300 70v40h40" fill={P.sand} stroke={P.sandDeep} strokeWidth="3" strokeLinejoin="round" />
      <rect x="192" y="130" width="110" height="7" rx="3.5" fill={P.sandDeep} />
      <rect x="192" y="150" width="130" height="6" rx="3" fill={P.sand} />
      <rect x="192" y="168" width="120" height="6" rx="3" fill={P.sand} />
      <rect x="192" y="186" width="90" height="6" rx="3" fill={P.sand} />
      <circle cx="290" cy="238" r="26" fill={P.sageSoft} stroke={P.sageDeep} strokeWidth="3" />
      <path d="M278 238l8 8 16-18" fill="none" stroke={P.sageDeep} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="400" cy="110" r="6" fill={P.blushDeep} />
      <circle cx="90" cy="150" r="5" fill={P.skyDeep} />
    </Svg>
  );
}

/** Two hands shaking under a small roof: providers and venue. */
export function HandshakeScene(props: IllustrationProps) {
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      <ellipse cx="240" cy="296" rx="180" ry="12" fill={P.sand} opacity="0.7" />
      <path d="M120 150L240 70l120 80" fill="none" stroke={P.sageDeep} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="150" y="150" width="180" height="110" rx="10" fill={P.sageSoft} />
      <path d="M160 210q30-30 60-10l20 14q10 8 20 0l30-26q20-10 36 6" fill="none" stroke={P.blushDeep} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M160 210q30-30 60-10l20 14q10 8 20 0l30-26q20-10 36 6" fill="none" stroke={P.blush} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="240" cy="115" r="12" fill={P.gold} />
      <circle cx="400" cy="200" r="6" fill={P.skyDeep} />
      <circle cx="80" cy="200" r="5" fill={P.gold} />
    </Svg>
  );
}

/** A small address book with tabs: contacts. */
export function AddressBookScene(props: IllustrationProps) {
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      <ellipse cx="240" cy="296" rx="170" ry="12" fill={P.sand} opacity="0.7" />
      <rect x="150" y="70" width="180" height="210" rx="16" fill={P.skyDeep} />
      <rect x="170" y="70" width="160" height="210" rx="14" fill={P.paper} stroke={P.sandDeep} strokeWidth="3" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x="330" y={96 + i * 40} width="20" height="28" rx="6" fill={[P.blushDeep, P.gold, P.sage, P.skyDeep][i]} />
      ))}
      <circle cx="210" cy="130" r="18" fill={P.blush} />
      <rect x="240" y="120" width="60" height="7" rx="3.5" fill={P.sandDeep} />
      <rect x="240" y="136" width="44" height="6" rx="3" fill={P.sand} />
      <circle cx="210" cy="196" r="18" fill={P.sageSoft} />
      <rect x="240" y="186" width="70" height="7" rx="3.5" fill={P.sandDeep} />
      <rect x="240" y="202" width="50" height="6" rx="3" fill={P.sand} />
      <circle cx="100" cy="110" r="6" fill={P.gold} />
    </Svg>
  );
}

export const EVENT_SCENES = {
  checklist: ChecklistScene,
  budget: BudgetScene,
  envelope: EnvelopeScene,
  chat: ChatScene,
  documents: DocumentsScene,
  handshake: HandshakeScene,
  addressBook: AddressBookScene,
} as const;
export type EventSceneKey = keyof typeof EVENT_SCENES;
