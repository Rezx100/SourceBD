"use client";

// Capability feature grid — /home-demo only.
// Reference choreography adapted to SourceBD's shared marketing surface,
// radius, colour, and typography hierarchy. Honours reduced-motion.

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useInView,
  useReducedMotion,
  type TargetAndTransition,
} from "motion/react";
import {
  Bell,
  Check,
  FileText,
  PaperPlaneTilt,
} from "@phosphor-icons/react";

import { BuyerWorkflowLiveStage } from "@/components/marketing/home/buyer-workflow-live-stage";
import { SectionHeader } from "@/components/marketing/home/section-header";
import { cn } from "@/lib/utils";

const FOREST = "var(--brand-forest)";
const MINT = "var(--brand-forest-mid)";
const CARD_BG = "#FFFFFF";
const CYCLE_MS = 12_267;

function FeatureCard({
  title,
  body,
  children,
  className,
  stageClassName,
}: {
  title: string;
  body: string;
  children: React.ReactNode;
  className?: string;
  stageClassName?: string;
}) {
  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-card border border-neutral-200/80 bg-white px-4 pb-6 pt-6 shadow-[0_1px_2px_rgba(15,15,20,0.035),0_18px_40px_-34px_rgba(15,15,20,0.22)] sm:px-7 sm:pb-7 sm:pt-8",
        className,
      )}
    >
      <div
        className={cn(
          "relative flex flex-1 items-center justify-center",
          stageClassName,
        )}
      >
        {children}
      </div>
      <div className="mt-6 flex shrink-0 flex-col gap-3">
        <h3 className="max-w-[20ch] font-display text-xl font-bold leading-tight tracking-tight text-neutral-900">
          {title}
        </h3>
        <p className="max-w-[38ch] text-sm leading-relaxed text-neutral-600">
          {body}
        </p>
      </div>
    </article>
  );
}

function WorkflowFeatureCard({ active }: { active: boolean }) {
  return (
    <article
      className="flex h-[392px] overflow-hidden rounded-card border border-neutral-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(15,15,20,0.035),0_18px_40px_-34px_rgba(15,15,20,0.22)] [overflow-anchor:none] min-[420px]:h-[420px] sm:h-[448px] sm:p-4 md:h-[468px] xl:h-[488px]"
      data-home-demo-workflow-stage
    >
      <div className="relative flex h-full w-full flex-1 items-stretch justify-center">
        <BuyerWorkflowLiveStage active={active} />
      </div>
    </article>
  );
}

/* ─── 1 · Checklist ────────────────────────────────────────────── */

const TASKS = [
  { id: "confirmed", label: "Order confirmed" },
  { id: "production", label: "Production underway" },
  { id: "inspection", label: "Quality inspection" },
  { id: "shipment", label: "Shipment dispatched" },
] as const;

function ChecklistStage({ phase, reduce }: { phase: number; reduce: boolean }) {
  const active = reduce ? 1 : (Math.floor(phase / 2) + 1) % TASKS.length;
  const offset = active * 56;
  const loopedTasks = [...TASKS, ...TASKS];

  return (
    <div className="relative h-[220px] w-full overflow-hidden pt-1">
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12"
        style={{
          background: `linear-gradient(180deg, transparent, ${CARD_BG} 80%)`,
        }}
        aria-hidden
      />
      <motion.ul
        className="flex flex-col gap-2.5"
        animate={reduce ? undefined : { y: -offset }}
        transition={{ type: "spring", stiffness: 160, damping: 24 }}
      >
        {loopedTasks.map((task, i) => {
          const taskIndex = i % TASKS.length;
          const done = taskIndex === active;
          const isFocus = taskIndex === active;
          return (
            <li
              key={`${task.id}-${i}`}
              className={cn(
                "flex h-[46px] items-center gap-3 rounded-sm border border-neutral-200/90 bg-white px-3.5 transition-[opacity,box-shadow,border-color]",
                isFocus
                  ? "relative z-[1] opacity-100 border-neutral-200 shadow-[0_1px_2px_rgba(15,15,20,0.04),0_6px_14px_-8px_rgba(15,15,20,0.12)]"
                  : "opacity-35 shadow-none",
              )}
            >
              <span
                className={cn(
                  "flex size-[22px] shrink-0 items-center justify-center rounded-full",
                  done ? "text-white" : "border border-neutral-300",
                )}
                style={done ? { background: MINT } : undefined}
                aria-hidden
              >
                {done ? <Check size={12} weight="bold" /> : null}
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-[13px] font-medium",
                  done ? "text-neutral-800 line-through" : "text-neutral-600",
                )}
              >
                {task.label}
              </span>
            </li>
          );
        })}
      </motion.ul>
    </div>
  );
}

