"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  motion,
  useInView,
  useReducedMotion,
} from "motion/react";
import { SectionHeader } from "@/components/marketing/home/section-header";
import { cn } from "@/lib/utils";

export type EvidenceCaseId =
  | "registries"
  | "certifications"
  | "sanctions"
  | "contact"
  | "addresses"
  | "provenance";

export type EvidenceCaseMeta = {
  id: EvidenceCaseId;
  title: string;
  description: string;
  index: string;
};

const AUTO_MS = 4200;

/* Progressive padding: keep stage content ≥ ~480px usable width at 1024–1280. */
const STAGE_PAD =
  "p-5 min-[420px]:p-6 sm:p-7 lg:p-8 xl:p-9 2xl:p-[3.25rem]";

const EASE_SOFT = [0.22, 1, 0.36, 1] as const;

/** Quiet stone wash — near-neutral, barely warm; no mint fill. */
const STAGE_WASH = `
  linear-gradient(
    160deg,
    #f6f6f5 0%,
    #f3f3f2 42%,
    #f8f8f7 100%
  )
`;

const STAGE_GRID_CELL = 28;

/** Tall enough for the densest 6-row demo panel + footnote at every breakpoint. */
const STAGE_MIN_H = "min-h-[34rem] sm:min-h-[36rem]";

/** One-line title + dek + touch padding — stable row height with all deks visible. */
const TAB_ROW_MIN_H = "min-h-[3.75rem]";

