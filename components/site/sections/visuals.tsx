"use client";

// The split sections' pictures (`split.tsx`), drawn after mercury.com's (the founder's walkthrough of 23 Oct 2026):
// where Mercury shows soft rendered shapes beside "Get started fast" and "Stop losing money to fees" (a beam of light, a
// glowing search field, a wireframe globe), these are the same kind of picture, drawn in SVG and moved with SVG's own
// animation, in the ground's inks: they are decoration, never the product, so they show no figure and no name. Each
// fills its panel and crossfades with the open item. Reduced motion and Save-Data draw them still.

import { useEffect, useState, type ReactNode } from "react";
import { stillPreferred } from "@/components/site/motion";
import { cn } from "@/lib/utils";

export type VisualName = "beam" | "search" | "fan" | "globe" | "seal" | "stack";

const ink = { stopColor: "rgb(var(--ds-ink))" } as const;
const glow = { stopColor: "rgb(var(--ds-info))" } as const;

/** An SVG animation, left out when the picture is drawn still. */
function useAnim(still: boolean) {
  return (node: ReactNode) => (still ? null : node);
}

/** A point of light at the top, a thread down from it, and a fan of light spreading to the foot (Mercury's first picture). */
function Beam({ still }: { still: boolean }) {
  const a = useAnim(still);
  const rays = Array.from({ length: 23 }, (_, i) => -120 + i * 33);
  return (
    <div data-ground="night" className="absolute inset-0 bg-[rgb(var(--mk-ground-night))]">
      <svg viewBox="0 0 496 620" preserveAspectRatio="xMidYMid slice" className="size-full text-ink">
        <defs>
          <radialGradient id="v-beam-sky" cx="50%" cy="10%" r="80%">
            <stop offset="0" style={ink} stopOpacity="0.16" />
            <stop offset="1" style={ink} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="v-beam-ray" x1="0" y1="330" x2="0" y2="640" gradientUnits="userSpaceOnUse">
            <stop offset="0" style={ink} stopOpacity="0.55" />
            <stop offset="0.5" style={ink} stopOpacity="0.22" />
            <stop offset="1" style={ink} stopOpacity="0.5" />
          </linearGradient>
          <radialGradient id="v-beam-floor" cx="50%" cy="100%" r="60%">
            <stop offset="0" style={glow} stopOpacity="0.9" />
            <stop offset="0.45" style={ink} stopOpacity="0.32" />
            <stop offset="1" style={ink} stopOpacity="0" />
          </radialGradient>
          <filter id="v-beam-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="18" />
          </filter>
          <linearGradient id="v-beam-horizon" x1="0" y1="420" x2="0" y2="640" gradientUnits="userSpaceOnUse">
            <stop offset="0" style={ink} stopOpacity="0.62" />
            <stop offset="0.3" style={glow} stopOpacity="0.5" />
            <stop offset="1" style={ink} stopOpacity="0.14" />
          </linearGradient>
          <linearGradient id="v-beam-rim" x1="0" y1="420" x2="0" y2="500" gradientUnits="userSpaceOnUse">
            <stop offset="0" style={ink} stopOpacity="0.9" />
            <stop offset="1" style={ink} stopOpacity="0" />
          </linearGradient>
          <filter id="v-beam-rimblur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <linearGradient id="v-beam-flare" x1="0" y1="290" x2="0" y2="432" gradientUnits="userSpaceOnUse">
            <stop offset="0" style={ink} stopOpacity="0.15" />
            <stop offset="1" style={ink} stopOpacity="0.75" />
          </linearGradient>
          <filter id="v-beam-flareblur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
        {/* The card a shade lighter than the night, as mercury.com's slate. */}
        <rect width="496" height="620" fill="currentColor" opacity="0.13" />
        <rect width="496" height="620" fill="url(#v-beam-sky)" />
        {/* The lit horizon at the foot: a wide curve, brightest along its rim. */}
        <ellipse cx="248" cy="870" rx="600" ry="450" fill="url(#v-beam-horizon)" />
        <ellipse cx="248" cy="870" rx="600" ry="450" fill="none" stroke="url(#v-beam-rim)" strokeWidth="10" filter="url(#v-beam-rimblur)" />
        <ellipse cx="248" cy="660" rx="420" ry="230" fill="url(#v-beam-floor)" filter="url(#v-beam-soft)" />
        {rays.map((x) => (
          <path key={x} d={`M248 300 Q248 520 ${x} 640`} fill="none" stroke="url(#v-beam-ray)" strokeWidth="1" />
        ))}
        {/* The flare where the thread meets the horizon. */}
        <path d="M245 290 C245 370 216 410 140 432 L356 432 C280 410 251 370 251 290z" fill="url(#v-beam-flare)" filter="url(#v-beam-flareblur)" />
        <line x1="248" y1="104" x2="248" y2="300" stroke="currentColor" strokeOpacity="0.45" />
        {[16, 26, 36].map((r, i) => (
          <circle key={r} cx="248" cy="96" r={r} fill="none" stroke="currentColor" strokeOpacity={0.22 - i * 0.06}>
            {a(<animate attributeName="r" values={`${r};${r + 6};${r}`} dur="4s" begin={`${i * 0.4}s`} repeatCount="indefinite" />)}
          </circle>
        ))}
        <circle cx="248" cy="96" r="7" fill="currentColor" />
        <circle r="3" fill="currentColor">
          {a(<animateMotion dur="3.2s" repeatCount="indefinite" path="M248 110 L248 300" />)}
        </circle>
        {[0, 4, 9, 14, 19].map((k, i) => (
          <circle key={k} r="2.5" fill="currentColor" opacity={still ? 0 : 0.9}>
            {a(<animateMotion dur={`${3.6 + i * 0.5}s`} begin={`${i * 0.7}s`} repeatCount="indefinite" path={`M248 300 Q248 520 ${rays[k]} 640`} />)}
          </circle>
        ))}
      </svg>
    </div>
  );
}

