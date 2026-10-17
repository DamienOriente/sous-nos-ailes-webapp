import { cn } from "@/lib/utils";

/**
 * Original SVG illustrations in the brand palette (sage, blush, sky, sand,
 * gold). They use CSS variables so they adapt to light/dark mode, scale with
 * their container and are decorative (aria-hidden) unless a title is given.
 * Keep them simple and geometric: shapes, no photographic realism.
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

/** Wings sheltering two small figures — the brand scene. */
export function WingsScene(props: IllustrationProps) {
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      <ellipse cx="240" cy="290" rx="190" ry="18" fill={P.sand} opacity="0.7" />
      <path d="M240 210C170 210 100 160 60 90c70 0 130 30 180 90 50-60 110-90 180-90-40 70-110 120-180 120z" fill={P.sage} />
      <path d="M240 200c-45-45-100-70-150-78 30 55 85 95 150 108 65-13 120-53 150-108-50 8-105 33-150 78z" fill={P.sageDeep} opacity="0.35" />
      <circle cx="212" cy="236" r="16" fill={P.blushDeep} />
      <rect x="194" y="252" width="36" height="46" rx="12" fill={P.blush} />
      <circle cx="268" cy="246" r="12" fill={P.skyDeep} />
      <rect x="254" y="258" width="28" height="36" rx="10" fill={P.sky} />
      <circle cx="90" cy="60" r="6" fill={P.gold} />
      <circle cx="400" cy="48" r="4" fill={P.blushDeep} />
      <circle cx="430" cy="110" r="5" fill={P.skyDeep} />
      <circle cx="60" cy="150" r="4" fill={P.gold} />
    </Svg>
  );
}

/** Kids corner: blocks, a ball, a bunting line. */
export function KidsCornerScene(props: IllustrationProps) {
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      <ellipse cx="240" cy="292" rx="200" ry="16" fill={P.sand} opacity="0.7" />
      <path d="M40 60Q140 110 240 60t200 0" fill="none" stroke={P.sageDeep} strokeWidth="3" />
      {[70, 120, 170, 220, 270, 320, 370, 420].map((x, i) => (
        <path key={x} d={`M${x} ${62 + (i % 2 ? 12 : 4)} l12 26 l12-26z`} fill={[P.blushDeep, P.skyDeep, P.gold, P.sage][i % 4]} />
      ))}
      <rect x="120" y="200" width="60" height="60" rx="10" fill={P.sky} />
      <rect x="150" y="150" width="60" height="60" rx="10" fill={P.blush} />
      <rect x="185" y="200" width="60" height="60" rx="10" fill={P.sageSoft} stroke={P.sage} strokeWidth="3" />
      <circle cx="320" cy="230" r="34" fill={P.blushDeep} />
      <path d="M286 230a34 34 0 0 1 68 0" fill={P.gold} opacity="0.9" />
      <circle cx="380" cy="258" r="8" fill={P.skyDeep} />
      <circle cx="90" cy="262" r="8" fill={P.gold} />
    </Svg>
  );
}

/** Reception table with chairs and a centrepiece. */
export function TableScene(props: IllustrationProps) {
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      <ellipse cx="240" cy="296" rx="210" ry="14" fill={P.sand} opacity="0.7" />
      <ellipse cx="240" cy="200" rx="150" ry="52" fill={P.paper} stroke={P.sandDeep} strokeWidth="3" />
      <rect x="200" y="200" width="80" height="60" fill={P.sandDeep} opacity="0.5" />
      {[-110, -55, 0, 55, 110].map((dx, i) => (
        <g key={dx}>
          <circle cx={240 + dx} cy={176 + (Math.abs(dx) > 60 ? 10 : 0)} r="13" fill={P.paper} stroke={P.sage} strokeWidth="2.5" />
          <rect x={240 + dx - 10} y={120 + (i % 2) * 8} width="20" height="30" rx="6" fill={[P.sky, P.blush, P.sageSoft, P.blush, P.sky][i]} />
        </g>
      ))}
      <rect x="232" y="150" width="16" height="30" rx="4" fill={P.sageDeep} />
      <circle cx="240" cy="142" r="18" fill={P.blushDeep} />
      <circle cx="226" cy="150" r="10" fill={P.gold} />
      <circle cx="254" cy="150" r="10" fill={P.blush} />
    </Svg>
  );
}

