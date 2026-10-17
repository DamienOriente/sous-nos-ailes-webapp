// Original botanical SVG illustrations in the herbarium world: flat two-tone
// sage/ivory, no gradients. Everything is drawn procedurally so the repository
// ships no external asset. Provenance: authored in this repository (see docs/assets.md).

type BranchProps = {
  x: number;
  y: number;
  angle: number; // degrees, 0 = up
  length: number;
  leaves: number;
  leafLength: number;
  leafWidth: number;
  curve?: number;
  kind?: "sage" | "olive" | "eucalyptus" | "gypsophila" | "fern";
  color?: string;
  accent?: string;
  className?: string;
};

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/** Smooth stem with alternating leaves. Deterministic: no randomness. */
export function Branch({ x, y, angle, length, leaves, leafLength, leafWidth, curve = 0.18, kind = "sage", color = "var(--color-sage-600)", accent = "var(--color-sage-400)", className }: BranchProps) {
  const a = toRad(angle);
  const ex = x + Math.sin(a) * length;
  const ey = y - Math.cos(a) * length;
  const cx = (x + ex) / 2 + Math.cos(a) * length * curve;
  const cy = (y + ey) / 2 + Math.sin(a) * length * curve;
  const items = [];
  for (let i = 0; i < leaves; i += 1) {
    const t = 0.18 + (i / Math.max(1, leaves - 1)) * 0.78;
    // point on the quadratic curve
    const px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * cx + t * t * ex;
    const py = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * cy + t * t * ey;
    const side = i % 2 === 0 ? 1 : -1;
    const tangent = Math.atan2(ey - y, ex - x);
    const leafAngle = (tangent * 180) / Math.PI + side * 52;
    const scale = 0.7 + 0.3 * Math.sin(t * Math.PI);
    if (kind === "gypsophila") {
      items.push(
        <g key={i} transform={`translate(${px} ${py}) rotate(${leafAngle})`}>
          <line x1="0" y1="0" x2={leafLength * 0.9} y2="0" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
          <circle cx={leafLength * 0.9} cy="0" r={leafWidth * scale} fill="var(--color-ivory-50)" stroke={color} strokeWidth="1.1" />
          <circle cx={leafLength * 0.55} cy={-leafWidth * 1.4} r={leafWidth * 0.55} fill={accent} />
        </g>,
      );
    } else if (kind === "eucalyptus") {
      items.push(
        <g key={i} transform={`translate(${px} ${py}) rotate(${leafAngle})`}>
          <circle cx={leafLength * 0.45} cy="0" r={leafWidth * scale} fill={i % 3 === 0 ? accent : color} />
          <circle cx={leafLength * 0.45} cy="0" r={leafWidth * scale * 0.35} fill="var(--color-ivory-50)" opacity="0.55" />
        </g>,
      );
    } else if (kind === "fern") {
      items.push(
        <g key={i} transform={`translate(${px} ${py}) rotate(${leafAngle})`}>
          <path d={`M0 0 Q ${leafLength * 0.4} ${-leafWidth * 0.8} ${leafLength * scale} 0 Q ${leafLength * 0.4} ${leafWidth * 0.8} 0 0 Z`} fill={color} />
          <line x1="0" y1="0" x2={leafLength * scale * 0.9} y2="0" stroke="var(--color-ivory-50)" strokeWidth="0.7" opacity="0.8" />
        </g>,
      );
    } else {
      const fill = kind === "olive" ? (i % 2 === 0 ? color : accent) : color;
      items.push(
        <g key={i} transform={`translate(${px} ${py}) rotate(${leafAngle})`}>
          <ellipse cx={leafLength * 0.5 * scale} cy="0" rx={leafLength * 0.5 * scale} ry={leafWidth * scale} fill={fill} />
          <line x1="0" y1="0" x2={leafLength * scale * 0.92} y2="0" stroke="var(--color-ivory-100)" strokeWidth="0.8" opacity="0.7" />
        </g>,
      );
    }
  }
  return (
    <g className={className}>
      <path d={`M ${x} ${y} Q ${cx} ${cy} ${ex} ${ey}`} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      {items}
      {kind === "olive" ? <ellipse cx={ex} cy={ey} rx="3.2" ry="4.2" fill="var(--color-clay-500)" transform={`rotate(${angle} ${ex} ${ey})`} /> : null}
    </g>
  );
}

