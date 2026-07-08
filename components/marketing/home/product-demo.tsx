"use client";

// Cinematic product walkthrough — a self-contained "screen recording" that
// runs entirely from real React + Tailwind (no video file, no GIF). It loops
// through the three things a buyer actually does on SourceBD, inside a
// faux-browser frame:
//
//   01 · Search   — a query types itself, live autocomplete opens, cursor clicks
//   02 · Vet      — real DiscoverResultCard-styled cards spring in, staggered;
//                   the lead card lights up and the cursor opens it
//   03 · Contact  — a supplier profile opens; verified evidence lands row by
//                   row, each status confirming with a pop
//
// Fidelity: card + profile markup mirror components/discover/result-card.tsx
// and the profile header — same tokens, avatar, registry-mark tiles, verified
// line. Registry marks use the real logo resolver (lib/source-logos) and the
// real assets under /public/inapp-logos. Illustrative example companies only
// (same convention as the shipped HeroDossierPreview). No SBI numeric.
//
// Motion: honours prefers-reduced-motion — the timeline freezes on the final
// profile state and entrances settle instantly.

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
  type Variants,
} from "motion/react";
import {
  ArrowRight,
  Check,
  ClockCounterClockwise,
  CursorClick,
  Lock,
  MagnifyingGlass,
  MapPin,
  PaperPlaneTilt,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";

import { CompanyAvatar } from "@/components/supplier/company-avatar";
import { sourceLogo } from "@/lib/source-logos";
import { cn } from "@/lib/utils";

// ─── Scene timeline ──────────────────────────────────────────────
const SCENES = ["search", "results", "profile"] as const;
type Scene = (typeof SCENES)[number];

const SCENE_MS: Record<Scene, number> = {
  search: 4200,
  results: 4200,
  profile: 5200,
};

const QUERY = "OEKO-TEX certified knit factory, Dhaka";

const SPRING: Transition = { type: "spring", stiffness: 240, damping: 24, mass: 0.9 };
const SPRING_POP: Transition = { type: "spring", stiffness: 460, damping: 17 };

// ─── Illustrative data (real companies, illustrative details) ────
type Mark = string;

type DemoCompany = {
  name: string;
  entity: string;
  location: string;
  marks: Mark[];
  count: number;
  employees: number;
};

const RESULTS: DemoCompany[] = [
  { name: "DBL Group", entity: "Factory", location: "Gazipur", marks: ["BGMEA", "OEKO_TEX", "RSC"], count: 5, employees: 45000 },
  { name: "Square Fashions", entity: "Factory", location: "Dhaka", marks: ["BKMEA", "GOTS", "WRAP"], count: 4, employees: 12000 },
  { name: "Viyellatex", entity: "Factory", location: "Dhaka", marks: ["BGMEA", "GRS"], count: 4, employees: 22000 },
];

const LEAD = RESULTS[0]!;

const SUGGESTIONS = [
  { text: "OEKO-TEX certified knit factory, Dhaka", history: false },
  { text: "OEKO-TEX knit — Gazipur belt", history: true },
  { text: "GOTS organic cotton, Narayanganj", history: true },
];

// Evidence rows that land on the profile (issuer · what · status).
const EVIDENCE: { code: Mark; label: string; status: string; check: boolean }[] = [
  { code: "BGMEA", label: "Trade association register", status: "Verified", check: true },
  { code: "RSC", label: "Remediation & safety evidence", status: "96%", check: false },
  { code: "GOTS", label: "Certification body record", status: "Active", check: true },
  { code: "uflpa", label: "Sanctions screening", status: "Clear", check: true },
];

// ─── Small pieces ────────────────────────────────────────────────

function MarkTile({ tag, size = 30 }: { tag: Mark; size?: number }) {
  const logo = sourceLogo(tag);
  const label = tag === "OEKO_TEX" ? "OEKO-TEX" : tag.toUpperCase();
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="flex shrink-0 items-center justify-center rounded-[6px] border border-[rgba(15,15,20,0.065)] bg-[#fafaf9] font-mono text-[11px] font-bold text-[#4a4a55]"
      style={{ width: size, height: size }}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-full w-full rounded-[5px] object-contain p-1" />
      ) : (
        label.replace(/[^A-Za-z0-9]/g, "").slice(0, 3)
      )}
    </span>
  );
}