/** A search field in a soft glow, the words typing into it (Mercury's search picture). */
function Search({ still }: { still: boolean }) {
  const a = useAnim(still);
  return (
    <svg viewBox="0 0 496 620" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full text-ink">
      <defs>
        <radialGradient id="v-search-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" style={glow} stopOpacity="0.5" />
          <stop offset="1" style={glow} stopOpacity="0" />
        </radialGradient>
        <filter id="v-search-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="28" />
        </filter>
        <filter id="v-search-lift" x="-20%" y="-60%" width="140%" height="220%">
          <feDropShadow dx="0" dy="10" stdDeviation="14" style={{ floodColor: "rgb(var(--ds-ink))", floodOpacity: 0.12 }} />
        </filter>
        <clipPath id="v-search-typed">
          <rect x="104" y="280" height="60" width={still ? 120 : 0}>
            {a(<animate attributeName="width" values="0;0;120;120;0" keyTimes="0;0.1;0.45;0.9;1" dur="5s" repeatCount="indefinite" />)}
          </rect>
        </clipPath>
      </defs>
      <ellipse cx="260" cy="300" rx="230" ry="150" fill="url(#v-search-glow)" filter="url(#v-search-blur)">
        {a(<animate attributeName="rx" values="210;250;210" dur="6s" repeatCount="indefinite" />)}
      </ellipse>
      <rect x="44" y="276" width="500" height="68" rx="34" className="fill-surface" filter="url(#v-search-lift)" />
      <circle cx="82" cy="308" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M88 314l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <text x="106" y="317" fontSize="22" fill="currentColor" clipPath="url(#v-search-typed)">
        knit GOTS
      </text>
      <rect x={still ? 226 : 106} y="296" width="2" height="26" fill="currentColor">
        {a(<animate attributeName="x" values="106;106;226;226;106" keyTimes="0;0.1;0.45;0.9;1" dur="5s" repeatCount="indefinite" />)}
        {a(<animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite" />)}
      </rect>
    </svg>
  );
}

/** One point sending to fifty: a request fanning out to every supplier on a list (the RFQ). */
function Fan({ still }: { still: boolean }) {
  const a = useAnim(still);
  const dots = Array.from({ length: 50 }, (_, i) => ({ x: 290 + (i % 5) * 38, y: 130 + Math.floor(i / 5) * 40 }));
  return (
    <svg viewBox="0 0 496 620" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full text-ink">
      <defs>
        <radialGradient id="v-fan-glow" cx="30%" cy="50%" r="55%">
          <stop offset="0" style={glow} stopOpacity="0.28" />
          <stop offset="1" style={glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="496" height="620" fill="url(#v-fan-glow)" />
      {dots.map((d, i) => (
        <path key={i} d={`M110 310 C200 310 210 ${d.y} ${d.x} ${d.y}`} fill="none" stroke="currentColor" strokeOpacity="0.09" />
      ))}
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r="4" fill="currentColor" opacity="0.28">
          {a(<animate attributeName="opacity" values="0.28;0.28;0.95;0.28" keyTimes="0;0.5;0.62;1" dur="4s" begin={`${(i % 10) * 0.12 + Math.floor(i / 10) * 0.05}s`} repeatCount="indefinite" />)}
        </circle>
      ))}
      {[3, 12, 21, 27, 38, 46].map((k, i) => (
        <circle key={k} r="3" fill="currentColor" opacity={still ? 0 : 1}>
          {a(<animateMotion dur="2.4s" begin={`${i * 0.4}s`} repeatCount="indefinite" path={`M110 310 C200 310 210 ${dots[k]!.y} ${dots[k]!.x} ${dots[k]!.y}`} />)}
        </circle>
      ))}
      <circle cx="110" cy="310" r="22" fill="none" stroke="currentColor" strokeOpacity="0.15" />
      <circle cx="110" cy="310" r="8" fill="currentColor" />
    </svg>
  );
}