/* ─── 2 · Document scan ────────────────────────────────────────── */

function DocumentScanStage({ reduce }: { reduce: boolean }) {
  return (
    <div className="relative flex h-[255px] w-full items-start justify-center">
      <div
        className="relative h-full w-[96%] max-w-[350px] overflow-hidden rounded-[4px] border border-neutral-200 bg-white shadow-[0_12px_30px_rgba(15,15,20,0.065)]"
        style={{
          WebkitMaskImage:
            "linear-gradient(to bottom, black 0%, black 80%, transparent 100%)",
          maskImage:
            "linear-gradient(to bottom, black 0%, black 80%, transparent 100%)",
        }}
      >
        <div className="space-y-3.5 px-7 pt-7">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="size-7 rounded-md bg-neutral-100" />
            <div className="h-2.5 flex-1 rounded-full bg-neutral-100" />
          </div>
          {[58, 42, 76, 91, 68, 49, 82].map((w, i) => (
            <div
              key={i}
              className="h-2.5 rounded-full bg-neutral-100"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>

        {/* One-direction scan: reset above the document, sweep through, repeat. */}
        <motion.div
          className="pointer-events-none absolute inset-x-0 z-10"
          initial={reduce ? false : { top: "7%", opacity: 0 }}
          animate={
            reduce
              ? { top: "48%", opacity: 1 }
              : {
                  top: ["7%", "7%", "84%", "84%"],
                  opacity: [0, 1, 1, 0],
                }
          }
          transition={
            reduce
              ? undefined
              : {
                  duration: 3.3,
                  repeat: Infinity,
                  times: [0, 0.06, 0.9, 1],
                  ease: "linear",
                }
          }
          aria-hidden
        >
          <div
            className="absolute inset-x-0 bottom-0 h-14"
            style={{
              background:
                "linear-gradient(180deg, transparent 0%, rgba(31,77,58,0.10) 72%, rgba(31,77,58,0.18) 100%)",
            }}
          />
          <div
            className="absolute inset-x-0 top-[3px] h-20"
            style={{
              background: `linear-gradient(180deg, ${CARD_BG}e6 0%, ${CARD_BG}8c 46%, transparent 100%)`,
            }}
          />
          <div
            className="absolute inset-x-0 top-0 h-[2px]"
            style={{
              background: "var(--brand-forest-mid)",
              boxShadow: "0 0 10px 1px rgba(45,106,79,0.28)",
            }}
          />
        </motion.div>

      </div>
    </div>
  );
}

/* ─── 3 · Timeline — animated three-sheet stack ────────────────── */

// Bell ring choreography (audited from reference video, ~3.2 s loop):
// rest → fill + scale-up pivoting from the top → decaying side-to-side rock
// with a radial particle burst → settle back to the outline weight.
const RING_DURATION = 3.2;

const RING_PARTICLES = [
  { angle: -150, dist: 16, size: 3, color: FOREST, delay: 0 },
  { angle: -105, dist: 20, size: 2.5, color: MINT, delay: 0.05 },
  { angle: -60, dist: 17, size: 3, color: FOREST, delay: 0.02 },
  { angle: -25, dist: 21, size: 2, color: MINT, delay: 0.08 },
  { angle: 15, dist: 18, size: 2.5, color: FOREST, delay: 0.04 },
  { angle: 60, dist: 20, size: 2, color: MINT, delay: 0.1 },
  { angle: 120, dist: 16, size: 2.5, color: MINT, delay: 0.06 },
  { angle: 170, dist: 19, size: 2, color: FOREST, delay: 0.03 },
] as const;

// Shared easing language for the whole loop — ballistic "tossed water" arc.
const EASE_SNAP = [0.16, 1, 0.3, 1] as const; // fast ejection, soft landing (particles)
const EASE_GLIDE = [0.65, 0, 0.35, 1] as const; // symmetric silky glide
const EASE_TOSS = [0.3, 0.9, 0.55, 1] as const; // decelerating rise, like gravity slowing a throw
const EASE_FALL = [0.5, 0, 0.75, 0.4] as const; // accelerating free-fall back down

function RingingBell({ reduce }: { reduce: boolean }) {
  if (reduce) {
    return (
      <span className="size-5 shrink-0 text-neutral-500" aria-hidden>
        <Bell size={18} weight="regular" />
      </span>
    );
  }

  // Ring window occupies the first ~45% of the loop; the rest is quiet.
  const t = (v: number) => v / RING_DURATION;

  return (
    <span className="relative size-5 shrink-0" aria-hidden>
      {/* Rocking / scaling bell — pivots from the top like a hung bell */}
      <motion.span
        className="absolute inset-0 flex items-center justify-center"
        style={{ transformOrigin: "50% 15%" }}
        animate={{
          // Pop past the resting ring size, relax slightly while rocking.
          scale: [1, 1.18, 1.13, 1.13, 1.13, 1.13, 1.13, 1, 1],
          // Decaying pendulum with a micro-overshoot before rest.
          rotate: [0, -16, 13, -9, 5.5, -2.5, 1, 0, 0],
        }}
        transition={{
          duration: RING_DURATION,
          repeat: Infinity,
          ease: EASE_GLIDE,
          times: [
            0,
            t(0.12),
            t(0.35),
            t(0.55),
            t(0.75),
            t(0.95),
            t(1.12),
            t(1.3),
            1,
          ],
        }}
      >
        {/* Outline ↔ fill cross-fade */}
        <motion.span
          className="absolute inset-0 flex items-center justify-center text-neutral-500"
          animate={{ opacity: [1, 0, 0, 1, 1] }}
          transition={{
            duration: RING_DURATION,
            repeat: Infinity,
            times: [0, t(0.12), t(1.1), t(1.3), 1],
          }}
        >
          <Bell size={18} weight="regular" />
        </motion.span>
        <motion.span
          className="absolute inset-0 flex items-center justify-center"
          style={{ color: FOREST }}
          animate={{ opacity: [0, 1, 1, 0, 0] }}
          transition={{
            duration: RING_DURATION,
            repeat: Infinity,
            times: [0, t(0.12), t(1.1), t(1.3), 1],
          }}
        >
          <Bell size={18} weight="fill" />
        </motion.span>
      </motion.span>

      {/* Radial particle burst during the ring */}
      {RING_PARTICLES.map((p, i) => {
        const rad = (p.angle * Math.PI) / 180;
        const dx = Math.cos(rad);
        const dy = Math.sin(rad);
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{
              width: p.size,
              height: p.size,
              background: p.color,
              marginLeft: -p.size / 2,
              marginTop: -p.size / 2,
            }}
            animate={{
              // Fast ejection, then a drifting fade — reads as physics,
              // not a linear slide.
              x: [dx * 8, dx * p.dist, dx * (p.dist + 6)],
              y: [dy * 8, dy * p.dist, dy * (p.dist + 6)],
              opacity: [0, 0.95, 0],
              scale: [0.3, 1, 0.25],
            }}
            transition={{
              duration: 1.0,
              delay: 0.25 + p.delay,
              repeat: Infinity,
              repeatDelay: RING_DURATION - 1.0,
              times: [0, 0.35, 1],
              ease: EASE_SNAP,
            }}
          />
        );
      })}
    </span>
  );
}

// Tops start at 12 so the backmost sheet has headroom to lift without
// escaping the stage and getting clipped against the card background.
const STACK_LAYERS = [
  { inset: "inset-x-6", top: 12, border: "border-neutral-200/60" },
  { inset: "inset-x-3", top: 24, border: "border-neutral-200/80" },
] as const;

function TimelineStage({ reduce }: { reduce: boolean }) {
  // Ring-synced stack thump (audited from reference video). All three cards
  // take part in one cascading hit: the back sheet leads on the bell's fill,
  // the middle sheet follows 60 ms later, the front card 120 ms after that.
  // Each snaps up with a small overshoot, holds while the bell rocks, then
  // settles in the same back→front order as the bell fades out.
  const t = (v: number) => v / RING_DURATION;
  const pulse = (
    lift: number,
    lead: number,
  ): TargetAndTransition | undefined =>
    reduce
      ? undefined
      : {
          // The quiet tail carries a slow breath (settle → gentle re-lift →
          // ease back to 0) so motion never freezes and the loop boundary is
          // velocity-continuous — the cycle reads as ongoing, not restarting.
          // Ballistic arc: decelerating rise (water leaving the mug), a
          // weightless drift at the apex, accelerating free-fall, then a
          // soft cushion at the catch — no hard stop at either end.
          y: [0, 0, -lift, -lift * 0.92, 1.5, 0, 0],
          transition: {
            duration: RING_DURATION,
            repeat: Infinity,
            times: [
              0,
              t(lead),
              t(lead + 0.55),
              t(1.0 + lead),
              t(1.45 + lead),
              t(1.85 + lead),
              1,
            ],
            ease: [
              "linear",
              EASE_TOSS,
              EASE_GLIDE,
              EASE_FALL,
              EASE_GLIDE,
              "linear",
            ],
          },
        };
  // Backmost lifts the most so the layer gaps visibly fan open (10/7/4 px).
  const layerLift = (i: number) => 10 - i * 3;
  const layerLead = (i: number) => i * 0.06;
  const frontLift = 4;
  const frontLead = 0.12;

  return (
    <div
      className="relative h-[255px] w-full max-w-[390px]"
      style={{
        WebkitMaskImage:
          "linear-gradient(to bottom, black 0%, black 78%, transparent 100%)",
        maskImage:
          "linear-gradient(to bottom, black 0%, black 78%, transparent 100%)",
      }}
    >
      {STACK_LAYERS.map((layer, i) => (
        <motion.div
          key={layer.top}
          className={cn(
            "absolute h-[220px] rounded-md border border-b-0 bg-white",
            layer.inset,
            layer.border,
          )}
          style={{
            top: layer.top,
            boxShadow: "0 0 0 1px rgba(15,15,20,0.04)",
          }}
          animate={pulse(layerLift(i), layerLead(i))}
          aria-hidden
        />
      ))}

      <motion.div
        className="absolute inset-x-0 h-[220px] overflow-hidden rounded-md border-x-0 border-b-0 border-t border-neutral-200 bg-white px-5 py-5"
        style={{ top: 36 }}
        animate={{
          ...(pulse(frontLift, frontLead) ? { y: pulse(frontLift, frontLead)!.y } : {}),
          // Shadow deepens as the stack lifts — a depth cue that sells the hit.
          boxShadow: reduce
            ? "0 10px 28px rgba(15,15,20,0.09)"
            : [
                "0 10px 28px rgba(15,15,20,0.09)",
                "0 10px 28px rgba(15,15,20,0.09)",
                "0 16px 36px rgba(15,15,20,0.13)",
                "0 16px 36px rgba(15,15,20,0.13)",
                "0 10px 28px rgba(15,15,20,0.09)",
                "0 10px 28px rgba(15,15,20,0.09)",
              ],
        }}
        transition={
          reduce
            ? undefined
            : {
                ...pulse(frontLift, frontLead)!.transition,
                boxShadow: {
                  duration: RING_DURATION,
                  repeat: Infinity,
                  times: [
                    0,
                    t(frontLead),
                    t(frontLead + 0.55),
                    t(1.0 + frontLead),
                    t(1.85 + frontLead),
                    1,
                  ],
                  ease: EASE_GLIDE,
                },
              }
        }
      >
          <div className="relative flex gap-3">
            <div className="relative flex w-6 shrink-0 flex-col items-center">
              <span
                className="z-10 flex size-6 items-center justify-center rounded-full text-white"
                style={{ background: MINT }}
                aria-hidden
              >
                <Check size={11} weight="bold" />
              </span>
              <span className="my-1 w-px flex-1 bg-neutral-200" aria-hidden />
              <span
                className="z-10 flex size-6 items-center justify-center rounded-full bg-neutral-100 text-neutral-500"
                aria-hidden
              >
                <FileText size={11} weight="bold" />
              </span>
            </div>

            <div className="min-w-0 flex-1 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[13px] font-medium text-neutral-500">
                    Expires in 30 days
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-neutral-800">
                    GOTS certification
                  </p>
                </div>
                <RingingBell reduce={reduce} />
              </div>

              <div>
                <p className="text-[13px] font-medium text-neutral-500">
                  Renewal follow-up
                </p>
                <p className="mt-0.5 text-sm font-medium text-neutral-800">
                  Review supplier evidence
                </p>
                <span
                  className="mt-1 inline-block text-sm font-semibold"
                  style={{ color: MINT }}
                >
                  Open Compliance Hub
                </span>
              </div>
            </div>
          </div>
      </motion.div>

      {/* Side hairlines only — extend below the card body into the fade */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 h-[260px]"
        style={{ top: 36 }}
        animate={pulse(frontLift, frontLead)}
        aria-hidden
      >
        <span className="absolute inset-y-0 left-0 w-px bg-neutral-200" />
        <span className="absolute inset-y-0 right-0 w-px bg-neutral-200" />
      </motion.div>
    </div>
  );
}

/* ─── 4 · Secure collect ───────────────────────────────────────── */

const CONTACTS = [
  {
    label: "Factory",
    src: "/marketing/capability-factory.png",
    x: 28,
    y: 18,
  },
  {
    label: "Merchandiser",
    src: "/marketing/capability-merch.png",
    x: 72,
    y: 31,
  },
  {
    label: "Compliance",
    src: "/marketing/capability-compliance.png",
    x: 25,
    y: 47,
  },
] as const;

function CollectStage({ reduce }: { reduce: boolean }) {
  return (
    <div className="relative h-[240px] w-full sm:-mx-7 sm:h-[260px] sm:w-[calc(100%+56px)]">
      <div className="absolute inset-0 translate-y-2 sm:translate-y-3">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            WebkitMaskImage:
              "linear-gradient(to bottom, black 0%, black 66%, transparent 96%)",
            maskImage:
              "linear-gradient(to bottom, black 0%, black 66%, transparent 96%)",
          }}
          aria-hidden
        >
        <div className="absolute left-1/2 top-[63%] aspect-square w-[84%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-forest/10 sm:w-[92%]" />
        <div className="absolute left-1/2 top-[63%] aspect-square w-[38%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-neutral-200/70 sm:w-[42%]" />
        <div className="absolute left-1/2 top-[63%] aspect-square w-[58%] -translate-x-1/2 -translate-y-1/2 sm:w-[66%]">
          <svg
            viewBox="0 0 100 100"
            className="size-full -rotate-90 overflow-visible"
            aria-hidden
          >
            <circle
              cx="50"
              cy="50"
              r="49"
              fill="none"
              stroke="rgba(31,77,58,0.16)"
              strokeWidth="0.7"
            />
            <motion.circle
              cx="50"
              cy="50"
              r="49"
              pathLength="1"
              fill="none"
              stroke="var(--brand-forest)"
              strokeWidth="0.75"
              strokeLinecap="round"
              strokeDasharray="0.34 0.66"
              animate={reduce ? { strokeDashoffset: 0 } : { strokeDashoffset: [0, -1] }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "linear",
              }}
            />
            <motion.circle
              cx="50"
              cy="50"
              r="49"
              pathLength="1"
              fill="none"
              stroke="var(--brand-forest-mid)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="0.025 0.975"
              animate={reduce ? { strokeDashoffset: 0 } : { strokeDashoffset: [0, -1] }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "linear",
              }}
            />
          </svg>
        </div>
        </div>

        <div className="absolute left-1/2 top-[63%] z-10 -translate-x-1/2 -translate-y-1/2">
          <div
            className="flex size-14 items-center justify-center rounded-full bg-brand-forest text-white shadow-[0_8px_20px_rgba(31,77,58,0.18)] sm:size-[68px]"
            aria-hidden
          >
            <PaperPlaneTilt size={22} weight="fill" className="sm:hidden" />
            <PaperPlaneTilt size={24} weight="fill" className="hidden sm:block" />
          </div>
        </div>

        {CONTACTS.map((c) => {
          return (
            <div
              key={c.label}
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${c.x}%`,
                top: `${c.y}%`,
              }}
            >
              <div className="flex items-center gap-1.5 rounded-full bg-white py-1 pl-1 pr-2.5 shadow-[0_6px_18px_rgba(15,15,20,0.10)] sm:pr-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.src}
                  alt=""
                  width={28}
                  height={28}
                  className="size-6 rounded-full object-cover sm:size-7"
                />
                <span className="text-[12px] font-medium text-neutral-700 sm:text-[12.5px]">
                  {c.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Section ──────────────────────────────────────────────────── */

export function CapabilityFeatureGrid() {
  const reduce = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLElement>(null);
  const inView = useInView(rootRef, { once: false, amount: 0.3 });
  const [phase, setPhase] = useState(reduce ? 4 : 0);

  useEffect(() => {
    if (reduce) {
      setPhase(4);
      return;
    }
    if (!inView) return;
    const started = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = ((now - started) % CYCLE_MS) / CYCLE_MS;
      setPhase(Math.floor(t * 12));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce]);

  return (
    <section
      ref={rootRef}
      className="border-b border-neutral-200 bg-white py-16 md:py-20 [overflow-anchor:none]"
      aria-label="SourceBD capabilities"
    >
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
        <SectionHeader
          kicker="Buyer workflow"
          title="Keep sourcing work moving."
          description="Send RFQs, message suppliers, track orders, and manage compliance after the shortlist is set."
        />

        <div className="mt-12 grid gap-4 sm:mt-[4.5rem] md:mt-20 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
          <div className="md:col-span-2 xl:col-span-2">
            <WorkflowFeatureCard active={inView} />
          </div>
          <FeatureCard
            title="Track every order milestone"
            body="Follow confirmed orders through production, inspection, and shipment."
            className="md:min-h-[408px] xl:min-h-[424px]"
            stageClassName="min-h-[200px] sm:min-h-[220px] 2xl:items-start"
          >
            <ChecklistStage phase={phase} reduce={reduce} />
          </FeatureCard>
          <FeatureCard
            title="Prepare an MSA statement"
            body="Generate a working Modern Slavery Act statement from your compliance data."
            className="md:min-h-[430px]"
            stageClassName="min-h-[220px] items-start sm:min-h-[250px]"
          >
            <DocumentScanStage reduce={reduce} />
          </FeatureCard>
          <FeatureCard
            title="Act before certifications expire"
            body="See upcoming expiries for followed suppliers and prioritise renewals."
            className="md:min-h-[430px]"
            stageClassName="min-h-[220px] items-start sm:min-h-[250px]"
          >
            <TimelineStage reduce={reduce} />
          </FeatureCard>
          <FeatureCard
            title="Keep supplier conversations together"
            body="Message supplier teams without losing the sourcing context around each thread."
            className="md:min-h-[430px]"
            stageClassName="min-h-[220px] sm:min-h-[250px] 2xl:items-start"
          >
            <CollectStage reduce={reduce} />
          </FeatureCard>
        </div>
      </div>
    </section>
  );
}
