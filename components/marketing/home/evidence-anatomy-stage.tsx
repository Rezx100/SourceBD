"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  motion,
  useReducedMotion,
} from "motion/react";
import {
  Buildings,
  Certificate,
  MapPin,
  ListChecks,
  Prohibit,
  EnvelopeSimple,
  type Icon,
} from "@phosphor-icons/react";

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

const CASE_ICONS: Record<EvidenceCaseId, Icon> = {
  registries: Buildings,
  certifications: Certificate,
  sanctions: Prohibit,
  contact: EnvelopeSimple,
  addresses: MapPin,
  provenance: ListChecks,
};

const AUTO_MS = 4200;

const STAGE_PAD = "p-[2.6rem] md:p-[3.25rem] xl:p-[3.9rem]";

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

export function EvidenceAnatomyStage({
  cases,
  panels,
}: {
  cases: readonly EvidenceCaseMeta[];
  panels: Partial<Record<EvidenceCaseId, ReactNode>>;
}) {
  const reduce = useReducedMotion();
  const available = useMemo(
    () => cases.filter((c) => panels[c.id] != null),
    // panels are stable server-passed nodes for the page lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cases, panels],
  );
  const [activeId, setActiveId] = useState<EvidenceCaseId | null>(null);
  const [progressKey, setProgressKey] = useState(0);
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

  if (available.length === 0 || !resolvedActiveId) return null;

  const active =
    available.find((c) => c.id === resolvedActiveId) ?? available[0]!;

  // Active card first, remaining cases cycling behind it — the stack shuffles
  // as this order changes.
  const ordered = available.map(
    (_, i) => available[(activeIndex + i) % available.length]!,
  );

  return (
    <div>
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

      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-10 xl:gap-12">
        {/* Left rail — takes whatever width the fluid stage leaves */}
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <SectionHeader
            kicker="On the record"
            measure="rail"
            scale="feature"
            title="Evidence you can inspect."
            description="Every supplier claim includes the evidence to verify it yourself."
          />

          <ul
            className="mt-10 border-t border-neutral-200 sm:mt-12"
            role="tablist"
            aria-orientation="vertical"
            aria-label="Evidence surfaces"
            onKeyDown={onTablistKeyDown}
          >
            {available.map((item) => {
              const Icon = CASE_ICONS[item.id];
              const isActive = item.id === active.id;
              return (
                <li
                  key={item.id}
                  role="presentation"
                  className="relative border-b border-neutral-200"
                >
                  <button
                    type="button"
                    role="tab"
                    id={`evidence-tab-${item.id}`}
                    aria-selected={isActive}
                    aria-controls="evidence-stage-panel"
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => selectCase(item.id)}
                    className={cn(
                      "group relative flex w-full items-center gap-3 py-2.5 text-left transition-colors duration-200",
                      "hover:bg-neutral-50/70",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors duration-200",
                        isActive
                          ? "border-brand-forest/20 bg-brand-forest-soft text-brand-forest"
                          : "border-neutral-200 bg-white text-neutral-500 group-hover:border-neutral-300",
                      )}
                    >
                      <Icon
                        size={14}
                        weight={isActive ? "duotone" : "regular"}
                        aria-hidden
                      />
                    </span>

                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate font-display text-[14px] font-semibold tracking-[-0.01em] transition-colors duration-200",
                        isActive ? "text-neutral-950" : "text-neutral-700",
                      )}
                    >
                      {item.title}
                    </span>

                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 font-mono text-[12px] tabular-nums transition-colors duration-200",
                        isActive
                          ? "font-semibold text-neutral-800"
                          : "text-neutral-500",
                      )}
                    >
                      {item.index}
                    </span>
                  </button>

                  {isActive && !reduce ? (
                    <span
                      key={`${item.id}-${progressKey}`}
                      aria-hidden
                      className="evidence-case-progress pointer-events-none absolute bottom-0 left-0 z-[1] h-[2px] bg-brand-forest"
                      style={{
                        width: 0,
                        animation: `evidence-case-progress ${AUTO_MS}ms linear forwards`,
                      }}
                      onAnimationEnd={(e) => {
                        if (e.animationName !== "evidence-case-progress") return;
                        if (activeIdRef.current !== item.id) return;
                        advance();
                      }}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Right stage — fluid (min(720px,56vw)) so the left rail keeps
            ~380px at every width instead of collapsing at 1024–1200px */}
        <div
          role="tabpanel"
          id="evidence-stage-panel"
          aria-labelledby={`evidence-tab-${active.id}`}
          className="relative mx-auto w-full max-w-[840px] shrink-0 lg:mx-0 lg:w-[min(720px,56vw)]"
        >
          <div
            className={cn(
              "evidence-stage-wash relative overflow-hidden rounded-card",
              "border border-neutral-200/80",
              "shadow-[0_1px_2px_rgba(15,15,20,0.03),0_12px_28px_-24px_rgba(15,15,20,0.10)]",
              STAGE_PAD,
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
                className="relative z-[1] grid w-full min-w-0"
                data-evidence-stage-card
              >
                {ordered.map((item, index) => (
                  <motion.div
                    key={item.id}
                    className="w-full min-w-0 [grid-area:1/1] will-change-transform"
                    style={{
                      zIndex: ordered.length - index,
                      pointerEvents: index === 0 ? "auto" : "none",
                    }}
                    aria-hidden={index !== 0}
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