// A cursor that glides in from below-right, settles on its target, then taps
// with a forest ripple. Feels hand-driven rather than teleported.
function TapCursor({ delay, reduce }: { delay: number; reduce: boolean }) {
  if (reduce) return null;
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute -bottom-2 -right-1 z-30 text-brand-forest drop-shadow-[0_2px_5px_rgba(31,77,58,0.35)]"
      initial={{ opacity: 0, scale: 0.7, x: 22, y: 22 }}
      animate={{
        opacity: [0, 1, 1, 1, 1],
        scale: [0.7, 1, 1, 0.86, 1],
        x: [22, 0, 0, 0, 0],
        y: [22, 0, 0, 0, 0],
      }}
      transition={{ duration: 1.2, delay, times: [0, 0.4, 0.62, 0.78, 1], ease: "easeOut" }}
    >
      <span className="relative flex">
        <CursorClick size={26} weight="fill" />
        <motion.span
          className="absolute -left-2 -top-2 -z-10 rounded-full bg-brand-forest/25"
          initial={{ width: 0, height: 0, opacity: 0 }}
          animate={{ width: [0, 40], height: [0, 40], opacity: [0.55, 0] }}
          transition={{ duration: 0.7, delay: delay + 0.5 }}
        />
      </span>
    </motion.span>
  );
}

// ─── Faithful card replica (Discover result card, compacted) ─────

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.97, filter: "blur(7px)" },
  visible: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
};

function DemoCard({ c, lead, reduce }: { c: DemoCompany; lead?: boolean; reduce: boolean }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-white px-3.5 py-3 text-left transition-colors sm:px-5 sm:py-4 lg:px-6 lg:py-5",
        lead ? "border-brand-forest/30 bg-[#fafaf9]" : "border-neutral-200 shadow-sm",
      )}
    >
      {/* lead card gets a soft focus ring that breathes in just before the click */}
      {lead && !reduce ? (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-brand-forest/25"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0, 1, 1] }}
          transition={{ duration: 2.4, times: [0, 0.55, 0.72, 1] }}
        />
      ) : null}

      <div className="relative flex items-start gap-3 sm:gap-4">
        <CompanyAvatar name={c.name} verified className="mt-0.5 scale-[0.72] sm:scale-90" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-display text-[15px] font-black leading-tight tracking-[-0.02em] text-neutral-900 sm:text-[18px] lg:text-[21px]">
              {c.name}
            </h3>
            <span className="hidden shrink-0 text-right sm:block">
              <span className="font-display text-[15px] font-bold leading-none tabular-nums text-neutral-800">
                {c.employees.toLocaleString()}
              </span>
              <span className="ml-1 text-[12px] text-neutral-400">staff</span>
            </span>
          </div>

          <div className="mt-1 flex items-center gap-1.5 text-[12px] font-medium text-neutral-600">
            <span className="inline-flex items-center rounded-pill bg-neutral-100 px-1.5 py-0.5 text-[11px] font-semibold text-neutral-600">
              {c.entity}
            </span>
            <MapPin size={13} weight="fill" aria-hidden className="shrink-0 text-neutral-400" />
            <span className="truncate">{c.location}</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-neutral-600 sm:gap-2">
            {c.marks.map((m) => (
              <MarkTile key={m} tag={m} size={24} />
            ))}
            <span className="font-medium text-neutral-700">Verified by {c.count} sources</span>
          </div>
        </div>

        <span
          className={cn(
            "hidden shrink-0 items-center gap-1 self-center rounded-lg px-2.5 py-1.5 text-[13px] font-semibold sm:flex",
            lead ? "bg-brand-forest text-white" : "text-brand-forest",
          )}
        >
          View
          <ArrowRight size={15} weight="bold" aria-hidden />
        </span>
      </div>
      {lead ? <TapCursor delay={2.4} reduce={reduce} /> : null}
    </div>
  );
}

