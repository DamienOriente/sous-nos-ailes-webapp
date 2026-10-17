import { Branch, PinStrip } from "@/components/illustrations/botanical";

export type VenueIllustrationKey = "domaine" | "chateau" | "salle" | "jardin" | "orangerie";

// Venue pages carry a "relevé": a hairline elevation sketch pinned on an ivory
// sheet, in the same idiom as the herbarium plate (no filled pictograms).

const INK = "var(--color-sage-700)";
const SOFT = "var(--color-sage-400)";
const line = { fill: "none", stroke: INK, strokeWidth: 1.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const soft = { ...line, stroke: SOFT, strokeWidth: 0.9 };

/** Short parallel strokes along a slope: roof tiles or lawn. */
function Hatch({ x1, y1, x2, y2, count, length = 8, dx = 0, dy = -8 }: { x1: number; y1: number; x2: number; y2: number; count: number; length?: number; dx?: number; dy?: number }) {
  const items = [];
  for (let i = 1; i < count; i += 1) {
    const t = i / count;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    const n = Math.hypot(dx, dy) || 1;
    items.push(<line key={i} x1={x} y1={y} x2={x + (dx / n) * length} y2={y + (dy / n) * length} {...soft} />);
  }
  return <>{items}</>;
}

function ArchedWindow({ x, y, w, h, panes = true }: { x: number; y: number; w: number; h: number; panes?: boolean }) {
  const r = w / 2;
  return (
    <g>
      <path d={`M${x} ${y + h} V${y + r} a${r} ${r} 0 0 1 ${w} 0 V${y + h} Z`} {...line} />
      {panes ? (
        <>
          <line x1={x + r} y1={y + r} x2={x + r} y2={y + h} {...soft} />
          <line x1={x} y1={y + h * 0.55} x2={x + w} y2={y + h * 0.55} {...soft} />
        </>
      ) : null}
    </g>
  );
}

function Window({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} {...line} />
      <line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} {...soft} />
      <line x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} {...soft} />
    </g>
  );
}

function Tree({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y - r * 1.1} {...line} />
      <circle cx={x} cy={y - r * 1.5} r={r} {...line} />
      <circle cx={x - r * 0.55} cy={y - r * 1.25} r={r * 0.7} {...soft} />
      <circle cx={x + r * 0.5} cy={y - r * 1.35} r={r * 0.65} {...soft} />
    </g>
  );
}

function Sheet({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <>
      <rect x="0.5" y="0.5" width="479" height="299" rx="6" fill="var(--color-ivory-50)" stroke="var(--color-ivory-300)" />
      <rect x="14" y="14" width="452" height="272" rx="2" fill="none" stroke="var(--color-sage-200)" strokeWidth="0.8" />
      <PinStrip x={240} y={16} angle={-3} width={34} />
      <line x1="40" y1="236" x2="440" y2="236" {...line} />
      <Hatch x1={40} y1={244} x2={440} y2={244} count={40} length={5} dx={1} dy={-2} />
      {children}
      <text x="452" y="272" textAnchor="end" fontFamily="var(--font-sans)" fontSize="11" fill="var(--color-ink-500)">
        {label}
      </text>
      <line x1="320" y1="258" x2="452" y2="258" stroke="var(--color-clay-400)" strokeWidth="1" />
    </>
  );
}

function Domaine() {
  return (
    <Sheet label="Relevé — domaine, façade sud">
      <rect x="110" y="140" width="240" height="96" {...line} />
      <path d="M100 140 L230 94 L360 140" {...line} />
      <Hatch x1={104} y1={138} x2={226} y2={96} count={9} dx={1} dy={0.35} length={10} />
      <Hatch x1={234} y1={96} x2={356} y2={138} count={9} dx={-1} dy={0.35} length={10} />
      <line x1="230" y1="94" x2="230" y2="80" {...line} />
      <rect x="222" y="70" width="16" height="12" {...line} />
      {[136, 176, 264, 304].map((x) => (
        <ArchedWindow key={x} x={x} y={166} w={22} h={44} />
      ))}
      <path d="M216 236 V190 a14 14 0 0 1 28 0 V236" {...line} />
      <line x1="206" y1="236" x2="254" y2="236" {...soft} />
      <rect x="350" y="172" width="70" height="64" {...line} />
      <path d="M342 172 L385 150 L428 172" {...line} />
      <Window x={372} y={190} w={26} h={30} />
      <Tree x={62} y={236} r={24} />
      <Branch x={440} y={234} angle={-20} length={46} leaves={4} leafLength={12} leafWidth={3} kind="sage" color={SOFT} />
    </Sheet>
  );
}

