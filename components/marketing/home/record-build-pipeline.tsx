"use client";

import { createRef, useMemo, useRef, useState, useEffect } from "react";
import {
  ArrowRight,
  BellSimple,
  Buildings,
  CalendarBlank,
  Certificate,
  ClipboardText,
  Factory,
  FileText,
  ListChecks,
  MapPin,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";
import { useReducedMotion } from "motion/react";

import { AnimatedBeam } from "@/components/ui/animated-beam";
import { CompanyAvatar } from "@/components/supplier/company-avatar";
import { ProductIcon } from "@/components/supplier/product-icon";
import { dedupProducts } from "@/lib/product-icons";
import { sourceLogo } from "@/lib/source-logos";
import { cn } from "@/lib/utils";

type WorkflowCard = {
  source: string;
  title: string;
  action: string;
  icon: typeof ShieldCheck;
  tint: string;
};

const CARD_POOL: WorkflowCard[] = [
  { source: "BGMEA", title: "BGMEA", action: "Verify member register", icon: Buildings, tint: "bg-brand-forest-soft text-brand-forest" },
  { source: "BKMEA", title: "BKMEA", action: "Sync knitwear registry", icon: Factory, tint: "bg-brand-forest-tint text-brand-forest" },
  { source: "RSC", title: "RSC", action: "Pull remediation status", icon: ShieldCheck, tint: "bg-teal-50 text-teal-700" },
  { source: "OEKO_TEX", title: "OEKO-TEX", action: "Check certificate record", icon: Certificate, tint: "bg-cyan-50 text-cyan-700" },
  { source: "EPB", title: "EPB", action: "Match exporter filing", icon: FileText, tint: "bg-slate-100 text-slate-600" },
  { source: "BTMA", title: "BTMA", action: "Resolve textile mill", icon: ListChecks, tint: "bg-neutral-100 text-neutral-600" },
  { source: "GOTS", title: "GOTS", action: "Validate scope certificate", icon: Certificate, tint: "bg-emerald-50 text-emerald-700" },
  { source: "WRAP", title: "WRAP", action: "Refresh audit evidence", icon: ClipboardText, tint: "bg-amber-50 text-amber-700" },
  { source: "SA8000", title: "SA8000", action: "Review social cert", icon: Certificate, tint: "bg-stone-100 text-stone-600" },
  { source: "uflpa", title: "UFLPA", action: "Screen entity list", icon: ShieldCheck, tint: "bg-neutral-100 text-neutral-600" },
  { source: "BGAPMEA", title: "BGAPMEA", action: "Check accessory registry", icon: Factory, tint: "bg-amber-50 text-amber-700" },
  { source: "ofac_sdn", title: "OFAC SDN", action: "Screen sanctions list", icon: ShieldCheck, tint: "bg-neutral-100 text-neutral-600" },
  { source: "uk_ofsi", title: "UK OFSI", action: "Check sanctions record", icon: ShieldCheck, tint: "bg-neutral-100 text-neutral-600" },
  { source: "GRS", title: "GRS", action: "Validate recycled content", icon: Certificate, tint: "bg-neutral-100 text-neutral-600" },
  { source: "BSCI", title: "amfori BSCI", action: "Check audit record", icon: ClipboardText, tint: "bg-neutral-100 text-neutral-600" },
];

// Split evenly either side of the canonical record — 8 left / 7 right.
const LEFT_CARDS = CARD_POOL.slice(0, 8);
const RIGHT_CARDS = CARD_POOL.slice(8);

const TIMINGS = [
  { duration: 8200, delay: 400 },
  { duration: 9800, delay: 2300 },
  { duration: 8800, delay: 4700 },
  { duration: 10400, delay: 1400 },
  { duration: 10600, delay: 6200 },
  { duration: 8600, delay: 1800 },
  { duration: 10100, delay: 7200 },
  { duration: 9300, delay: 3900 },
  { duration: 8300, delay: 7800 },
  { duration: 9400, delay: 4200 },
  { duration: 10800, delay: 1200 },
  { duration: 9000, delay: 900 },
  { duration: 10200, delay: 6600 },
  { duration: 9400, delay: 4200 },
  { duration: 10800, delay: 1200 },
] as const;

function SourceTile({ source, title, icon: Icon, tint }: Pick<WorkflowCard, "source" | "title" | "icon" | "tint">) {
  const logo = sourceLogo(source);
  return (
    <span className={cn("flex h-[18px] w-[18px] shrink-0 items-center justify-center overflow-hidden rounded-[5px] sm:h-5 sm:w-5 sm:rounded-[6px] md:h-6 md:w-6", tint)}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-full w-full rounded-[inherit] bg-white object-contain p-0.5" />
      ) : (
        <Icon size={11} weight="fill" className="sm:size-3 md:size-3.5" aria-hidden />
      )}
      <span className="sr-only">{title}</span>
    </span>
  );
}