/** Music: notes, a disc and sound waves. */
export function MusicScene(props: IllustrationProps) {
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      <circle cx="240" cy="180" r="90" fill={P.ink} opacity="0.9" />
      <circle cx="240" cy="180" r="62" fill="none" stroke={P.sand} strokeWidth="2" opacity="0.5" />
      <circle cx="240" cy="180" r="40" fill={P.blushDeep} />
      <circle cx="240" cy="180" r="10" fill={P.paper} />
      <path d="M90 120v70a14 14 0 1 1-10-13V110l50-12v60a14 14 0 1 1-10-13v-45z" fill={P.sageDeep} />
      <path d="M380 90v60a12 12 0 1 1-8-11V84l34-8v50a12 12 0 1 1-8-11v-32z" fill={P.skyDeep} />
      <path d="M352 200q20 20 0 40M372 190q32 30 0 60M392 180q44 40 0 80" fill="none" stroke={P.gold} strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="240" cy="290" rx="170" ry="14" fill={P.sand} opacity="0.7" />
    </Svg>
  );
}

/** Camera with a framed moment. */
export function CameraScene(props: IllustrationProps) {
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      <rect x="110" y="110" width="260" height="160" rx="24" fill={P.ink} opacity="0.9" />
      <rect x="180" y="84" width="90" height="40" rx="10" fill={P.ink} opacity="0.9" />
      <circle cx="240" cy="190" r="58" fill={P.sand} />
      <circle cx="240" cy="190" r="42" fill={P.skyDeep} />
      <circle cx="240" cy="190" r="22" fill={P.ink} />
      <circle cx="226" cy="176" r="7" fill={P.paper} opacity="0.8" />
      <rect x="310" y="130" width="34" height="14" rx="7" fill={P.gold} />
      <path d="M60 60l30 0M75 45v30" stroke={P.blushDeep} strokeWidth="4" strokeLinecap="round" />
      <path d="M400 60l24 0M412 48v24" stroke={P.gold} strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="240" cy="296" rx="180" ry="12" fill={P.sand} opacity="0.7" />
    </Svg>
  );
}

/** Flowers in a vase, loose petals. */
export function FlowersScene(props: IllustrationProps) {
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      <ellipse cx="240" cy="296" rx="150" ry="12" fill={P.sand} opacity="0.7" />
      <path d="M200 200h80l-10 90h-60z" fill={P.sky} />
      <path d="M240 200V120" stroke={P.sageDeep} strokeWidth="4" strokeLinecap="round" />
      <path d="M240 190q-50-30-70-80" fill="none" stroke={P.sageDeep} strokeWidth="4" strokeLinecap="round" />
      <path d="M240 190q50-30 70-80" fill="none" stroke={P.sageDeep} strokeWidth="4" strokeLinecap="round" />
      {[
        [240, 110, P.blushDeep],
        [170, 110, P.gold],
        [310, 110, P.blush],
      ].map(([x, y, c]) => (
        <g key={String(x)}>
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <ellipse key={a} cx={Number(x)} cy={Number(y) - 16} rx="9" ry="16" fill={String(c)} transform={`rotate(${a} ${x} ${y})`} />
          ))}
          <circle cx={Number(x)} cy={Number(y)} r="8" fill={P.gold} />
        </g>
      ))}
      <path d="M200 150q-20 10-28 30" fill={P.sageSoft} stroke={P.sage} strokeWidth="2" />
      <path d="M280 150q20 10 28 30" fill={P.sageSoft} stroke={P.sage} strokeWidth="2" />
      <ellipse cx="120" cy="250" rx="8" ry="4" fill={P.blushDeep} transform="rotate(-20 120 250)" />
      <ellipse cx="360" cy="240" rx="8" ry="4" fill={P.blush} transform="rotate(25 360 240)" />
    </Svg>
  );
}

