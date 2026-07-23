"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Buildings,
  Certificate,
  ClipboardText,
  Factory,
  FileText,
  ListChecks,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";
import { useInView, useReducedMotion } from "motion/react";

import { SectionHeader } from "@/components/marketing/home/section-header";
import { sourceLogo } from "@/lib/source-logos";
import { cn } from "@/lib/utils";

type WorkflowCard = {
  source: string;
  title: string;
  action: string;
  icon: typeof ShieldCheck;
  tint: string;
};

type WorkflowSlot = {
  className: string;
  duration: number;
  delay: number;
  cards: WorkflowCard[];
};

const CARD_POOL: WorkflowCard[] = [
  {
    source: "BGMEA",
    title: "BGMEA",
    action: "Verify member register",
    icon: Buildings,
    tint: "bg-brand-forest-soft text-brand-forest",
  },
  {
    source: "BKMEA",
    title: "BKMEA",
    action: "Sync knitwear registry",
    icon: Factory,
    tint: "bg-brand-forest-tint text-brand-forest",
  },
  {
    source: "RSC",
    title: "RSC",
    action: "Pull remediation status",
    icon: ShieldCheck,
    tint: "bg-teal-50 text-teal-700",
  },
  {
    source: "OEKO_TEX",
    title: "OEKO-TEX",
    action: "Check certificate record",
    icon: Certificate,
    tint: "bg-cyan-50 text-cyan-700",
  },
  {
    source: "EPB",
    title: "EPB",
    action: "Match exporter filing",
    icon: FileText,
    tint: "bg-slate-100 text-slate-600",
  },
  {
    source: "BTMA",
    title: "BTMA",
    action: "Resolve textile mill",
    icon: ListChecks,
    tint: "bg-neutral-100 text-neutral-600",
  },
  {
    source: "GOTS",
    title: "GOTS",
    action: "Validate scope certificate",
    icon: Certificate,
    tint: "bg-emerald-50 text-emerald-700",
  },
  {
    source: "WRAP",
    title: "WRAP",
    action: "Refresh audit evidence",
    icon: ClipboardText,
    tint: "bg-amber-50 text-amber-700",
  },
  {
    source: "SA8000",
    title: "SA8000",
    action: "Review social cert",
    icon: Certificate,
    tint: "bg-stone-100 text-stone-600",
  },
  {
    source: "uflpa",
    title: "UFLPA",
    action: "Screen entity list",
    icon: ShieldCheck,
    tint: "bg-neutral-100 text-neutral-600",
  },
  {
    source: "BGAPMEA",
    title: "BGAPMEA",
    action: "Check accessory registry",
    icon: Factory,
    tint: "bg-amber-50 text-amber-700",
  },
  {
    source: "ofac_sdn",
    title: "OFAC SDN",
    action: "Screen sanctions list",
    icon: ShieldCheck,
    tint: "bg-neutral-100 text-neutral-600",
  },
  {
    source: "uk_ofsi",
    title: "UK OFSI",
    action: "Check sanctions record",
    icon: ShieldCheck,
    tint: "bg-neutral-100 text-neutral-600",
  },
  {
    source: "GRS",
    title: "GRS",
    action: "Validate recycled content",
    icon: Certificate,
    tint: "bg-neutral-100 text-neutral-600",
  },
  {
    source: "BSCI",
    title: "amfori BSCI",
    action: "Check audit record",
    icon: ClipboardText,
    tint: "bg-neutral-100 text-neutral-600",
  },
];

function card(index: number): WorkflowCard {
  const item = CARD_POOL[index];
  if (!item) {
    throw new Error(`Missing workflow card at index ${index}`);
  }
  return item;
}

const SLOTS: WorkflowSlot[] = [
  { className: "", duration: 8200, delay: 400, cards: [card(0)] },
  { className: "", duration: 9800, delay: 2300, cards: [card(1)] },
  { className: "", duration: 8800, delay: 4700, cards: [card(2)] },
  { className: "", duration: 10400, delay: 1400, cards: [card(3)] },
  { className: "", duration: 10600, delay: 6200, cards: [card(4)] },
  { className: "", duration: 8600, delay: 1800, cards: [card(5)] },
  { className: "", duration: 10100, delay: 7200, cards: [card(6)] },
  { className: "", duration: 9300, delay: 3900, cards: [card(7)] },
  { className: "", duration: 8300, delay: 7800, cards: [card(8)] },
  { className: "", duration: 9400, delay: 4200, cards: [card(9)] },
  { className: "", duration: 10800, delay: 1200, cards: [card(10)] },
  { className: "", duration: 9000, delay: 900, cards: [card(11)] },
  { className: "", duration: 10200, delay: 6600, cards: [card(12)] },
  { className: "", duration: 9400, delay: 4200, cards: [card(13)] },
  { className: "", duration: 10800, delay: 1200, cards: [card(14)] },
];