/** Small clay paper strip that "pins" a specimen to the sheet. */
export function PinStrip({ x, y, angle = -12, width = 26 }: { x: number; y: number; angle?: number; width?: number }) {
  return <rect x={x - width / 2} y={y - 4} width={width} height="8" rx="1" fill="var(--color-clay-300)" opacity="0.85" transform={`rotate(${angle} ${x} ${y})`} />;
}

/** Hand-written specimen caption, haloed in ivory so it stays legible over leaves. */
function Caption({ x, y, anchor = "start", children }: { x: number; y: number; anchor?: "start" | "end"; children: string }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontFamily="var(--font-sans)" fontSize="12" fill="var(--color-ink-500)" stroke="var(--color-ivory-50)" strokeWidth="3.5" strokeLinejoin="round" paintOrder="stroke">
      {children}
    </text>
  );
}

/**
 * Hero composition: a herbarium plate. The arrangement leans left so that the
 * HTML label card (bottom-right at ≥ 640 px) never covers a specimen or a
 * caption: nothing important sits in x ≥ 250 / y ≥ 465. One dominant sage
 * specimen reaches the top third, an olive and a eucalyptus stem cross it, a
 * gypsophila sits top-right and a fern bottom-left. Pins carry a number; a
 * numbered legend lists the specimens in the free upper-right zone. Every
 * stem and leaf stays inside the inner frame (x 18–502, y 18–582).
 */
export function HerbariumPlate({ className, animate = true }: { className?: string; animate?: boolean }) {
  const settle = (n: number) => (animate ? `settle settle-delay-${n}` : undefined);
  const pressed = { mixBlendMode: "multiply" as const };
  const legend = ["Sauge", "Olivier", "Eucalyptus", "Gypsophile", "Fougère"];
  return (
    <svg viewBox="0 0 520 600" preserveAspectRatio="xMidYMax slice" role="img" aria-labelledby="herbarium-title herbarium-desc" className={className}>
      <title id="herbarium-title">Planche d’herbier</title>
      <desc id="herbarium-desc">Cinq spécimens pressés — sauge, olivier, eucalyptus, gypsophile et fougère — fixés sur une feuille ivoire par de petites bandes argile numérotées, avec leur légende.</desc>
      <rect x="0.5" y="0.5" width="519" height="599" rx="6" fill="var(--color-ivory-50)" stroke="var(--color-ivory-300)" />
      <rect x="18" y="18" width="484" height="564" rx="2" fill="none" stroke="var(--color-sage-200)" strokeWidth="0.8" />
      <g className={settle(0)} style={pressed}>
        <Branch x={196} y={540} angle={5} length={430} leaves={15} leafLength={58} leafWidth={14} curve={0.04} kind="sage" />
      </g>
      <g className={settle(1)} style={pressed}>
        <Branch x={110} y={462} angle={42} length={310} leaves={12} leafLength={46} leafWidth={7} curve={-0.06} kind="olive" color="var(--color-sage-700)" accent="var(--color-sage-500)" />
      </g>
      <g className={settle(2)} style={pressed}>
        <Branch x={316} y={430} angle={-44} length={260} leaves={9} leafLength={38} leafWidth={15} curve={0.08} kind="eucalyptus" color="var(--color-sage-500)" accent="var(--color-sage-300)" />
      </g>
      <g className={settle(3)}>
        <Branch x={470} y={230} angle={-35} length={170} leaves={7} leafLength={24} leafWidth={3.4} curve={0.06} kind="gypsophila" color="var(--color-sage-600)" accent="var(--color-clay-300)" />
      </g>
      <g className={settle(3)}>
        <Branch x={70} y={575} angle={14} length={120} leaves={9} leafLength={26} leafWidth={6} curve={0.04} kind="fern" color="var(--color-sage-400)" />
      </g>
      <g className={settle(3)}>
        <PinStrip x={207} y={412} angle={5} width={30} />
        <Caption x={186} y={416} anchor="end">1</Caption>
        <PinStrip x={135} y={434} angle={42} width={26} />
        <Caption x={116} y={452} anchor="end">2</Caption>
        <PinStrip x={271} y={383} angle={-44} width={26} />
        <Caption x={290} y={400}>3</Caption>
        <PinStrip x={431} y={174} angle={-35} width={22} />
        <Caption x={449} y={192}>4</Caption>
        <PinStrip x={82} y={528} angle={14} width={22} />
        <Caption x={98} y={546}>5</Caption>
      </g>
      <g className={settle(3)} aria-hidden="true">
        <line x1="366" y1="288" x2="478" y2="288" stroke="var(--color-clay-400)" strokeWidth="1.2" />
        {legend.map((name, index) => (
          <Caption key={name} x={366} y={310 + index * 22}>{`n° ${index + 1} — ${name}`}</Caption>
        ))}
      </g>
    </svg>
  );
}

