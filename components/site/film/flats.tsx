// The tech-pack flats (handoff-home-film §3.7): line drawings in the film's own ink, fills from the surface roles,
// green only for thread. The overlock is the plan's drawing with its two hand-typed colours turned into tokens and
// the five source tags hung on its threads. Six parts move with the scroll on the full tier (engine/chapters.ts
// writes `--wheel` and `--needle` on the scene and `--p` on the seam); with nothing written every part rests, which
// is what the lite and still tiers and a still page show. Each drawing is decoration: its caption says what it is.

import { SEAM_END } from "@/components/site/film/engine/chapters";
import { Thread } from "@/components/site/film/thread";
import { cn } from "@/lib/utils";

/** The cones' centres, left to right, and the source whose tag hangs on each thread with the number it files the factory under. */
const CONES = [70, 150, 230, 310, 390] as const;
export const TAGS: readonly [source: string, number: string][] = [["BGMEA", "4002"], ["EPB", "2798"], ["BKMEA", "1004-B"], ["GOTS", "19020"], ["RSC", "10861"]];
const DISCS = [196, 242, 288, 334, 380] as const;

/** A five-thread overlock, side on: thread stand, five cones with their tags, the head, the handwheel, the cloth and its seam. */
export function Overlock({ className }: { className?: string }) {
  return (
    <svg data-overlock aria-hidden viewBox="0 -70 460 490" className={cn("block overflow-visible", className)}>
      {/* The thread stand: the centre post, the rail with its guides, the cone shelf and the cone posts. */}
      <g className="fill-none stroke-ink" strokeWidth={1.6} strokeLinecap="round">
        <path d="M230 170V-30M46 -30H438M40 120H420" />
        <path d={CONES.map((x) => `M${x} 62V50`).join("")} />
      </g>
      {/* Five cones of thread, each with its stripes of light. */}
      <g className="fill-brand stroke-ink" strokeWidth={1.4} strokeLinejoin="round">
        {CONES.map((x) => (
          <path key={x} d={`M${x - 17} 120 ${x - 8} 62H${x + 8}L${x + 17} 120Z`} />
        ))}
      </g>
      <path d={CONES.map((x) => `M${x - 10} 76H${x + 10}M${x - 12} 90H${x + 12}M${x - 14} 104H${x + 14}`).join("")} className="fill-none stroke-surface" strokeOpacity={0.3} strokeWidth={1} />
      {/* The head, the bed, the needle head, the handwheel with its crank, and the feet. */}
      <g className="stroke-ink" strokeWidth={1.6} strokeLinejoin="round">
        <rect x={150} y={160} width={246} height={150} rx={14} className="fill-surface" />
        <rect x={96} y={300} width={300} height={100} rx={10} className="fill-subtle" />
        <rect x={84} y={176} width={84} height={98} rx={10} className="fill-surface" />
        <rect x={396} y={236} width={24} height={92} rx={9} className="fill-ink" />
        <rect x={420} y={268} width={7} height={28} rx={2} className="fill-ink" />
        <rect x={118} y={400} width={36} height={8} rx={2} className="fill-ink" />
        <rect x={338} y={400} width={36} height={8} rx={2} className="fill-ink" />
      </g>
      <g className="fill-none stroke-line-strong" strokeWidth={1}>
        <rect x={94} y={188} width={50} height={72} rx={6} className="fill-subtle" />
        <rect x={236} y={332} width={86} height={24} rx={4} className="fill-surface" />
        <rect x={110} y={314} width={70} height={34} rx={6} className="fill-surface" />
        <path d="M340 252h38M340 260h38M340 268h38" />
      </g>
      {/* The handwheel's rim: two lights and the groove that turns with the scroll. */}
      <path d="M402 246v72M414 246v72" className="fill-none stroke-surface" strokeOpacity={0.28} strokeWidth={1} />
      <path d="M408 246v72" className="ov-wheel fill-none stroke-surface" strokeOpacity={0.5} strokeWidth={2} strokeDasharray="3 5" />
      {/* The five threads: cone to guide, guide down to the tension discs, discs to the take-up, take-up to the needle. */}
      <g className="fill-none stroke-brand-ink" strokeWidth={1.3} strokeLinecap="round">
        <path d={CONES.map((x) => `M${x} 50 ${x + 8} -30`).join("")} />
        <path d="M78 -30C78 150 196 110 196 201M158 -30C158 150 242 110 242 201M238 -30C238 150 288 110 288 201M318 -30C318 150 334 110 334 201M398 -30C398 150 380 110 380 201" />
        <path d="M183 214C165 214 150 204 127 206M229 214C200 228 160 212 127 206M275 214C230 236 165 216 127 206M321 214C250 244 170 220 127 206M367 214C270 252 175 224 127 206" />
        <path d="M127 206C118 232 113 262 113 314" />
      </g>
      {/* The tension discs, the guides on the rail, and the dial on the bed. */}
      <g className="fill-surface stroke-ink" strokeWidth={1.5}>
        {DISCS.map((x) => (
          <circle key={x} cx={x} cy={214} r={13} />
        ))}
        {CONES.map((x) => (
          <circle key={x} cx={x + 8} cy={-30} r={3.4} />
        ))}
        <circle cx={362} cy={344} r={8} />
      </g>
      <g className="fill-ink">
        {DISCS.map((x) => (
          <circle key={x} cx={x} cy={214} r={5} />
        ))}
        <circle cx={127} cy={206} r={3} />
        <circle cx={362} cy={344} r={2.6} />
      </g>
      {/* The take-up lever rocks with the needle. */}
      <path d="M132 198q-12 16 0 34" className="ov-lever fill-none stroke-ink" strokeWidth={1.2} />
      {/* The needle bar drops one stitch per step. */}
      <g className="ov-needle stroke-ink" strokeLinejoin="round">
        <rect x={110} y={274} width={6} height={36} className="fill-line" strokeWidth={0.9} />
        <rect x={128} y={274} width={5} height={64} className="fill-line" strokeWidth={0.9} />
        <rect x={105} y={306} width={16} height={8} rx={1.5} className="fill-ink" strokeWidth={0.9} />
        <path d="M110 314V352M116 314V352" className="fill-none" strokeWidth={1.1} />
      </g>
      {/* The presser foot. */}
      <path d="M98 346h46l6 10H92z" className="fill-sunken stroke-ink" strokeWidth={1.2} strokeLinejoin="round" />
      {/* The cloth comes in from the left, passes under the foot and leaves at the right as one seam. */}
      <path d={`M18 356H${SEAM_END.x}V367H18Z`} className="fill-sunken" />
      <path d={`M${SEAM_END.x} 356H18V367H${SEAM_END.x}`} className="fill-none stroke-ink" strokeWidth={1.6} strokeLinejoin="round" />
      <g data-seam>
        <Thread d={`M113 ${SEAM_END.y}H${SEAM_END.x}`} join />
      </g>
      {/* The five hang tags, one on each thread: the source and the number it files the factory under. */}
      <g>
        {TAGS.map(([source, number], i) => {
          const x = CONES[i]! + 8;
          return (
            <g key={source}>
              <path d={`M${x} -30V-18`} className="fill-none stroke-ink" strokeWidth={1} />
              <rect x={x - 32} y={-18} width={64} height={28} rx={3} className="fill-surface stroke-ink" strokeWidth={1} />
              <circle cx={x} cy={-15} r={1.4} className="fill-none stroke-ink" strokeWidth={0.8} />
              <text x={x} y={-2} textAnchor="middle" fontSize={11} fontWeight={600} className="fill-ink font-sans">
                {source}
              </text>
              <text x={x} y={7.5} textAnchor="middle" fontSize={8.5} className="fill-ink-3 font-mono">
                {number}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