export function EvidenceAnatomyStage({
  cases,
  panels,
}: {
  cases: readonly EvidenceCaseMeta[];
  panels: Partial<Record<EvidenceCaseId, ReactNode>>;
}) {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { once: false, amount: 0.15 });
  const available = useMemo(
    () => cases.filter((c) => panels[c.id] != null),
    // panels are stable server-passed nodes for the page lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cases, panels],
  );
  const [activeId, setActiveId] = useState<EvidenceCaseId | null>(null);
  const [progressKey, setProgressKey] = useState(0);
  // Keyboard-focus pause: while a tab holds visible focus, auto-advance is
  // suspended so the roving tabindex can never desync from the focused tab
  // (WCAG 2.2.2 pause behaviour). Mouse clicks don't set :focus-visible, so
  // pointer users keep the uninterrupted auto-rotation.
  const [railFocusVisible, setRailFocusVisible] = useState(false);
  const activeIdRef = useRef<EvidenceCaseId | null>(null);

  const resolvedActiveId = activeId ?? available[0]?.id ?? null;
  activeIdRef.current = resolvedActiveId;

  const activeIndex = Math.max(
    0,
    available.findIndex((c) => c.id === resolvedActiveId),
  );

  function advance() {
    if (available.length < 2) return;
    setActiveId((current) => {
      const id = current ?? available[0]?.id;
      const idx = available.findIndex((c) => c.id === id);
      const next = available[(idx + 1) % available.length];
      return next?.id ?? id ?? null;
    });
    setProgressKey((k) => k + 1);
  }

  function selectCase(id: EvidenceCaseId) {
    setActiveId(id);
    setProgressKey((k) => k + 1);
  }

  /** Roving-focus keyboard support for the vertical tablist. */
  function onTablistKeyDown(e: React.KeyboardEvent) {
    const idx = Math.max(
      0,
      available.findIndex((c) => c.id === (activeIdRef.current ?? "")),
    );
    let next: number | null = null;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      next = (idx + 1) % available.length;
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      next = (idx - 1 + available.length) % available.length;
    } else if (e.key === "Home") {
      next = 0;
    } else if (e.key === "End") {
      next = available.length - 1;
    }
    if (next === null) return;
    e.preventDefault();
    const target = available[next];
    if (!target) return;
    selectCase(target.id);
    document.getElementById(`evidence-tab-${target.id}`)?.focus();
  }

  function onTablistFocus(e: React.FocusEvent) {
    const target = e.target as HTMLElement;
    if (typeof target.matches === "function" && target.matches(":focus-visible")) {
      setRailFocusVisible(true);
    }
  }

  function onTablistBlur(e: React.FocusEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setRailFocusVisible(false);
    }
  }

  if (available.length === 0 || !resolvedActiveId) return null;

  const active =
    available.find((c) => c.id === resolvedActiveId) ?? available[0]!;

  // Active card first, remaining cases cycling behind it — the stack shuffles
  // as this order changes.
  const ordered = available.map(
    (_, i) => available[(activeIndex + i) % available.length]!,
  );

  return (
    <div ref={rootRef}>
      <style>{`
        @keyframes evidence-case-progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        @keyframes evidence-stage-wash-drift {
          from { background-position: 28% 38%; }
          to { background-position: 42% 48%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .evidence-case-progress {
            animation: none !important;
            width: 100% !important;
          }
          .evidence-stage-wash {
            animation: none !important;
            background-position: 40% 50% !important;
          }
        }
      `}</style>

      {/* Left rail sizes to fit single-line titles (fit-content cap); stage
          takes all remaining width. Gaps match platform two-column sections. */}
      <div className="flex flex-col gap-10 [overflow-anchor:none] lg:grid lg:grid-cols-[fit-content(28rem)_minmax(0,1fr)] lg:items-stretch lg:gap-12 xl:grid-cols-[fit-content(30rem)_minmax(0,1fr)] xl:gap-16">
        <div
          className={cn(
            "flex w-full min-w-0 flex-col justify-center lg:w-full lg:max-w-[28rem] xl:max-w-[30rem]",
            "lg:min-h-[34rem] xl:min-h-[36rem]",
            "[overflow-anchor:none]",
          )}
        >
          <SectionHeader
            kicker="On the record"
            measure="rail"
            scale="feature"
            title="Evidence you can inspect."
            description="Every supplier claim includes the evidence to verify it yourself."
            className="max-w-none"
            titleClassName="max-w-none whitespace-normal lg:whitespace-nowrap"
          />

          <ul
            className="mt-8 flex flex-col gap-1 sm:mt-10"
            role="tablist"
            aria-orientation="vertical"
            aria-label="Evidence categories"
            onKeyDown={onTablistKeyDown}
            onFocus={onTablistFocus}
            onBlur={onTablistBlur}
          >
            {available.map((item) => {
              const isActive = item.id === active.id;
              return (
                <li key={item.id} role="presentation" className="relative">
                  <button
                    type="button"
                    role="tab"
                    id={`evidence-tab-${item.id}`}
                    aria-selected={isActive}
                    aria-controls="evidence-stage-panel"
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => selectCase(item.id)}
                    className={cn(
                      "group relative flex w-full items-start gap-3 overflow-hidden rounded-lg px-3 py-2 text-left transition-[background-color,box-shadow,color] duration-200",
                      TAB_ROW_MIN_H,
                      isActive
                        ? "bg-white shadow-[0_1px_2px_rgba(15,15,20,0.04)] ring-1 ring-black/[0.05]"
                        : "bg-neutral-100/45 hover:bg-neutral-100/80",
                    )}
                  >
                    <span
                      className={cn(
                        "w-5 shrink-0 pt-0.5 font-display text-[12px] tabular-nums tracking-tight transition-colors duration-200",
                        isActive
                          ? "font-semibold text-brand-forest"
                          : "text-neutral-500 group-hover:text-neutral-600",
                      )}
                      aria-hidden
                    >
                      {item.index}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block font-display text-[14px] font-semibold leading-5 tracking-[-0.015em] transition-colors duration-200 sm:text-[15px] lg:whitespace-nowrap",
                          isActive
                            ? "text-neutral-950"
                            : "text-neutral-800 group-hover:text-neutral-950",
                        )}
                      >
                        {item.title}
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 block text-[13px] leading-snug transition-colors duration-200",
                          isActive ? "text-neutral-600" : "text-neutral-500",
                        )}
                      >
                        {item.description}
                      </span>
                    </span>

                    {isActive && !reduce && inView ? (
                      <span
                        key={`${item.id}-${progressKey}`}
                        aria-hidden
                        className="evidence-case-progress pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[2px] bg-brand-forest"
                        style={{
                          width: 0,
                          animation: `evidence-case-progress ${AUTO_MS}ms linear forwards`,
                          animationPlayState: railFocusVisible
                            ? "paused"
                            : "running",
                        }}
                        onAnimationEnd={(e) => {
                          if (e.animationName !== "evidence-case-progress") return;
                          if (activeIdRef.current !== item.id) return;
                          advance();
                        }}
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div
          role="tabpanel"
          id="evidence-stage-panel"
          aria-labelledby={`evidence-tab-${active.id}`}
          className="relative mx-auto w-full min-w-0 max-w-[840px] [overflow-anchor:none] lg:mx-0 lg:max-w-none"
          data-home-demo-evidence-stage
        >
          <div
            className={cn(
              "evidence-stage-wash relative overflow-hidden rounded-card",
              "border border-neutral-200/80",
              "shadow-[0_1px_2px_rgba(15,15,20,0.03),0_12px_28px_-24px_rgba(15,15,20,0.10)]",
              STAGE_PAD,
              STAGE_MIN_H,
            )}
            style={{
              backgroundImage: STAGE_WASH,
              backgroundRepeat: "no-repeat",
              backgroundSize: "180% 180%",
              backgroundPosition: "30% 40%",
              animation: reduce
                ? undefined
                : "evidence-stage-wash-drift 18s ease-in-out infinite alternate",
            }}
          >
            {/* Whisper depth — ink only, no green bloom */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-card"
              style={{
                background:
                  "radial-gradient(ellipse 70% 55% at 18% 12%, rgba(15,15,20,0.025) 0%, transparent 55%), radial-gradient(ellipse 55% 45% at 88% 88%, rgba(15,15,20,0.03) 0%, transparent 60%)",
              }}
            />
            {/* Hairline technical grid — nearly invisible */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-card opacity-[0.22]"
              style={{
                backgroundImage: `
                  linear-gradient(
                    to right,
                    rgba(15,15,20,0.06) 1px,
                    transparent 1px
                  ),
                  linear-gradient(
                    to bottom,
                    rgba(15,15,20,0.06) 1px,
                    transparent 1px
                  )
                `,
                backgroundSize: `${STAGE_GRID_CELL}px ${STAGE_GRID_CELL}px`,
                maskImage:
                  "radial-gradient(ellipse 80% 70% at 50% 45%, black 25%, transparent 75%)",
                WebkitMaskImage:
                  "radial-gradient(ellipse 80% 70% at 50% 45%, black 25%, transparent 75%)",
              }}
            />

            {reduce ? (
              <div className="relative z-[1] w-full min-w-0">
                {panels[active.id]}
              </div>
            ) : (
              <div
                className="relative z-[1] grid w-full min-w-0 content-start"
                data-evidence-stage-card
              >
                {ordered.map((item, index) => (
                  <motion.div
                    key={item.id}
                    layout={false}
                    className="w-full min-w-0 [grid-area:1/1]"
                    style={{
                      zIndex: ordered.length - index,
                      pointerEvents: index === 0 ? "auto" : "none",
                    }}
                    aria-hidden={index !== 0}
                    inert={index !== 0}
                    initial={false}
                    animate={{ opacity: index === 0 ? 1 : 0 }}
                    transition={{ duration: 0.4, ease: EASE_SOFT }}
                  >
                    {panels[item.id]}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