/** Reusable sprig for section labels and list markers. */
export function Sprig({ kind = "sage", className, size = 56 }: { kind?: BranchProps["kind"]; className?: string; size?: number }) {
  const presets: Record<NonNullable<BranchProps["kind"]>, Omit<BranchProps, "x" | "y">> = {
    sage: { angle: 18, length: 54, leaves: 6, leafLength: 20, leafWidth: 5.5, kind: "sage" },
    olive: { angle: -16, length: 56, leaves: 7, leafLength: 18, leafWidth: 3.4, kind: "olive", color: "var(--color-sage-700)", accent: "var(--color-sage-500)" },
    eucalyptus: { angle: 10, length: 54, leaves: 6, leafLength: 16, leafWidth: 6, kind: "eucalyptus", color: "var(--color-sage-500)", accent: "var(--color-sage-300)" },
    gypsophila: { angle: -22, length: 52, leaves: 6, leafLength: 14, leafWidth: 2.4, kind: "gypsophila", accent: "var(--color-clay-300)" },
    fern: { angle: 6, length: 56, leaves: 8, leafLength: 14, leafWidth: 4, kind: "fern", color: "var(--color-sage-600)" },
  };
  const preset = presets[kind];
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className={className}>
      <Branch x={30} y={60} {...preset} />
    </svg>
  );
}

/** Marie's portrait slot: deliberately a placeholder, never a stock person. */
export function PortraitPlaceholder({ className, caption = "Portrait de Marie — emplacement réservé, photo à venir" }: { className?: string; caption?: string }) {
  return (
    <figure className={className}>
      <svg viewBox="0 0 320 400" role="img" aria-label={caption} className="w-full">
        <rect x="0.5" y="0.5" width="319" height="399" rx="6" fill="var(--color-ivory-50)" stroke="var(--color-ivory-300)" />
        <rect x="16" y="16" width="288" height="368" fill="var(--color-ivory-200)" />
        <rect x="16" y="16" width="288" height="368" fill="none" stroke="var(--color-sage-200)" />
        <Branch x={110} y={330} angle={-10} length={190} leaves={8} leafLength={32} leafWidth={8} kind="sage" color="var(--color-sage-400)" />
        <Branch x={210} y={340} angle={14} length={170} leaves={7} leafLength={24} leafWidth={4.5} kind="olive" color="var(--color-sage-500)" accent="var(--color-sage-300)" />
        <PinStrip x={160} y={30} angle={0} width={40} />
      </svg>
      <figcaption className="mt-2 text-[13px] text-ink-500">{caption}</figcaption>
    </figure>
  );
}
