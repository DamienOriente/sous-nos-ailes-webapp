import { cn } from "@/lib/utils";

/**
 * Original inline SVG illustrations. Colours come from the design tokens so
 * they re-balance automatically in dark mode. Decorative only (aria-hidden).
 */

/** Hero: two open wings sheltering a small round "nest" — the brand gesture. */
export function WingsIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 640 520" className={cn("h-auto w-full", className)} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="sna-nest" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="var(--sna-blush)" />
          <stop offset="100%" stopColor="var(--sna-ivory-deep)" />
        </radialGradient>
      </defs>
      {/* soft ground + halo behind the two figures */}
      <ellipse cx="320" cy="455" rx="230" ry="20" fill="var(--sna-sage-soft)" />
      <circle cx="330" cy="400" r="115" fill="url(#sna-nest)" opacity="0.45" />
      {/* left wing: an arch sheltering what is below, scalloped feather edge */}
      <path d="M 320 130 C 230 95, 110 140, 50 255 Q 95 300, 150 280 Q 200 320, 240 285 Q 290 320, 320 290 Z" fill="var(--sna-sage)" />
      <path d="M 320 160 C 250 140, 160 170, 110 250 Q 150 285, 190 268 Q 235 300, 265 272 Q 300 300, 320 275 Z" fill="var(--sna-sage-deep)" opacity="0.85" />
      <path d="M 320 195 C 275 185, 215 205, 180 250 Q 215 272, 245 258 Q 285 282, 320 262 Z" fill="var(--sna-ivory)" opacity="0.9" />
      {/* right wing, mirrored */}
      <g transform="translate(640 0) scale(-1 1)">
        <path d="M 320 130 C 230 95, 110 140, 50 255 Q 95 300, 150 280 Q 200 320, 240 285 Q 290 320, 320 290 Z" fill="var(--sna-sage)" />
        <path d="M 320 160 C 250 140, 160 170, 110 250 Q 150 285, 190 268 Q 235 300, 265 272 Q 300 300, 320 275 Z" fill="var(--sna-sage-deep)" opacity="0.85" />
        <path d="M 320 195 C 275 185, 215 205, 180 250 Q 215 272, 245 258 Q 285 282, 320 262 Z" fill="var(--sna-ivory)" opacity="0.9" />
      </g>
      {/* feather lines */}
      <g fill="none" stroke="var(--sna-ivory)" strokeWidth="1.5" strokeLinecap="round" opacity="0.6">
        <path d="M 300 150 C 240 150, 160 185, 110 240" /><path d="M 300 175 C 250 180, 200 205, 170 245" /><path d="M 340 150 C 400 150, 480 185, 530 240" /><path d="M 340 175 C 390 180, 440 205, 470 245" />
      </g>
      {/* gold seam where the wings meet */}
      <path d="M 320 130 L 320 290" stroke="var(--sna-gold)" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
      {/* two abstract figures, an adult and a child, side by side under the wings */}
      <circle cx="298" cy="372" r="17" fill="var(--sna-charcoal)" />
      <path d="M 268 448 C 268 404, 328 404, 328 448 Z" fill="var(--sna-charcoal)" />
      <circle cx="346" cy="394" r="12" fill="var(--sna-blush-deep)" />
      <path d="M 324 448 C 324 416, 368 416, 368 448 Z" fill="var(--sna-blush-deep)" />
      {/* a few floating down feathers */}
      <path d="M520 110 c 10 -18, 30 -22, 44 -10 c -4 16, -22 30, -44 10 z" fill="var(--sna-sky)" />
      <path d="M90 360 c 8 -14, 24 -18, 36 -8 c -3 13, -18 24, -36 8 z" fill="var(--sna-blush)" />
      <path d="M560 290 c 6 -10, 18 -13, 27 -6 c -2 10, -13 18, -27 6 z" fill="var(--sna-gold)" opacity="0.8" />
    </svg>
  );
}

/** Small feather used as a section marker. */
export function Feather({ className, tone = "sage" }: { className?: string; tone?: "sage" | "blush" | "sky" | "gold" }) {
  const fill = { sage: "var(--sna-sage)", blush: "var(--sna-blush-deep)", sky: "var(--sna-sky-deep)", gold: "var(--sna-gold)" }[tone];
  return (
    <svg viewBox="0 0 40 40" className={cn("size-6", className)} aria-hidden="true" focusable="false">
      <path d="M6 34 C 8 18, 20 6, 34 6 C 34 20, 22 32, 6 34 Z" fill={fill} opacity="0.9" />
      <path d="M8 32 L 30 10" stroke="var(--sna-ivory)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Soft arc motif for section backgrounds (very light). */
export function ArcMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1200 200" preserveAspectRatio="none" className={cn("pointer-events-none absolute inset-x-0 top-0 h-32 w-full", className)} aria-hidden="true" focusable="false">
      <path d="M0 160 C 300 40, 900 40, 1200 160 L 1200 0 L 0 0 Z" fill="var(--sna-ivory-deep)" />
    </svg>
  );
}

/** Tiny pictograms for the "how it works" steps. */
export function StepGlyph({ step, className }: { step: 1 | 2 | 3; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-14", className)} aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="30" fill="var(--sna-sage-soft)" />
      {step === 1 && (
        <>
          <circle cx="28" cy="28" r="11" fill="none" stroke="var(--sna-sage-deep)" strokeWidth="3" />
          <path d="M36 36 L 46 46" stroke="var(--sna-sage-deep)" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {step === 2 && (
        <>
          <path d="M18 34 c 0 -8, 28 -8, 28 0" fill="none" stroke="var(--sna-sage-deep)" strokeWidth="3" strokeLinecap="round" />
          <circle cx="24" cy="24" r="5" fill="var(--sna-sage-deep)" />
          <circle cx="40" cy="24" r="5" fill="var(--sna-blush-deep)" />
          <path d="M20 44 h 24" stroke="var(--sna-gold)" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {step === 3 && (
        <>
          <rect x="18" y="18" width="28" height="28" rx="6" fill="none" stroke="var(--sna-sage-deep)" strokeWidth="3" />
          <path d="M24 32 l 6 6 l 10 -12" fill="none" stroke="var(--sna-sage-deep)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}