// A single scanning source — a square chip, never a full card. Every chip
// pulses through the same running → completed cycle and traces its own
// beam straight into the canonical record.
function ScanChip({
  card,
  duration,
  delay,
  chipRef,
}: {
  card: WorkflowCard;
  duration: number;
  delay: number;
  chipRef: React.RefObject<HTMLDivElement | null>;
}) {
  const reduce = useReducedMotion() ?? false;
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (reduce) {
      setComplete(true);
      return;
    }

    let doneTimer: ReturnType<typeof setTimeout>;
    let repeatTimer: ReturnType<typeof setTimeout>;

    const run = () => {
      setComplete(false);
      doneTimer = setTimeout(() => setComplete(true), duration);
      repeatTimer = setTimeout(run, duration + 1800);
    };
    const startTimer = setTimeout(run, delay);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(doneTimer);
      clearTimeout(repeatTimer);
    };
  }, [delay, duration, reduce]);

  return (
    <div
      ref={chipRef}
      className="relative flex aspect-square w-8 shrink-0 items-center justify-center rounded-[8px] border border-brand-forest/10 bg-white shadow-sm sm:w-11 sm:rounded-[10px] md:w-[52px]"
      title={`${card.title} — ${card.action}`}
    >
      <SourceTile source={card.source} title={card.title} icon={card.icon} tint={card.tint} />
      <span
        className={cn(
          "absolute -right-[3px] -top-[3px] size-[7px] rounded-full border-[1.5px] border-white transition-colors duration-300 sm:size-2",
          complete ? "bg-[#60917E]" : "bg-[#F68D2E] motion-safe:animate-pulse",
        )}
        aria-hidden
      />
    </div>
  );
}

function CanonicalCenterCard() {
  const tags = ["GOTS", "OEKO_TEX", "RSC"] as const;
  const shown = dedupProducts(["Babies' apparel", "Children's apparel"]).slice(0, 2);
  return (
    <article className="relative overflow-hidden rounded-lg border border-neutral-200 bg-white px-4 pb-3.5 pt-4 text-left shadow-sm">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <CompanyAvatar name="Arbella Fashion Limited" verified className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-display text-[20px] font-black leading-tight tracking-[-0.02em] text-neutral-900">
              Arbella Fashion Limited
            </h3>
            <span className="shrink-0 rounded-full border border-neutral-200 p-1">
              <BellSimple size={14} className="text-neutral-500" aria-hidden />
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[14px] font-medium text-neutral-600">
            <span className="inline-flex items-center rounded-pill bg-neutral-100 px-2 py-0.5 text-[12px] font-semibold text-neutral-600">
              Factory
            </span>
            <MapPin size={16} weight="fill" aria-hidden className="ml-0.5 shrink-0 text-neutral-400" />
            <span className="truncate">Sreepur</span>
          </div>
        </div>
      </div>

      <div className="mt-3.5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[13px] text-neutral-600">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex size-[30px] shrink-0 items-center justify-center rounded-[6px] border border-[rgba(15,15,20,0.065)] bg-[#fafaf9]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sourceLogo(tag) ?? ""} alt="" className="h-full w-full rounded-[5px] object-contain p-1" />
            </span>
          ))}
          <span className="mr-1 text-neutral-500">+2</span>
          <span className="min-w-0 truncate font-medium text-neutral-700">5 verified sources</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] leading-snug text-neutral-700">
          {shown.map((product) => (
            <span key={product} className="inline-flex items-center gap-1 font-medium">
              <ProductIcon product={product} className="product-icon preview-product-icon shrink-0 text-neutral-400" />
              {product}
            </span>
          ))}
          <span className="whitespace-nowrap font-semibold text-brand-forest underline decoration-brand-forest/30 underline-offset-2">
            +12 more categories
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 pt-3 text-[13px] text-neutral-500" style={{ borderTop: "1px solid rgba(15,15,20,0.045)" }}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <CalendarBlank size={17} weight="duotone" aria-hidden className="text-neutral-400" />
            Est. 2013
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="font-display text-[15px] font-bold tabular-nums text-neutral-700">400</span>
            employees
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-1 font-semibold text-brand-forest">
          View profile
          <ArrowRight size={17} weight="bold" aria-hidden />
        </span>
      </div>
    </article>
  );
}