/** Calendar page with a highlighted day and a tick. */
export function CalendarScene(props: IllustrationProps) {
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      <ellipse cx="240" cy="296" rx="170" ry="12" fill={P.sand} opacity="0.7" />
      <rect x="120" y="70" width="240" height="200" rx="20" fill={P.paper} stroke={P.sandDeep} strokeWidth="3" />
      <rect x="120" y="70" width="240" height="48" rx="20" fill={P.sageDeep} />
      <rect x="120" y="100" width="240" height="18" fill={P.sageDeep} />
      <rect x="160" y="54" width="12" height="32" rx="6" fill={P.ink} />
      <rect x="308" y="54" width="12" height="32" rx="6" fill={P.ink} />
      {Array.from({ length: 21 }).map((_, i) => {
        const x = 146 + (i % 7) * 30;
        const y = 140 + Math.floor(i / 7) * 36;
        const hi = i === 11;
        return <rect key={i} x={x} y={y} width="22" height="22" rx="6" fill={hi ? P.blushDeep : i % 5 === 0 ? P.sageSoft : P.sand} />;
      })}
      <path d="M268 176l8 8 16-18" fill="none" stroke={P.paper} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="400" cy="90" r="6" fill={P.gold} />
    </Svg>
  );
}

/** Confetti burst, for success states and celebrations. */
export function ConfettiScene(props: IllustrationProps) {
  const pieces = [
    [60, 80, P.blushDeep, 20],
    [120, 40, P.gold, -15],
    [200, 70, P.skyDeep, 40],
    [280, 30, P.sage, -30],
    [360, 70, P.blushDeep, 10],
    [420, 110, P.gold, 60],
    [90, 180, P.skyDeep, -45],
    [170, 150, P.blush, 25],
    [250, 200, P.gold, -10],
    [330, 160, P.sageDeep, 35],
    [400, 220, P.blush, -25],
    [140, 250, P.sage, 15],
    [300, 260, P.skyDeep, -35],
  ] as const;
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      {pieces.map(([x, y, c, r], i) => (
        <rect key={i} x={x} y={y} width="18" height="10" rx="3" fill={c} transform={`rotate(${r} ${x} ${y})`} />
      ))}
      {[[70, 260], [230, 120], [380, 40], [450, 280]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="5" fill={P.gold} />
      ))}
      <path d="M240 300l-40-110h80z" fill={P.sageDeep} />
      <path d="M200 190h80l-8 22h-64z" fill={P.sage} />
    </Svg>
  );
}

/** Empty nest: for empty states ("rien ici pour l'instant"). */
export function EmptyNestScene(props: IllustrationProps) {
  return (
    <Svg viewBox="0 0 480 320" {...props}>
      <ellipse cx="240" cy="290" rx="160" ry="12" fill={P.sand} opacity="0.7" />
      <path d="M130 200q110 90 220 0-20 70-110 70t-110-70z" fill={P.sandDeep} />
      <path d="M150 196q90 60 180 0" fill="none" stroke={P.sand} strokeWidth="6" strokeLinecap="round" />
      <path d="M140 210q100 40 200 0" fill="none" stroke={P.sand} strokeWidth="4" strokeLinecap="round" opacity="0.7" />
      <ellipse cx="215" cy="190" rx="20" ry="26" fill={P.sky} />
      <ellipse cx="262" cy="186" rx="20" ry="26" fill={P.blush} />
      <path d="M300 120q40-30 70 0" fill="none" stroke={P.sageDeep} strokeWidth="4" strokeLinecap="round" />
      <path d="M90 100q30-24 60 0" fill="none" stroke={P.sageDeep} strokeWidth="4" strokeLinecap="round" />
      <circle cx="400" cy="70" r="5" fill={P.gold} />
    </Svg>
  );
}

export const ILLUSTRATIONS = {
  wings: WingsScene,
  kids: KidsCornerScene,
  table: TableScene,
  music: MusicScene,
  camera: CameraScene,
  flowers: FlowersScene,
  calendar: CalendarScene,
  confetti: ConfettiScene,
  emptyNest: EmptyNestScene,
} as const;
export type IllustrationKey = keyof typeof ILLUSTRATIONS;