// ─── Scene: Search ───────────────────────────────────────────────

function SearchView({ typed, reduce }: { typed: string; reduce: boolean }) {
  const complete = typed.length >= QUERY.length;
  const showSuggestions = reduce || typed.length > 14;

  return (
    <motion.div
      key="search"
      className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center sm:px-10"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduce ? undefined : { opacity: 0, transition: { duration: 0.25 } }}
    >
      <motion.span
        className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-forest-soft text-brand-forest"
        initial={reduce ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={SPRING_POP}
      >
        <MagnifyingGlass size={24} weight="duotone" aria-hidden />
      </motion.span>
      <p className="font-display text-base font-bold tracking-tight text-neutral-900 sm:text-xl">
        Find a verified factory
      </p>
      <p className="mt-1 max-w-xs text-[12px] leading-relaxed text-neutral-500 sm:text-[13px]">
        Search by certification, product or district — every result is on the record.
      </p>

      <div className="relative mt-5 w-full max-w-lg">
        <div
          className={cn(
            "relative z-10 flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 shadow-sm transition-colors sm:py-3",
            showSuggestions ? "border-brand-forest/40" : "border-neutral-200",
          )}
        >
          <MagnifyingGlass size={18} className="shrink-0 text-neutral-400" aria-hidden />
          <span className="flex-1 truncate text-left text-[13px] text-neutral-900 sm:text-sm">
            {typed || <span className="text-neutral-400">OEKO-TEX certified knit factory…</span>}
            {!reduce && !complete ? (
              <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-brand-forest align-middle" />
            ) : null}
          </span>
          <span className="relative inline-flex shrink-0 items-center rounded-lg bg-brand-forest px-3 py-1.5 text-[12px] font-semibold text-white">
            Search
            {complete ? <TapCursor delay={0.5} reduce={reduce} /> : null}
          </span>
        </div>

        {/* live autocomplete */}
        <AnimatePresence>
          {showSuggestions ? (
            <motion.ul
              className="absolute inset-x-0 top-[calc(100%+6px)] z-0 overflow-hidden rounded-xl border border-neutral-200 bg-white p-1.5 text-left shadow-[0_16px_40px_-20px_rgba(15,15,20,0.35)]"
              initial={reduce ? false : { opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? undefined : { opacity: 0, y: -8, transition: { duration: 0.15 } }}
              transition={SPRING}
            >
              {SUGGESTIONS.map((s, i) => (
                <motion.li
                  key={s.text}
                  initial={reduce ? false : { opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: reduce ? 0 : 0.08 + i * 0.07, ...SPRING }}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] sm:text-[13px]",
                    i === 0 ? "bg-brand-forest-soft text-neutral-900" : "text-neutral-600",
                  )}
                >
                  {s.history ? (
                    <ClockCounterClockwise size={15} className="shrink-0 text-neutral-400" aria-hidden />
                  ) : (
                    <MagnifyingGlass size={15} className="shrink-0 text-brand-forest" aria-hidden />
                  )}
                  <span className="truncate">{s.text}</span>
                  {i === 0 ? (
                    <span className="ml-auto hidden shrink-0 rounded bg-white/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-brand-forest sm:inline">
                      ↵ enter
                    </span>
                  ) : null}
                </motion.li>
              ))}
            </motion.ul>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Scene: Results ──────────────────────────────────────────────

function ResultsView({ reduce }: { reduce: boolean }) {
  return (
    <motion.div
      key="results"
      className="absolute inset-0 flex flex-col px-3.5 pt-3.5 sm:px-6 sm:pt-5 lg:px-10 lg:pt-7"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduce ? undefined : { opacity: 0, transition: { duration: 0.25 } }}
    >
      <motion.div
        className="mb-3 flex items-center justify-between"
        initial={reduce ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING}
      >
        <p className="font-mono text-[11px] uppercase tracking-widest text-neutral-500">
          <span className="font-semibold text-brand-forest">3</span> verified matches
        </p>
        <span className="rounded-pill border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-500">
          Dhaka · Knit
        </span>
      </motion.div>

      <motion.div
        className="flex flex-1 flex-col justify-center gap-2.5 sm:gap-4 lg:gap-5"
        initial={reduce ? false : "hidden"}
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: reduce ? 0 : 0.16, delayChildren: 0.1 } } }}
      >
        {RESULTS.map((c, i) => (
          <motion.div key={c.name} variants={reduce ? undefined : cardVariants} transition={SPRING}>
            <DemoCard c={c} lead={i === 0} reduce={reduce} />
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

// ─── Scene: Profile ──────────────────────────────────────────────

function ProfileView({ reduce }: { reduce: boolean }) {
  return (
    <motion.div
      key="profile"
      className="absolute inset-0 flex flex-col px-3.5 pt-4 sm:px-6 sm:pt-6 lg:px-10 lg:pt-8"
      initial={reduce ? false : { opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduce ? undefined : { opacity: 0, x: -28, transition: { duration: 0.25 } }}
      transition={SPRING}
    >
      {/* Header */}
      <motion.div
        className="flex items-start gap-3 border-b border-neutral-200 pb-3.5 sm:gap-4"
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING}
      >
        <CompanyAvatar name={LEAD.name} verified variant="profile" className="scale-[0.72] sm:scale-90" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-lg font-black tracking-[-0.02em] text-neutral-900 sm:text-2xl">
            {LEAD.name}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] font-medium text-neutral-600">
            <span className="inline-flex items-center rounded-pill bg-neutral-100 px-1.5 py-0.5 text-[11px] font-semibold text-neutral-600">
              {LEAD.entity}
            </span>
            <MapPin size={13} weight="fill" aria-hidden className="shrink-0 text-neutral-400" />
            <span>{LEAD.location}, Bangladesh</span>
          </div>
          <div className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-forest">
            <span className="inline-flex size-4 items-center justify-center rounded-full border border-brand-forest/25">
              <Check size={11} weight="bold" aria-hidden />
            </span>
            Verified by {LEAD.count} independent sources
          </div>
        </div>
      </motion.div>

      {/* Evidence rows landing one by one */}
      <div className="mt-3 flex flex-1 flex-col justify-center gap-2 sm:mt-5 sm:gap-3 lg:gap-3.5">
        {EVIDENCE.map((e, i) => {
          const landDelay = reduce ? 0 : 0.25 + i * 0.55;
          return (
            <motion.div
              key={e.code}
              initial={reduce ? false : { opacity: 0, y: 12, filter: "blur(5px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: landDelay, ...SPRING }}
              className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-2.5 py-2 sm:grid-cols-[30px_minmax(0,1fr)_auto] sm:gap-3 sm:px-4 sm:py-3 lg:py-4"
            >
              <MarkTile tag={e.code} size={28} />
              <span className="min-w-0 truncate text-[12px] text-neutral-700 sm:text-[13px]">
                {e.label}
              </span>
              <motion.span
                className="inline-flex items-center gap-1 rounded-md bg-brand-forest-soft px-2 py-0.5 text-[11px] font-semibold text-brand-forest"
                initial={reduce ? false : { scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: landDelay + 0.22, ...SPRING_POP }}
              >
                {e.check ? <Check size={11} weight="bold" aria-hidden /> : null}
                {e.status}
              </motion.span>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        className="mt-auto flex items-center justify-between py-3"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: reduce ? 0 : 0.25 + EVIDENCE.length * 0.55 }}
      >
        <span className="inline-flex items-center gap-1.5 text-[12px] text-neutral-500">
          <ShieldCheck size={15} weight="duotone" className="text-brand-forest" aria-hidden />
          Traced to the issuing authority
        </span>
        <span className="relative inline-flex items-center gap-1.5 rounded-lg bg-brand-forest px-3 py-1.5 text-[12px] font-semibold text-white">
          <PaperPlaneTilt size={14} weight="fill" aria-hidden />
          Message factory
        </span>
      </motion.div>
    </motion.div>
  );
}

// ─── Journey stepper (connected rail + glowing active node) ──────

const STEPS: { scene: Scene; n: string; label: string; hint: string; icon: typeof MagnifyingGlass }[] = [
  { scene: "search", n: "01", label: "Search", hint: "by cert, product or district", icon: MagnifyingGlass },
  { scene: "results", n: "02", label: "Vet the evidence", hint: "sources behind every claim", icon: ShieldCheck },
  { scene: "profile", n: "03", label: "Contact directly", hint: "no broker, no middleman", icon: PaperPlaneTilt },
];

function Stepper({ sceneIndex, loop, reduce }: { sceneIndex: number; loop: number; reduce: boolean }) {
  return (
    <div className="mt-6 sm:mt-8">
      {/* nodes + rails */}
      <ol className="flex items-center">
        {STEPS.map((step, i) => {
          const state = i < sceneIndex ? "done" : i === sceneIndex ? "active" : "upcoming";
          const Icon = step.icon;
          const isLast = i === STEPS.length - 1;
          return (
            <li key={step.n} className={cn("flex items-center", !isLast && "flex-1")}>
              <div className="relative shrink-0">
                {state === "active" && !reduce ? (
                  <motion.span
                    aria-hidden
                    className="absolute -inset-1 rounded-full bg-brand-forest/25"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                ) : null}
                <motion.div
                  className={cn(
                    "relative flex size-9 items-center justify-center rounded-full border sm:size-11",
                    state === "upcoming"
                      ? "border-neutral-200 bg-white text-neutral-400"
                      : "border-brand-forest bg-brand-forest text-white shadow-[0_6px_16px_-6px_rgba(31,77,58,0.6)]",
                  )}
                  animate={reduce ? undefined : { scale: state === "active" ? 1.06 : 1 }}
                  transition={SPRING}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {state === "done" ? (
                      <motion.span
                        key="check"
                        initial={reduce ? false : { scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={SPRING_POP}
                      >
                        <Check size={18} weight="bold" aria-hidden />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="icon"
                        initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={reduce ? undefined : { scale: 0.6, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <Icon size={18} weight={state === "active" ? "fill" : "duotone"} aria-hidden />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>

              {!isLast ? (
                <div className="mx-2 h-[3px] flex-1 overflow-hidden rounded-full bg-neutral-200 sm:mx-3">
                  {i < sceneIndex ? (
                    <div className="h-full w-full rounded-full bg-brand-forest" />
                  ) : i === sceneIndex && !reduce ? (
                    <motion.div
                      key={`rail-${i}-${loop}`}
                      className="h-full rounded-full bg-brand-forest"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: SCENE_MS[step.scene] / 1000, ease: "easeInOut" }}
                    />
                  ) : (
                    <div className="h-full w-0" />
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {/* labels aligned under each node */}
      <div className="mt-3 flex">
        {STEPS.map((step, i) => {
          const active = i === sceneIndex;
          const align = i === 0 ? "items-start text-left" : i === STEPS.length - 1 ? "items-end text-right" : "items-center text-center";
          return (
            <div key={step.n} className={cn("flex flex-1 flex-col", align)}>
              <span
                className={cn(
                  "text-[12px] font-semibold leading-tight transition-colors duration-300 sm:text-[13px]",
                  active ? "text-neutral-900" : i < sceneIndex ? "text-brand-forest" : "text-neutral-400",
                )}
              >
                {step.label}
              </span>
              <span className="mt-0.5 hidden text-[11px] leading-tight text-neutral-400 sm:block">
                {step.hint}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Root ────────────────────────────────────────────────────────

export function ProductDemo() {
  const reduce = useReducedMotion() ?? false;
  const [sceneIndex, setSceneIndex] = useState(0);
  const [loop, setLoop] = useState(0);
  const [typed, setTyped] = useState("");
  const frozen = useRef(false);

  const scene = SCENES[sceneIndex]!;

  useEffect(() => {
    if (reduce) {
      frozen.current = true;
      setSceneIndex(SCENES.indexOf("profile"));
      setTyped(QUERY);
    }
  }, [reduce]);

  useEffect(() => {
    if (frozen.current) return;
    const id = setTimeout(() => {
      setSceneIndex((s) => {
        const next = (s + 1) % SCENES.length;
        if (next === 0) setLoop((l) => l + 1);
        return next;
      });
    }, SCENE_MS[scene]);
    return () => clearTimeout(id);
  }, [sceneIndex, scene]);

  useEffect(() => {
    if (frozen.current || scene !== "search") return;
    setTyped("");
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(QUERY.slice(0, i));
      if (i >= QUERY.length) clearInterval(id);
    }, 52);
    return () => clearInterval(id);
  }, [scene, loop]);

  const url = scene === "profile" ? "sourcebd.net/suppliers/dbl-group" : "sourcebd.net/discover";

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* Browser frame */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[0_10px_30px_-18px_rgba(15,15,20,0.18)] sm:rounded-2xl">
        {/* Tab strip */}
        <div className="flex items-end gap-2 border-b border-neutral-200 bg-neutral-100 pl-3 pr-4 pt-2 sm:pl-4">
          <div className="mr-1 flex items-center gap-1.5 pb-2">
            <span className="size-2.5 rounded-full bg-neutral-300" />
            <span className="size-2.5 rounded-full bg-neutral-300" />
            <span className="size-2.5 rounded-full bg-neutral-300" />
          </div>
          <div className="flex items-center gap-2 rounded-t-lg border border-b-0 border-neutral-200 bg-white px-3 py-1.5">
            <span className="size-2 rounded-full bg-brand-forest" />
            <span className="text-[11px] font-medium text-neutral-600 sm:text-[12px]">SourceBD</span>
          </div>
        </div>

        {/* URL bar */}
        <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2 sm:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1 sm:px-3">
            <Lock size={12} weight="fill" className="shrink-0 text-brand-forest" aria-hidden />
            <AnimatePresence mode="wait">
              <motion.span
                key={url}
                initial={reduce ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
                className="truncate font-mono text-[11px] text-neutral-500 sm:text-[12px]"
              >
                {url}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        {/* Viewport */}
        <div className="relative h-[380px] overflow-hidden bg-bg-l0 sm:h-[520px] lg:h-[600px]">
          {/* depth: soft top light + edge vignette */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[15]"
            style={{
              background:
                "radial-gradient(120% 70% at 50% -10%, rgba(255,255,255,0.7), transparent 42%), radial-gradient(100% 60% at 50% 115%, rgba(15,15,20,0.035), transparent 45%)",
            }}
          />

          {/* subtle scanning beam */}
          {!reduce ? (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 z-20 h-28 bg-gradient-to-b from-brand-forest/[0.08] to-transparent"
              initial={{ y: -120 }}
              animate={{ y: [-120, 640] }}
              transition={{ duration: SCENE_MS[scene] / 1000, ease: "linear" }}
              key={`beam-${scene}-${loop}`}
            />
          ) : null}

          <AnimatePresence mode="wait">
            {scene === "search" ? (
              <SearchView key="s" typed={typed} reduce={reduce} />
            ) : scene === "results" ? (
              <ResultsView key="r" reduce={reduce} />
            ) : (
              <ProfileView key="p" reduce={reduce} />
            )}
          </AnimatePresence>
        </div>
      </div>

      <Stepper sceneIndex={sceneIndex} loop={loop} reduce={reduce} />
    </div>
  );
}