// Every chip beams straight into the canonical record. Elbow position is
// spread per row so the vertical risers sit in their own lane and never
// cross — a fan of square paths, not a tangle.
function laneElbow(index: number, count: number) {
  if (count <= 1) return 0.5;
  return 0.22 + (index / (count - 1)) * 0.56;
}

export function RecordBuildPipeline({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const leftRefs = useMemo(() => LEFT_CARDS.map(() => createRef<HTMLDivElement>()), []);
  const rightRefs = useMemo(() => RIGHT_CARDS.map(() => createRef<HTMLDivElement>()), []);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="flex items-center justify-center gap-1 sm:gap-4 md:gap-6">
        <div className="flex shrink-0 flex-col items-end justify-center gap-1.5 sm:gap-2 md:gap-2.5">
          {LEFT_CARDS.map((card, index) => (
            <ScanChip key={card.title} card={card} chipRef={leftRefs[index]!} duration={TIMINGS[index]!.duration} delay={TIMINGS[index]!.delay} />
          ))}
        </div>

        <div ref={centerRef} className="z-10 w-[218px] shrink-0 sm:w-[280px] md:w-[340px]">
          <CanonicalCenterCard />
        </div>

        <div className="flex shrink-0 flex-col items-start justify-center gap-1.5 sm:gap-2 md:gap-2.5">
          {RIGHT_CARDS.map((card, index) => (
            <ScanChip
              key={card.title}
              card={card}
              chipRef={rightRefs[index]!}
              duration={TIMINGS[LEFT_CARDS.length + index]!.duration}
              delay={TIMINGS[LEFT_CARDS.length + index]!.delay}
            />
          ))}
        </div>
      </div>

      {LEFT_CARDS.map((card, index) => (
        <AnimatedBeam
          key={`beam-l-${card.title}`}
          containerRef={containerRef}
          fromRef={leftRefs[index]!}
          toRef={centerRef}
          pathType="angular"
          elbowAt={laneElbow(index, LEFT_CARDS.length)}
          duration={3.8}
          delay={0}
          pathColor="rgb(212 212 216)"
          pathWidth={1.3}
          gradientStartColor="rgb(71 85 105)"
          gradientStopColor="rgb(14 116 144)"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      ))}
      {RIGHT_CARDS.map((card, index) => (
        <AnimatedBeam
          key={`beam-r-${card.title}`}
          containerRef={containerRef}
          fromRef={rightRefs[index]!}
          toRef={centerRef}
          pathType="angular"
          elbowAt={laneElbow(index, RIGHT_CARDS.length)}
          duration={3.8}
          delay={0}
          pathColor="rgb(212 212 216)"
          pathWidth={1.3}
          gradientStartColor="rgb(71 85 105)"
          gradientStopColor="rgb(14 116 144)"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      ))}
    </div>
  );
}
