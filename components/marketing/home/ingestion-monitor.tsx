"use client";

// Cinematic "live evidence sync" — two clean panels with a line-comet pipe
// between them. It shows how SourceBD assembles one verified profile:
//
//   LEFT  "Reading official sources" — every issuing authority we read, as a
//         tidy logo grid. For the company currently being verified, the exact
//         registers + certifications it holds light up and confirm one by one.
//   PIPE  thin line comets flow left → right (no ball), carrying evidence.
//   RIGHT "Verified profiles" — the company currently being built (marks land
//         as each source confirms; on completion the card gives an "updated"
//         pulse), above a short feed of the profiles just verified.
//
// When a company finishes it drops into the verified feed and the next company
// enters, restarting the scan with its own set of issuers.
//
// Buyer-safe language only (no "scraper/scraping", "VPS", "worker", "ETL",
// "cron", "heartbeat", "run id"). "Queued for manual review" is the workflow
// reveal: low-confidence matches never auto-publish. Illustrative companies /
// figures (same convention as HeroDossierPreview). No SBI numeric.
//
// Motion: honours prefers-reduced-motion — completed static state, no comets,
// no counters rolling, no cycling.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react";
import { ArrowsClockwise, Check, MapPin, UsersThree } from "@phosphor-icons/react/dist/ssr";

import { CompanyAvatar } from "@/components/supplier/company-avatar";
import { sourceLogo } from "@/lib/source-logos";
import { cn } from "@/lib/utils";

const SPRING: Transition = { type: "spring", stiffness: 300, damping: 26, mass: 0.85 };
const SPRING_POP: Transition = { type: "spring", stiffness: 460, damping: 17 };

const LEAD_MS = 650;
const REVEAL_MS = 900;
const DONE_MS = 1400;
const ROLL_MS = 150;
const FEED_SIZE = 3;

const ISSUERS = [
  "BGMEA", "BKMEA", "BGAPMEA", "BTMA", "EPB", "RSC",
  "OEKO_TEX", "WRAP", "GOTS", "GRS", "RCS", "BSCI",
];

function issuerName(tag: string): string {
  return tag === "OEKO_TEX" ? "OEKO-TEX" : tag.toUpperCase();
}

type Company = { name: string; entity: string; loc: string; marks: string[] };

const COMPANIES: Company[] = [
  { name: "DBL Group", entity: "Factory", loc: "Gazipur", marks: ["BGMEA", "OEKO_TEX", "RSC"] },
  { name: "Square Fashions", entity: "Factory", loc: "Dhaka", marks: ["BKMEA", "GOTS", "GRS"] },
  { name: "Ha-Meem Group", entity: "Factory", loc: "Ashulia", marks: ["BGMEA", "WRAP", "RSC"] },
  { name: "Viyellatex", entity: "Factory", loc: "Dhaka", marks: ["BGMEA", "OEKO_TEX"] },
  { name: "Epyllion Group", entity: "Factory", loc: "Bhaluka", marks: ["BKMEA", "GOTS", "RSC", "GRS"] },
  { name: "Beximco", entity: "Factory", loc: "Gazipur", marks: ["BGMEA", "OEKO_TEX", "BSCI"] },
  { name: "Envoy Textiles", entity: "Factory", loc: "Gazipur", marks: ["BTMA", "GOTS", "GRS"] },
  { name: "Fakir Fashion", entity: "Factory", loc: "Narayanganj", marks: ["BKMEA", "OEKO_TEX", "RSC"] },
  { name: "Pacific Jeans", entity: "Factory", loc: "Chattogram", marks: ["BGMEA", "WRAP"] },
  { name: "Mondol Group", entity: "Factory", loc: "Gazipur", marks: ["BGMEA", "OEKO_TEX", "RCS"] },
];