function SourceTile({ source, title, icon: Icon, tint }: Pick<WorkflowCard, "source" | "title" | "icon" | "tint">) {
  const logo = sourceLogo(source);

  return (
    <span className={cn("flex h-[22px] w-[22px] shrink-0 items-center justify-center overflow-hidden rounded-[5px] sm:h-7 sm:w-7 sm:rounded-md", tint)}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-full w-full rounded-[inherit] bg-white object-contain p-0.5" />
      ) : (
        <Icon size={14} weight="fill" className="sm:size-4" aria-hidden />
      )}
      <span className="sr-only">{title}</span>
    </span>
  );
}

function WorkflowCardView({
  card,
  complete,
  fill,
  visible,
  duration,
  cycle,
}: {
  card: WorkflowCard;
  complete: boolean;
  fill: boolean;
  visible: boolean;
  duration: number;
  cycle: number;
}) {
  return (
    <article
      className={cn(
        "relative box-border flex min-h-[108px] w-full flex-col gap-2 overflow-hidden rounded-lg border border-brand-forest/10 bg-white/80 p-3 shadow-sm transition-[opacity,transform,border-color,background-color] duration-700 ease-out sm:min-h-[118px] sm:gap-3 sm:rounded-[10px] sm:p-4",
        visible
          ? "scale-100 opacity-100"
          : "pointer-events-none absolute inset-0 scale-95 opacity-0",
      )}
    >
      <div className="flex items-start gap-2 sm:items-center sm:gap-2.5">
        <SourceTile source={card.source} title={card.title} icon={card.icon} tint={card.tint} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate text-[12px] font-semibold leading-tight text-neutral-800 sm:text-[13px]">
            {card.title}
          </p>
          <p className="line-clamp-2 text-[12px] leading-snug text-neutral-500">
            {card.action}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "h-[5px] w-[5px] shrink-0 rounded-full transition-colors duration-300 min-[641px]:h-1.5 min-[641px]:w-1.5",
            complete ? "bg-[#60917E]" : "bg-[#F68D2E]",
            !complete && "motion-safe:animate-pulse",
          )}
          aria-hidden
        />
        <span className={cn("font-mono text-[12px] text-neutral-500 transition-colors duration-300", complete && "text-[#60917E]")}>
          {complete ? "Completed" : "Running"}
        </span>
      </div>

      <div
        className="mt-auto h-[3px] overflow-hidden rounded-px"
        style={{ backgroundColor: "var(--hairline)" }}
      >
        <div
          key={cycle}
          className="h-full rounded-px"
          style={{
            backgroundColor: "#60917E",
            width: fill ? "100%" : "0%",
            transition: fill ? `width ${duration}ms linear` : "none",
          }}
        />
      </div>
    </article>
  );
}