function Chateau() {
  return (
    <Sheet label="Relevé — château, cour d’honneur">
      <rect x="150" y="130" width="180" height="106" {...line} />
      <path d="M142 130 L240 88 L338 130" {...line} />
      <Hatch x1={146} y1={128} x2={236} y2={90} count={8} dx={1} dy={0.4} length={10} />
      <Hatch x1={244} y1={90} x2={334} y2={128} count={8} dx={-1} dy={0.4} length={10} />
      <rect x="112" y="110" width="38" height="126" {...line} />
      <rect x="330" y="110" width="38" height="126" {...line} />
      <path d="M104 110 L131 66 L158 110" {...line} />
      <path d="M322 110 L349 66 L376 110" {...line} />
      <Window x={123} y={150} w={16} h={22} />
      <Window x={341} y={150} w={16} h={22} />
      {[166, 206, 254, 294].map((x) => (
        <Window key={x} x={x} y={146} w={20} h={26} />
      ))}
      {[166, 206, 254, 294].map((x) => (
        <Window key={`b${x}`} x={x} y={190} w={20} h={26} />
      ))}
      <path d="M226 236 V196 a14 14 0 0 1 28 0 V236" {...line} />
      <line x1="60" y1="226" x2="112" y2="226" {...soft} />
      <line x1="368" y1="226" x2="420" y2="226" {...soft} />
      {[66, 76, 86, 96, 106, 374, 384, 394, 404, 414].map((x) => (
        <line key={x} x1={x} y1={226} x2={x} y2={236} {...soft} />
      ))}
      <Tree x={44} y={236} r={14} />
      <Tree x={436} y={236} r={14} />
    </Sheet>
  );
}

function Salle() {
  return (
    <Sheet label="Relevé — salle de réception, pignon">
      <rect x="120" y="130" width="240" height="106" {...line} />
      <path d="M108 130 L240 78 L372 130" {...line} />
      <Hatch x1={112} y1={128} x2={236} y2={80} count={10} dx={1} dy={0.4} length={10} />
      <Hatch x1={244} y1={80} x2={368} y2={128} count={10} dx={-1} dy={0.4} length={10} />
      <rect x="210" y="170" width="60" height="66" {...line} />
      <line x1="240" y1="170" x2="240" y2="236" {...soft} />
      {[140, 170, 290, 320].map((x) => (
        <Window key={x} x={x} y={160} w={22} h={30} />
      ))}
      <path d="M50 110 Q240 160 430 110" {...soft} />
      {[80, 115, 150, 185, 220, 255, 290, 325, 360, 395].map((x, i) => {
        const y = 110 + 50 * (1 - Math.pow((x - 240) / 190, 2)) * 0.5;
        return <path key={x} d={`M${x - 5} ${y} L${x} ${y + 10} L${x + 5} ${y} Z`} {...(i % 2 ? soft : line)} />;
      })}
      <Tree x={70} y={236} r={18} />
    </Sheet>
  );
}

function Orangerie() {
  return (
    <Sheet label="Relevé — orangerie, façade vitrée">
      <rect x="100" y="130" width="280" height="106" {...line} />
      <path d="M92 130 L240 92 L388 130" {...line} />
      <line x1="100" y1="130" x2="380" y2="130" {...soft} />
      {[116, 168, 220, 272, 324].map((x) => (
        <ArchedWindow key={x} x={x} y={144} w={36} h={92} />
      ))}
      <path d="M58 236 L62 210 H82 L86 236 Z" {...line} />
      <circle cx="72" cy="188" r="18" {...line} />
      <circle cx="66" cy="182" r="2" fill="var(--color-clay-400)" stroke="none" />
      <circle cx="79" cy="193" r="2" fill="var(--color-clay-400)" stroke="none" />
      <path d="M394 236 L398 210 H418 L422 236 Z" {...line} />
      <circle cx="408" cy="188" r="18" {...line} />
      <circle cx="402" cy="194" r="2" fill="var(--color-clay-400)" stroke="none" />
      <circle cx="414" cy="182" r="2" fill="var(--color-clay-400)" stroke="none" />
    </Sheet>
  );
}

function Jardin() {
  return (
    <Sheet label="Relevé — jardin, pergola et pelouse">
      {[150, 230, 310].map((x) => (
        <line key={x} x1={x} y1={236} x2={x} y2={150} {...line} />
      ))}
      <line x1="130" y1="150" x2="330" y2="150" {...line} />
      <line x1="130" y1="146" x2="330" y2="146" {...soft} />
      {[146, 170, 194, 218, 242, 266, 290, 314].map((x) => (
        <line key={x} x1={x} y1={140} x2={x} y2={156} {...soft} />
      ))}
      <path d="M40 236 q10 -14 20 0 q10 -14 20 0 q10 -14 20 0 q10 -14 20 0 q10 -14 20 0" {...soft} />
      <path d="M340 236 q10 -14 20 0 q10 -14 20 0 q10 -14 20 0 q10 -14 20 0 q10 -14 20 0" {...soft} />
      <Tree x={400} y={236} r={30} />
      <Branch x={120} y={236} angle={-12} length={60} leaves={5} leafLength={14} leafWidth={3.5} kind="sage" color={SOFT} />
      <path d="M150 150 Q230 190 310 150" {...soft} />
      {[180, 230, 280].map((x) => (
        <circle key={x} cx={x} cy={x === 230 ? 176 : 166} r="4" {...line} />
      ))}
    </Sheet>
  );
}

/** Sober architectural "relevé" for venue pages, in the plate idiom. */
export function VenueIllustration({ kind, className }: { kind: VenueIllustrationKey | string; className?: string }) {
  const Drawing = kind === "chateau" ? Chateau : kind === "salle" ? Salle : kind === "orangerie" ? Orangerie : kind === "jardin" ? Jardin : Domaine;
  return (
    <svg viewBox="0 0 480 300" role="img" aria-label="Relevé schématique du lieu et de ses espaces" className={className}>
      <Drawing />
    </svg>
  );
}