/** Soft rings round a wireframe globe turning (Mercury's globe), for facts read from registers round the world. */
function Globe({ still }: { still: boolean }) {
  const a = useAnim(still);
  return (
    <svg viewBox="0 0 480 600" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full text-ink">
      <defs>
        <filter id="v-globe-soft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
        <clipPath id="v-globe-ball">
          <circle cx="240" cy="300" r="112" />
        </clipPath>
      </defs>
      {[150, 196, 242, 288].map((r, i) => (
        <circle key={r} cx="240" cy="300" r={r} fill="none" stroke="currentColor" strokeOpacity={0.07 - i * 0.012} strokeWidth="22" filter="url(#v-globe-soft)" />
      ))}
      <circle cx="240" cy="300" r="112" className="fill-surface" opacity="0.7" />
      <g clipPath="url(#v-globe-ball)" fill="none" stroke="currentColor" strokeOpacity="0.75" strokeWidth="1.2">
        {[0, 1, 2, 3].map((i) => (
          <ellipse key={i} cx="240" cy="300" rx={30 + i * 26} ry="112">
            {a(<animate attributeName="rx" values="112;0;112" dur="12s" begin={`${-i * 3}s`} repeatCount="indefinite" />)}
          </ellipse>
        ))}
        <ellipse cx="240" cy="300" rx="112" ry="24" strokeOpacity="0.35" />
      </g>
      <circle cx="240" cy="300" r="112" fill="none" stroke="currentColor" strokeWidth="1.4" />
      {[
        [196, 236],
        [292, 262],
        [216, 352],
        [300, 330],
        [168, 300],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.5" fill="currentColor">
          {a(<animate attributeName="opacity" values="1;0.3;1" dur="3s" begin={`${i * 0.6}s`} repeatCount="indefinite" />)}
        </circle>
      ))}
    </svg>
  );
}

/** A seal at the centre with rings going out from it: a fact stamped by its source, never a score. */
function Seal({ still }: { still: boolean }) {
  const a = useAnim(still);
  return (
    <svg viewBox="0 0 480 600" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full text-ink">
      <defs>
        <filter id="v-seal-lift" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="12" stdDeviation="16" style={{ floodColor: "rgb(var(--ds-ink))", floodOpacity: 0.14 }} />
        </filter>
      </defs>
      {[0, 1, 2].map((i) => (
        <circle key={i} cx="240" cy="300" r={still ? 120 + i * 60 : 70} fill="none" stroke="currentColor" strokeOpacity={still ? 0.08 : 0.2}>
          {a(<animate attributeName="r" values="70;290" dur="4.5s" begin={`${i * 1.5}s`} repeatCount="indefinite" />)}
          {a(<animate attributeName="stroke-opacity" values="0.22;0" dur="4.5s" begin={`${i * 1.5}s`} repeatCount="indefinite" />)}
        </circle>
      ))}
      <circle cx="240" cy="300" r="68" className="fill-surface" filter="url(#v-seal-lift)" />
      <circle cx="240" cy="300" r="56" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeDasharray="2 5" />
      <path d="M214 302l18 18 36-40" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Six even rows, none lifted above the others, a light passing down them: results in the order of the search. */
function Stack({ still }: { still: boolean }) {
  const a = useAnim(still);
  const rows = Array.from({ length: 6 }, (_, i) => 150 + i * 56);
  return (
    <svg viewBox="0 0 480 600" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full text-ink">
      <defs>
        <filter id="v-stack-lift" x="-20%" y="-60%" width="140%" height="220%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" style={{ floodColor: "rgb(var(--ds-ink))", floodOpacity: 0.08 }} />
        </filter>
        <linearGradient id="v-stack-light" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={glow} stopOpacity="0" />
          <stop offset="0.5" style={glow} stopOpacity="0.22" />
          <stop offset="1" style={glow} stopOpacity="0" />
        </linearGradient>
      </defs>
      {rows.map((y) => (
        <g key={y}>
          <rect x="80" y={y} width="320" height="44" rx="10" className="fill-surface" filter="url(#v-stack-lift)" />
          <circle cx="104" cy={y + 22} r="9" fill="currentColor" opacity="0.14" />
          <rect x="124" y={y + 14} width="120" height="7" rx="3.5" fill="currentColor" opacity="0.2" />
          <rect x="124" y={y + 26} width="76" height="6" rx="3" fill="currentColor" opacity="0.1" />
        </g>
      ))}
      <rect x="60" y={still ? 260 : 60} width="360" height="140" fill="url(#v-stack-light)">
        {a(<animate attributeName="y" values="40;520;40" dur="7s" repeatCount="indefinite" />)}
      </rect>
    </svg>
  );
}

const ART: Record<VisualName, (p: { still: boolean }) => ReactNode> = { beam: Beam, search: Search, fan: Fan, globe: Globe, seal: Seal, stack: Stack };

/** One picture, filling its panel; `active` shows it, the others fade out under it. */
export function Visual({ name, active }: { name: VisualName; active: boolean }) {
  const [still, setStill] = useState(false);
  useEffect(() => setStill(stillPreferred()), []);
  const Art = ART[name];
  return (
    <div aria-hidden className={cn("absolute inset-0 transition-opacity duration-reveal ease-out motion-reduce:transition-none", active ? "opacity-100" : "opacity-0")}>
      <Art still={still} />
    </div>
  );
}