function WorkflowSlotCard({
  slot,
  slotIndex,
  active,
  onAdvance,
  running,
  className,
}: {
  slot: WorkflowSlot;
  slotIndex: number;
  active: number | null;
  onAdvance: (slotIndex: number) => void;
  running: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion() ?? false;
  const [cycle, setCycle] = useState(0);
  const [fill, setFill] = useState(false);
  const [complete, setComplete] = useState(false);
  const [visible, setVisible] = useState(true);
  // Keep the previous card mounted during fade so the grid cell never
  // collapses to an empty hole between cycles.
  const [outgoing, setOutgoing] = useState<number | null>(null);
  const prevActive = useRef<number | null>(active);

  useEffect(() => {
    const previous = prevActive.current;
    if (previous !== null && previous !== active) {
      setOutgoing(previous);
      const clearOutgoing = setTimeout(() => setOutgoing(null), 750);
      prevActive.current = active;
      return () => clearTimeout(clearOutgoing);
    }
    prevActive.current = active;
  }, [active]);

  useEffect(() => {
    if (reduce || !running) {
      setVisible(true);
      setComplete(true);
      setFill(true);
      return;
    }

    if (active === null) return;

    let doneTimer: ReturnType<typeof setTimeout>;
    let fadeTimer: ReturnType<typeof setTimeout>;
    let swapTimer: ReturnType<typeof setTimeout>;
    let raf = 0;
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      setVisible(true);
      setComplete(false);
      setFill(false);
      setCycle((current) => current + 1);
      raf = requestAnimationFrame(() => setFill(true));

      doneTimer = setTimeout(() => {
        setComplete(true);
      }, slot.duration);

      fadeTimer = setTimeout(() => {
        setVisible(false);
      }, slot.duration + 900);

      // Hold the painted card through the fade, then hand off. The outgoing
      // layer (above) keeps the cell filled until the next card arrives.
      swapTimer = setTimeout(() => {
        onAdvance(slotIndex);
      }, slot.duration + 1650);
    };

    const startTimer = setTimeout(run, slot.delay);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(startTimer);
      clearTimeout(doneTimer);
      clearTimeout(fadeTimer);
      clearTimeout(swapTimer);
    };
  }, [active, onAdvance, reduce, running, slot.delay, slot.duration, slotIndex]);

  const displayCard = active ?? outgoing;
  if (displayCard === null) {
    return (
      <div
        className={cn("relative min-h-[108px] sm:min-h-[118px]", slot.className, className)}
        aria-hidden
      />
    );
  }

  return (
    <div className={cn("relative min-h-[108px] sm:min-h-[118px]", slot.className, className)}>
      <WorkflowCardView
        card={card(displayCard)}
        complete={active === null ? true : complete}
        fill={active === null ? true : fill}
        // Keep the prior card painted while the slot is between cards so the
        // grid never flashes an empty cell.
        visible={active === null ? true : visible}
        duration={slot.duration}
        cycle={cycle}
      />
    </div>
  );
}

export function WorkflowAgentsMarquee({
  className,
  title = "Always checking. Always current.",
}: {
  className?: string;
  title?: string;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const inView = useInView(rootRef, { once: false, amount: 0.1 });
  const [activeBySlot, setActiveBySlot] = useState<Array<number | null>>(() =>
    SLOTS.map((_, index) => (index < CARD_POOL.length ? index : null)),
  );

  const advanceSlot = useCallback((slotIndex: number) => {
    setActiveBySlot((current) => {
      const movingCard = current[slotIndex];
      if (movingCard === null || movingCard === undefined) return current;

      const next = [...current];
      next[slotIndex] = null;

      for (let offset = 1; offset <= next.length; offset += 1) {
        const targetIndex = (slotIndex + offset) % next.length;
        if (next[targetIndex] === null) {
          next[targetIndex] = movingCard;
          break;
        }
      }

      return next;
    });
  }, []);

  return (
    <section
      ref={rootRef}
      aria-label="Live evidence checks"
      className={cn(
        "relative isolate overflow-hidden border-b border-neutral-200 bg-neutral-50 py-16 text-neutral-900 md:py-20",
        className,
      )}
    >
      <div className="relative mx-auto w-full max-w-[1200px]">
        <div className="px-4 sm:px-6">
          <SectionHeader
            kicker="Live evidence checks"
            title={title}
            description="SourceBD continuously monitors registries, certifications, and watchlists to keep supplier records up to date."
          />
        </div>

        <div className="relative mx-auto mt-12 overflow-hidden sm:mt-[4.5rem] md:mt-20">
          <div className="grid grid-cols-2 gap-2 px-4 sm:grid-cols-3 sm:gap-2.5 sm:px-6 lg:grid-cols-5">
            {SLOTS.map((slot, index) => (
              <WorkflowSlotCard
                key={index}
                slot={slot}
                slotIndex={index}
                active={activeBySlot[index] ?? null}
                onAdvance={advanceSlot}
                running={inView}
                className={index === SLOTS.length - 1 ? "hidden sm:block" : undefined}
              />
            ))}
          </div>

          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-4 bg-gradient-to-r from-neutral-50/90 to-transparent sm:w-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-4 bg-gradient-to-l from-neutral-50/90 to-transparent sm:w-10" />
        </div>
      </div>
    </section>
  );
}