// ─── Logo helpers ────────────────────────────────────────────────
function IssuerLogo({ tag, size }: { tag: string; size: number }) {
  const logo = sourceLogo(tag);
  return logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt="" className="object-contain" style={{ width: size, height: size }} aria-hidden />
  ) : (
    <span className="font-mono text-[9px] font-bold text-[#4a4a55]" aria-hidden>
      {issuerName(tag).replace(/[^A-Za-z0-9]/g, "").slice(0, 3)}
    </span>
  );
}

function MarkChip({ tag, size = 24 }: { tag: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[6px] border border-[rgba(15,15,20,0.065)] bg-[#fafaf9]"
      style={{ width: size, height: size }}
      title={issuerName(tag)}
      aria-hidden
    >
      <IssuerLogo tag={tag} size={size - 8} />
    </span>
  );
}

type TileState = "idle" | "waiting" | "scanning" | "confirmed";

function IssuerTile({ tag, state, reduce }: { tag: string; state: TileState; reduce: boolean }) {
  const on = state !== "idle";
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        title={issuerName(tag)}
        className={cn(
          "relative flex aspect-square w-full items-center justify-center rounded-xl border bg-white transition-all duration-500",
          state === "idle" && "border-neutral-200 opacity-40 grayscale",
          state === "waiting" && "border-brand-forest/25",
          state === "scanning" && "border-brand-forest shadow-[0_4px_14px_-4px_rgba(31,77,58,0.45)]",
          state === "confirmed" && "border-brand-forest/40",
        )}
      >
        <IssuerLogo tag={tag} size={22} />
        {state === "scanning" && !reduce ? (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-xl ring-2 ring-brand-forest"
            animate={{ opacity: [0.9, 0.3, 0.9], scale: [1, 1.05, 1] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : null}
        <AnimatePresence>
          {state === "confirmed" ? (
            <motion.span
              key="c"
              aria-hidden
              className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-brand-forest text-white shadow-sm"
              initial={reduce ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reduce ? undefined : { scale: 0, opacity: 0 }}
              transition={SPRING_POP}
            >
              <Check size={10} weight="bold" />
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>
      <span className={cn("text-[9px] font-semibold transition-colors duration-500", on ? "text-neutral-600" : "text-neutral-300")}>
        {issuerName(tag)}
      </span>
    </div>
  );
}

// A travelling LINE segment (not a ball) — the comet.
function LineComet({ delay, vertical }: { delay: number; vertical?: boolean }) {
  if (vertical) {
    return (
      <motion.span
        aria-hidden
        className="absolute left-1/2 h-8 w-[2px] -translate-x-1/2 rounded-full bg-gradient-to-b from-transparent via-brand-forest to-transparent"
        initial={{ top: "-30%", opacity: 0 }}
        animate={{ top: ["-30%", "115%"], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, delay, ease: "linear" }}
      />
    );
  }
  return (
    <motion.span
      aria-hidden
      className="absolute top-1/2 h-[2px] w-10 -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-brand-forest to-transparent"
      initial={{ left: "-18%", opacity: 0 }}
      animate={{ left: ["-18%", "118%"], opacity: [0, 1, 1, 0] }}
      transition={{ duration: 1.5, repeat: Infinity, delay, ease: "linear" }}
    />
  );
}

function FeedMonogram({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="relative flex size-8 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-100 font-display text-[11px] font-bold text-neutral-700">
      {initials}
      <span className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full border-[1.5px] border-white bg-brand-forest text-white">
        <Check size={9} weight="bold" aria-hidden />
      </span>
    </span>
  );
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "forest" }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-400 sm:text-[11px]">{label}</p>
      <p className={cn("mt-0.5 font-display text-lg font-bold tabular-nums tracking-tight sm:text-2xl", tone === "forest" ? "text-brand-forest" : "text-neutral-900")}>
        {value}
      </p>
    </div>
  );
}

export function IngestionMonitor() {
  const reduce = useReducedMotion() ?? false;

  const [companyIndex, setCompanyIndex] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [phase, setPhase] = useState<"scanning" | "done">("scanning");
  const [feed, setFeed] = useState<Company[]>(() => [COMPANIES[9]!, COMPANIES[8]!]);

  const [scanned, setScanned] = useState(9182);
  const [verified, setVerified] = useState(8046);
  const [review, setReview] = useState(37);
  const companyCount = useRef(0);

  const company = COMPANIES[companyIndex]!;
  const total = company.marks.length;

  useEffect(() => {
    if (reduce) {
      setRevealed(total);
      setPhase("done");
      return;
    }
    setRevealed(0);
    setPhase("scanning");
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < total; i += 1) {
      timers.push(setTimeout(() => setRevealed(i + 1), LEAD_MS + i * REVEAL_MS));
    }
    const doneAt = LEAD_MS + total * REVEAL_MS;
    timers.push(setTimeout(() => setPhase("done"), doneAt));
    timers.push(
      setTimeout(() => {
        setFeed((prev) => [company, ...prev].slice(0, FEED_SIZE));
        setVerified((v) => v + 1);
        companyCount.current += 1;
        if (companyCount.current % 4 === 0) setReview((r) => r + 1);
        setCompanyIndex((x) => (x + 1) % COMPANIES.length);
      }, doneAt + DONE_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [companyIndex, reduce, total, company]);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setScanned((n) => n + 2 + Math.floor(Math.random() * 4)), ROLL_MS);
    return () => clearInterval(id);
  }, [reduce]);

  function tileState(tag: string): TileState {
    const idx = company.marks.indexOf(tag);
    if (idx === -1) return "idle";
    if (phase === "done" || idx < revealed) return "confirmed";
    if (idx === revealed) return "scanning";
    return "waiting";
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)] md:gap-0">
        {/* ── LEFT PANEL ── */}
        <div className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-2.5">
            <span className="relative flex size-2.5">
              {!reduce ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-forest/50" /> : null}
              <span className="relative inline-flex size-2.5 rounded-full bg-brand-forest" />
            </span>
            <span className="font-display text-sm font-bold tracking-tight text-neutral-900 sm:text-base">Reading official sources</span>
          </div>
          <p className="mt-1 text-[12px] text-neutral-500">
            Matching <span className="font-semibold text-neutral-700">{company.name}</span> to every issuing authority.
          </p>

          <div className="mt-4 grid grid-cols-4 gap-2.5 sm:gap-3">
            {ISSUERS.map((tag) => (
              <IssuerTile key={tag} tag={tag} state={tileState(tag)} reduce={reduce} />
            ))}
          </div>
        </div>

        {/* ── PIPE (line comets) ── */}
        <div className="relative hidden md:block">
          <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-brand-forest/10 via-brand-forest/25 to-brand-forest/10" />
          {!reduce ? (
            <>
              <LineComet delay={0} />
              <LineComet delay={0.75} />
            </>
          ) : null}
        </div>
        <div className="relative mx-auto h-8 w-px bg-gradient-to-b from-brand-forest/10 via-brand-forest/30 to-brand-forest/10 md:hidden">
          {!reduce ? <LineComet delay={0} vertical /> : null}
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold tracking-tight text-neutral-900 sm:text-base">
              <UsersThree size={17} weight="duotone" className="text-brand-forest" aria-hidden />
              Verified profiles
            </span>
            <span className="inline-flex items-center gap-1 rounded-pill border border-brand-forest/20 bg-brand-forest-soft px-2 py-0.5 font-mono text-[10px] font-semibold text-brand-forest">
              <Check size={10} weight="bold" aria-hidden />
              live
            </span>
          </div>

          {/* current company being built */}
          <motion.div
            className="relative overflow-hidden rounded-xl border border-brand-forest/30 bg-[#fafaf9] p-3 sm:p-3.5"
            animate={reduce ? undefined : phase === "done" ? { scale: [1, 1.025, 1] } : { scale: 1 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            <AnimatePresence>
              {phase === "done" && !reduce ? (
                <motion.span
                  key={`flash-${companyIndex}`}
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-brand-forest/40"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                />
              ) : null}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.div
                key={companyIndex}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -12, transition: { duration: 0.22 } }}
                transition={SPRING}
                className="flex items-start gap-3"
              >
                <CompanyAvatar name={company.name} verified={phase === "done"} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate font-display text-[15px] font-black tracking-[-0.02em] text-neutral-900 sm:text-[17px]">
                      {company.name}
                    </h3>
                    {phase === "done" ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-brand-forest px-2 py-0.5 text-[10px] font-semibold text-white">
                        <Check size={10} weight="bold" aria-hidden />
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-white px-2 py-0.5 text-[10px] font-semibold text-neutral-500">
                        <ArrowsClockwise size={10} weight="bold" className={cn(!reduce && "motion-safe:animate-spin")} style={{ animationDuration: "1.4s" }} aria-hidden />
                        Scanning
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-neutral-500">
                    <MapPin size={12} weight="fill" aria-hidden className="shrink-0 text-neutral-400" />
                    {company.loc}, Bangladesh
                  </div>
                  <div className="mt-2 flex min-h-[24px] flex-wrap items-center gap-1.5">
                    {company.marks.slice(0, revealed).map((m) => (
                      <motion.span key={m} initial={reduce ? false : { scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING_POP}>
                        <MarkChip tag={m} />
                      </motion.span>
                    ))}
                    <span className="ml-0.5 text-[11px] font-medium text-neutral-700">
                      {phase === "done" ? `Verified by ${total} sources` : `Confirming… ${revealed}/${total}`}
                    </span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* recently verified feed */}
          <p className="mb-1.5 mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-400">Recently verified</p>
          <div className="flex flex-col gap-2">
            <AnimatePresence initial={false} mode="popLayout">
              {feed.map((c, i) => (
                <motion.div
                  key={`${c.name}-${i}`}
                  layout={!reduce}
                  initial={reduce ? false : { opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, transition: { duration: 0.2 } }}
                  transition={SPRING}
                  className="flex items-center gap-2.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-2"
                >
                  <FeedMonogram name={c.name} />
                  <span className="truncate text-[12px] font-semibold text-neutral-800">{c.name}</span>
                  <span className="ml-auto flex shrink-0 items-center gap-1">
                    {c.marks.slice(0, 3).map((m) => (
                      <MarkChip key={m} tag={m} size={18} />
                    ))}
                    <span className="ml-1 inline-flex size-4 items-center justify-center rounded-full bg-brand-forest text-white">
                      <Check size={9} weight="bold" aria-hidden />
                    </span>
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── live figures + workflow reveal ── */}
      <div className="mt-4 grid grid-cols-1 gap-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:grid-cols-3 sm:items-center sm:p-5">
        <Stat label="Records scanned" value={scanned.toLocaleString()} />
        <Stat label="Profiles verified" value={verified.toLocaleString()} tone="forest" />
        <div className="flex items-start gap-2.5 rounded-xl border border-sem-amber/30 bg-sem-amber-soft/40 p-3">
          <span className="relative mt-0.5 flex size-2.5 shrink-0">
            {!reduce ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sem-amber/50" /> : null}
            <span className="relative inline-flex size-2.5 rounded-full bg-sem-amber" />
          </span>
          <div className="min-w-0">
            <p className="flex items-baseline gap-1.5 text-[12px] font-semibold text-neutral-900">
              <span className="font-display text-base tabular-nums text-sem-amber">{review}</span>
              queued for manual review
            </p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-neutral-500">
              Low-confidence matches never auto-publish — a person checks them first.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-center font-mono text-[11px] text-neutral-500">
        <span className="h-px w-6 bg-neutral-200" />
        Reconciled to one canonical record per factory · higher-tier evidence wins
        <span className="h-px w-6 bg-neutral-200" />
      </div>
    </div>
  );
}
