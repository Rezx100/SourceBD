"use client";

// Buyer workflow bento — /home-demo only.
//
// One continuous ~22-second sourcing story told across five cards:
// follow supplier → compose & send RFQ → cursor handoff →
// conversation → compliance check → MSA document ready → invisible reset.
//
// Sequencing pass (founder review pass 5, 23 Jul) — supersedes the earlier
// chapter-overlap timing where they conflict:
// 1. Chapters are strictly SEQUENTIAL: the next chapter starts only after
//    the previous card's last animation has fully settled plus a ~1s
//    dwell. The only overlaps left are the gentle pre-wake un-dim and the
//    cursor's own glide between cards.
// 2. Button state changes only on press RELEASE: "Send RFQ" holds its
//    label through the press-down and flips to "Sending…" when the click
//    releases — never a frame before the click reads as complete.
//
// Storytelling threads (founder review pass 2, 23 Jul; amended pass 4):
// 1. ONE shared cursor travels the full story (bookmark → RFQ → Send →
//    conversation → compliance row → MSA download). It NEVER hides or
//    changes shape — during the RFQ handoff it glides card 2 → 3 as the
//    single moving object. (The paper-plane flight was removed: any
//    second traveler read as a duplicate/morphing pointer.)
// 2. Active card is guided by cursor + soft dimming of siblings (no edge bars).
//
// Motion-quality pass (founder review pass 3, 23 Jul) — timing only:
// 1. Chapters overlap by 150–250ms so each action reads as *causing* the
//    next (the cursor departs while the success panel is still settling;
//    compliance starts while the buyer is still drafting; MSA spins up
//    while the compliance row settles).
// 2. Send RFQ → success is a strict causal chain: click → button
//    "Sending…" → ~300ms delay → panel wakes into its own sending state →
//    success. The panel never anticipates the click.
// 3. Completed cards keep near-invisible ambient life (breathing toast
//    check, pulsing sent-ring, blinking draft caret, pulsing ready check)
//    so the section never looks frozen between chapters.
// 4. Compliance update gets a temporary gray+border emphasis at the exact
//    update moment, relaxing to the quiet lit state. No extra green.
// 5. MSA runs a believable state ladder: Queued → Generating → Preparing →
//    Ready → Download enabled (each its own beat).
//
// Choreography pass (founder review pass 4, 23 Jul) — timing only:
// 1. Pre-wake + overlapping actives: the next chapter's card un-dims
//    200–250ms BEFORE its chapter starts (and the conversation card
//    brightens while the cursor is still gliding toward it), while the
//    previous card STAYS active until its task visibly settles — focus
//    never leaves a card mid-animation, and the eye is led, never hunting.
// 2. Longer easing on state changes: card dim/undim 500ms, shortlist and
//    compliance row highlights ease in/out over 400–500ms, RFQ fields
//    settle over 300ms — state changes read as transitions, not toggles.
// 3. Shortlist outro extended ~350ms: the row highlight releases slowly
//    *after* the RFQ chapter has already begun, instead of cutting off.
// 4. Supplier reply gains a Delivered → Seen receipt ladder.
// 4b. Compliance chapter has a real payoff: the cursor CLICKS the alert
//     row and a certificate-alert popover opens (hairline/mono language,
//     restrained green), easing away before the cursor departs for MSA.
// 5. Staggered loop reset: the shortlist starts returning to idle while
//    the MSA download is still being clicked, then RFQ, then the
//    conversation, then everything else — the restart point is hidden
//    inside the finale instead of being one detectable global reset.
//
// Event-driven, not timeline-scrubbed: a master clock emits discrete event
// marks (~40 per loop) and every visual change is a CSS/motion transition
// between marks, so React never re-renders at frame rate. Honours
// prefers-reduced-motion by rendering the settled end state.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import {
  Bell,
  BookmarkSimple,
  CaretRight,
  ChatCircleText,
  Check,
  CheckCircle,
  DownloadSimple,
  FileText,
  Paperclip,
  PaperPlaneTilt,
  ShieldCheck,
} from "@phosphor-icons/react";

import { SectionHeader } from "@/components/marketing/home/section-header";
import { cn } from "@/lib/utils";

/* ─── Master clock ─────────────────────────────────────────────── */

const LOOP_MS = 22_000;

/**
 * Every state change in the loop, in ms from loop start.
 * Chapters are strictly sequential: each card's last animation settles,
 * then a ~1s dwell, THEN the cursor departs for the next card.
 */
const T = {
  // Step 1 · Follow supplier (0.1–2.1s) — teach that the section moves.
  cursorIn1: 120,
  bookmarkHover: 700,
  bookmarkClick: 900,
  bookmarkRelease: 1100,
  followLabel: 1250,
  // Row highlight releases (500ms ease → settled ~2.1s). Chapter 1 is
  // fully settled before the dwell; the cursor departs at 3.1s.
  rowFade: 1600,
  // Step 2 · Compose RFQ (3.1–6.5s) — pre-wakes 200ms before the cursor
  // departs; cursor glide 0.7s lands at 3.8s.
  wakeRfq: 2900,
  cursorIn2: 3100,
  fillProduct: 3900,
  fillQuantity: 4020,
  fillDate: 4140,
  fillCountry: 4260,
  sendHover: 4800,
  sendClick: 5100,
  // Causal chain: press → RELEASE flips the button to "Sending…" → beat →
  // panel wakes → success (settled ~6.5s, dwell, depart 7.5s).
  sendRelease: 5300,
  panelWake: 5600,
  sendDone: 6200,
  // Step 3 · Handoff (7.5–8.2s) — the CURSOR itself glides card 2 →
  // card 3 (same arrow, never hidden); it is the only moving object.
  handoffStart: 7500,
  handoffEnd: 8200,
  // Step 4 · Conversation (8.25–11.8s) — begins as the cursor lands.
  unreadBadge: 8250,
  msgReceived: 8450,
  typingStart: 9100,
  typingEnd: 9850,
  // Receipt ladder on the supplier reply: Delivered → Seen.
  msgDelivered: 10000,
  attachment: 10200,
  msgSeen: 10500,
  badgeClear: 10600,
  // Buyer drafts a reply; the draft settles at ~11.8s, dwell, depart 12.8s.
  draft1: 10700,
  draft2: 11000,
  draft3: 11300,
  draft4: 11600,
  // Step 5 · Compliance (12.8–15.4s) — pre-wake, then cursor glide lands
  // at 13.5s.
  wakeComp: 12550,
  cursorComp: 12800,
  compHighlight: 13550,
  // Click on the alert row → a certificate-alert popover opens (the
  // chapter's payoff — hovering alone read as "nothing happened").
  compClick: 13750,
  compRelease: 13900,
  compUpdate: 13950,
  compDot: 14200,
  // Temporary gray/border emphasis relaxes back to the quiet lit state.
  compEase: 14450,
  compShield: 14550,
  // Popover eases away; chapter settles at ~15.4s, dwell, depart 16.4s.
  compPopClose: 15100,
  compSettle: 15400,
  // Step 6 · Generate MSA (16.4–19.3s) — cursor glide lands at 17.1s.
  wakeMsa: 16150,
  cursorMsa: 16400,
  msaGenerating: 17150,
  msaLine1: 17300,
  msaFeat1: 17400,
  msaLine2: 17550,
  msaFeat2: 17650,
  msaLine3: 17800,
  msaFeat3: 17900,
  msaFeat4: 18050,
  // Believable state ladder: Generating → Preparing → Ready → enabled.
  msaPreparing: 18200,
  msaReady: 18500,
  msaDownload: 18700,
  msaHover: 18800,
  msaClick: 19000,
  msaRelease: 19130,
  // Staggered loop reset after a final dwell — cards return to idle one
  // at a time so no single global "restart" frame exists: shortlist →
  // RFQ → conversation → compliance/MSA/cursor.
  resetFollow: 20400,
  resetRfq: 20600,
  resetConvo: 20800,
  resetStart: 21000,
} as const;

const EVENT_TIMES = [...new Set(Object.values(T))].sort((a, b) => a - b);

/**
 * Returns the timestamp of the last event that has fired (-1 before the
 * first). State only updates when an event boundary is crossed, so the
 * section re-renders ~45 times per 22s loop, never per frame.
 */
function useWorkflowClock(active: boolean, reduce: boolean) {
  const [mark, setMark] = useState<number>(reduce ? Number.MAX_SAFE_INTEGER : -1);

  useEffect(() => {
    if (reduce) {
      setMark(Number.MAX_SAFE_INTEGER);
      return;
    }
    if (!active) {
      setMark(-1);
      return;
    }
    let raf = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - started) % LOOP_MS;
      let current = -1;
      for (const t of EVENT_TIMES) {
        if (elapsed >= t) current = t;
        else break;
      }
      setMark((prev) => (prev === current ? prev : current));
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [active, reduce]);

  return mark;
}

/* ─── Demo data (illustrative, matches the approved mockup) ────── */

const SUPPLIERS = [
  {
    name: "SM Sourcing Ltd.",
    mono: "SM",
    location: "Dhaka, Bangladesh",
    category: "Knitwear",
    confidence: 92,
  },
  {
    name: "ABC Textile Mills",
    mono: "AB",
    location: "Narayanganj, Bangladesh",
    category: "Woven Fabric",
    confidence: 88,
  },
  {
    name: "Texline Apparels",
    mono: "TX",
    location: "Gazipur, Bangladesh",
    category: "Apparel",
    confidence: 85,
  },
] as const;

const CERTIFICATES = [
  {
    name: "GOTS Certification",
    supplier: "SM Sourcing Ltd.",
    daysBefore: "32",
    daysAfter: "30",
  },
  {
    name: "ISO 9001:2015",
    supplier: "ABC Textile Mills",
    daysBefore: "45",
    daysAfter: "45",
  },
  {
    name: "OEKO-TEX® Standard 100",
    supplier: "Texline Apparels",
    daysBefore: "60",
    daysAfter: "60",
  },
] as const;

const MSA_FEATURES = [
  "Auto-populate from verified data",
  "Customizable templates",
  "Download in one click",
  "Audit-ready format",
] as const;

const DRAFT_REPLY = "Thanks — reviewing the quotation now.";

/* ─── Shared primitives ────────────────────────────────────────── */

const CURSOR_EASE = [0.3, 0.1, 0.25, 1] as const;

/** Tiny always-breathing status dot (opacity 70→100→70 / scale 1→1.08). */
function AmbientDot({
  className,
  mode = "pulse",
  reduce,
}: {
  className?: string;
  mode?: "pulse" | "breathe";
  reduce: boolean;
}) {
  return (
    <motion.span
      className={cn("block rounded-full bg-brand-forest", className)}
      animate={
        reduce
          ? undefined
          : mode === "breathe"
            ? { scale: [1, 1.08, 1] }
            : { opacity: [0.7, 1, 0.7] }
      }
      transition={
        reduce
          ? undefined
          : {
              duration: mode === "breathe" ? 4 : 3,
              repeat: Infinity,
              ease: "easeInOut",
            }
      }
      aria-hidden
    />
  );
}

/**
 * Near-invisible ambient life for settled elements (opacity 0.78→1→0.78,
 * 3.4s). Keeps completed cards from looking frozen without drawing the eye.
 */
function AmbientPulse({
  active,
  reduce,
  className,
  children,
}: {
  active: boolean;
  reduce: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <motion.span
      className={cn("inline-flex items-center", className)}
      animate={active && !reduce ? { opacity: [0.78, 1, 0.78] } : { opacity: 1 }}
      transition={
        active && !reduce
          ? { duration: 3.4, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0.2 }
      }
      aria-hidden
    >
      {children}
    </motion.span>
  );
}

/** Confidence score in a quiet ring; the arc drifts one turn per 120s. */
function ConfidenceRing({
  score,
  ripple,
  reduce,
}: {
  score: number;
  ripple: boolean;
  reduce: boolean;
}) {
  const pct = score / 100;
  return (
    <span className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full">
      <motion.svg
        viewBox="0 0 32 32"
        className="absolute inset-0 size-full"
        animate={reduce ? undefined : { rotate: 360 }}
        transition={
          reduce ? undefined : { duration: 120, repeat: Infinity, ease: "linear" }
        }
        aria-hidden
      >
        <circle
          cx="16"
          cy="16"
          r="14"
          fill="none"
          stroke="#e5e5e5"
          strokeWidth="2"
        />
        <circle
          cx="16"
          cy="16"
          r="14"
          fill="none"
          pathLength="1"
          stroke="#262626"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${pct} ${1 - pct}`}
          transform="rotate(-90 16 16)"
        />
      </motion.svg>
      {ripple && !reduce ? (
        <motion.span
          className="absolute inset-[3px] rounded-full border border-brand-forest"
          initial={{ scale: 0.35, opacity: 0.55 }}
          animate={{ scale: 1, opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          aria-hidden
        />
      ) : null}
      <span className="relative text-[10px] font-semibold tabular-nums text-neutral-800">
        {score}
      </span>
    </span>
  );
}

/** 23 → 24 odometer roll, 500ms, no layout shift. */
function RollingCount({ bumped }: { bumped: boolean }) {
  return (
    <span className="inline-flex h-[1.3em] flex-col overflow-hidden align-bottom leading-[1.3em]">
      <span
        className={cn(
          "flex flex-col transition-transform duration-500 [transition-timing-function:cubic-bezier(0.3,0.1,0.25,1)]",
          bumped && "-translate-y-1/2",
        )}
      >
        <span className="h-[1.3em] tabular-nums">23</span>
        <span className="h-[1.3em] tabular-nums">24</span>
      </span>
    </span>
  );
}

function CardShell({
  step,
  icon,
  title,
  body,
  active = false,
  dimmed = false,
  children,
  className,
}: {
  step: string;
  icon: ReactNode;
  title: string;
  body: string;
  /** Quiet focus state while this card's chapter of the story is running. */
  active?: boolean;
  /** Softly recedes when another card owns the story — guides the eye. */
  dimmed?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "relative flex flex-col rounded-card border bg-white p-4 shadow-[0_1px_2px_rgba(15,15,20,0.03),0_8px_20px_-16px_rgba(15,15,20,0.10)] transition-[border-color,opacity] duration-500 ease-in-out sm:p-5 xl:p-6",
        active ? "border-neutral-300" : "border-neutral-200/80",
        dimmed && "opacity-[0.58]",
        className,
      )}
    >
      <header className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-[10px] border bg-white transition-colors duration-300",
            active
              ? "border-neutral-500 text-neutral-900"
              : "border-neutral-200 text-neutral-500",
          )}
          aria-hidden
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-bold leading-snug tracking-tight text-neutral-900">
            {step}. {title}
          </h3>
          <p className="mt-1 text-[12.5px] leading-snug text-neutral-500">
            {body}
          </p>
        </div>
      </header>
      <div className="mt-5 flex min-h-0 flex-1 flex-col">{children}</div>
    </article>
  );
}

/* ─── Shared cursor — the continuous attention thread ──────────── */

type CursorTargets = {
  bookmark: RefObject<HTMLSpanElement | null>;
  form: RefObject<HTMLDivElement | null>;
  send: RefObject<HTMLSpanElement | null>;
  convo: RefObject<HTMLDivElement | null>;
  compliance: RefObject<HTMLLIElement | null>;
  download: RefObject<HTMLSpanElement | null>;
};

const CLICK_MARKS = [
  T.bookmarkClick,
  T.sendClick,
  T.compClick,
  T.msaClick,
] as const;

function SharedCursor({
  mark,
  reduce,
  gridRef,
  targets,
}: {
  mark: number;
  reduce: boolean;
  gridRef: RefObject<HTMLDivElement | null>;
  targets: CursorTargets;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  // Visible for the whole story — the arrow never hides or changes shape;
  // during the RFQ handoff it glides card 2 → card 3 as the single
  // moving object.
  const visible = !reduce && mark >= T.cursorIn1 && mark < T.resetStart;
  const pressed =
    !reduce &&
    ((mark >= T.bookmarkClick && mark < T.bookmarkRelease) ||
      (mark >= T.sendClick && mark < T.sendRelease) ||
      (mark >= T.compClick && mark < T.compRelease) ||
      (mark >= T.msaClick && mark < T.msaRelease));

  useEffect(() => {
    if (reduce) return;
    const grid = gridRef.current;
    if (!grid) return;
    const g = grid.getBoundingClientRect();
    const at = (
      el: Element | null,
      fx: number,
      fy: number,
    ): { x: number; y: number } | null => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: r.left - g.left + r.width * fx,
        y: r.top - g.top + r.height * fy,
      };
    };
    let next: { x: number; y: number } | null = null;
    if (mark >= T.cursorMsa) {
      next = at(targets.download.current, 0.55, 0.55);
    } else if (mark >= T.cursorComp) {
      next = at(targets.compliance.current, 0.72, 0.55);
    } else if (mark >= T.handoffStart) {
      next = at(targets.convo.current, 0.55, 0.7);
    } else if (mark >= T.sendHover) {
      next = at(targets.send.current, 0.55, 0.55);
    } else if (mark >= T.cursorIn2) {
      next = at(targets.form.current, 0.44, 0.34);
    } else if (mark >= T.cursorIn1) {
      next = at(targets.bookmark.current, 0.55, 0.55);
    } else {
      next = at(targets.bookmark.current, 1.6, 2.6);
    }
    if (next) {
      const committed = next;
      setPos((prev) =>
        prev && prev.x === committed.x && prev.y === committed.y
          ? prev
          : committed,
      );
    }
  }, [mark, reduce, gridRef, targets]);

  if (reduce || !pos) return null;

  const click = CLICK_MARKS.find((c) => mark >= c && mark < c + 560);

  return (
    <motion.span
      className="pointer-events-none absolute left-0 top-0 z-30"
      initial={false}
      animate={{
        x: pos.x,
        y: pos.y,
        opacity: visible ? 1 : 0,
        scale: pressed ? 0.88 : 1,
      }}
      transition={{
        // While hidden the cursor teleports (loop reset return trip);
        // gliding only happens where the viewer can see it.
        x: { duration: visible ? 0.7 : 0, ease: CURSOR_EASE },
        y: { duration: visible ? 0.7 : 0, ease: CURSOR_EASE },
        opacity: { duration: 0.2, ease: "linear" },
        scale: { duration: 0.12, ease: "linear" },
      }}
      aria-hidden
    >
      {click ? (
        <motion.span
          key={click}
          className="absolute left-[3px] top-[2px] size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-neutral-400"
          initial={{ scale: 0.3, opacity: 0.5 }}
          animate={{ scale: 1.15, opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      ) : null}
      <svg width="16" height="16" viewBox="0 0 24 24" className="drop-shadow-sm">
        <path
          d="M5.2 2.8 L19.4 11.6 L12.4 13.1 L8.9 19.8 Z"
          fill="#171717"
          stroke="#FFFFFF"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    </motion.span>
  );
}

/* ─── Card 1 · Follow suppliers ────────────────────────────────── */

function FollowSuppliersCard({
  mark,
  reduce,
  on,
  active,
  dimmed,
  bookmarkRef,
}: {
  mark: number;
  reduce: boolean;
  on: (ts: number) => boolean;
  active: boolean;
  dimmed: boolean;
  bookmarkRef: RefObject<HTMLSpanElement | null>;
}) {
  const followed = on(T.bookmarkClick);
  const hovering =
    !reduce && mark >= T.bookmarkHover && mark < T.bookmarkClick;
  // Extended outro: the highlight holds through the toast settle, then
  // releases through a slow 500ms ease — fully settled before the dwell
  // and the cursor's departure for the RFQ card.
  const rowLit = !reduce && mark >= T.bookmarkClick && mark < T.rowFade;

  return (
    <CardShell
      step="1"
      icon={<BookmarkSimple size={17} weight="regular" />}
      title="Follow suppliers to your shortlist"
      body="Save and organize verified suppliers for quick access and comparison."
      active={active}
      dimmed={dimmed}
    >
      <div
        className="relative flex flex-1 flex-col rounded-[12px] border border-neutral-200 bg-white"
        aria-hidden
      >
        <div className="flex items-center justify-between gap-2 border-b border-neutral-200 px-3 py-2">
          <p className="font-display text-[12.5px] font-semibold text-neutral-900">
            Your Shortlist
          </p>
          <span
            className={cn(
              "rounded-pill border px-2 py-0.5 text-[11px] font-medium transition-all duration-300",
              followed
                ? "border-neutral-400 bg-white text-neutral-900"
                : "border-neutral-200 bg-neutral-50 text-neutral-600",
            )}
          >
            <RollingCount bumped={followed} /> suppliers
          </span>
        </div>

        <div className="hidden grid-cols-[26px_minmax(0,1.4fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_4.75rem] items-center gap-2 border-b border-neutral-200 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-neutral-400 sm:grid">
          <span />
          <span>Supplier</span>
          <span>Location</span>
          <span>Category</span>
          <span className="text-right leading-none">Confidence</span>
        </div>

        <ul className="flex flex-1 flex-col">
          {SUPPLIERS.map((supplier, index) => {
            const isTarget = index === 0;
            return (
              <li
                key={supplier.name}
                className={cn(
                  "grid grid-cols-[26px_minmax(0,1fr)_44px] items-center gap-2 border-b border-neutral-100 px-3 py-2 transition-all duration-500 ease-in-out sm:grid-cols-[26px_minmax(0,1.4fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_4.75rem]",
                  isTarget && (hovering || rowLit) && "bg-neutral-100",
                  !isTarget && rowLit && "opacity-50",
                )}
              >
                <span
                  ref={isTarget ? bookmarkRef : undefined}
                  className={cn(
                    "relative flex size-6 items-center justify-center transition-transform duration-150",
                    isTarget && hovering && "scale-110",
                  )}
                >
                  {/* One-shot confirmation ripple at the click — makes the
                      first interaction impossible to miss, no extra green. */}
                  {isTarget && followed && !reduce && mark < T.cursorIn2 ? (
                    <motion.span
                      className="absolute inset-0 rounded-full border border-neutral-400"
                      initial={{ scale: 0.4, opacity: 0.6 }}
                      animate={{ scale: 1.55, opacity: 0 }}
                      transition={{ duration: 0.55, ease: "easeOut" }}
                      aria-hidden
                    />
                  ) : null}
                  <BookmarkSimple
                    size={15}
                    weight="regular"
                    className={cn(
                      "absolute text-neutral-400 transition-opacity duration-150",
                      isTarget && followed && "opacity-0",
                    )}
                  />
                  {isTarget ? (
                    <BookmarkSimple
                      size={15}
                      weight="fill"
                      className={cn(
                        "absolute text-brand-forest transition-opacity duration-150",
                        followed ? "opacity-100" : "opacity-0",
                      )}
                    />
                  ) : null}
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-[5px] border border-neutral-200 bg-neutral-50 font-mono text-[8.5px] font-semibold text-neutral-600">
                    {supplier.mono}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-semibold text-neutral-800">
                      {supplier.name}
                    </span>
                    <span className="block truncate text-[10.5px] text-neutral-500 sm:hidden">
                      {supplier.location}
                    </span>
                  </span>
                </span>
                <span className="hidden truncate text-[11.5px] text-neutral-500 sm:block">
                  {supplier.location}
                </span>
                <span className="hidden truncate text-[11.5px] text-neutral-500 sm:block">
                  {supplier.category}
                </span>
                <span className="flex justify-end">
                  <ConfidenceRing
                    score={supplier.confidence}
                    ripple={isTarget && rowLit}
                    reduce={reduce}
                  />
                </span>
              </li>
            );
          })}
        </ul>

        <div className="mt-auto flex items-center justify-between gap-2 px-3 py-2">
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-pill border px-2 py-0.5 text-[11.5px] font-medium transition-all duration-300",
              on(T.followLabel)
                ? "translate-y-0 border-neutral-200 bg-neutral-50 text-neutral-800 opacity-100"
                : "translate-y-1 border-transparent opacity-0",
            )}
          >
            <AmbientPulse active={on(T.followLabel)} reduce={reduce}>
              <CheckCircle
                size={13}
                weight="fill"
                className="text-brand-forest"
              />
            </AmbientPulse>
            Added to shortlist
          </span>
          <span className="flex items-center gap-0.5 text-[11.5px] font-medium text-neutral-500">
            View shortlist
            <CaretRight size={11} weight="bold" />
          </span>
        </div>
      </div>
    </CardShell>
  );
}

/* ─── Card 2 · Compose RFQ ─────────────────────────────────────── */

function RfqField({
  label,
  value,
  placeholder,
  filled,
}: {
  label: string;
  value: string;
  placeholder: string;
  filled: boolean;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[10.5px] font-medium text-neutral-500">{label}</span>
      <span className="relative flex h-[26px] items-center overflow-hidden rounded-input border border-neutral-200 bg-white px-2">
        <span
          className={cn(
            "absolute truncate text-[11.5px] text-neutral-400 transition-opacity duration-300 ease-out",
            filled && "opacity-0",
          )}
        >
          {placeholder}
        </span>
        <span
          className={cn(
            "truncate text-[11.5px] font-medium text-neutral-800 transition-all duration-300 ease-out",
            filled ? "translate-y-0 opacity-100" : "translate-y-0.5 opacity-0",
          )}
        >
          {value}
        </span>
      </span>
    </label>
  );
}

function ComposeRfqCard({
  mark,
  reduce,
  on,
  active,
  dimmed,
  formRef,
  sendButtonRef,
}: {
  mark: number;
  reduce: boolean;
  on: (ts: number) => boolean;
  active: boolean;
  dimmed: boolean;
  formRef: RefObject<HTMLDivElement | null>;
  sendButtonRef: RefObject<HTMLSpanElement | null>;
}) {
  // The label flips on press RELEASE, never at press-down — the click
  // must read as complete before the button responds to it.
  const sending = !reduce && mark >= T.sendRelease && mark < T.sendDone;
  const sent = on(T.sendDone);
  const hovering = !reduce && mark >= T.sendHover && mark < T.sendRelease;
  // Outcome is a consequence of Send — the button holds "Sending…" alone
  // for a beat before the panel wakes, so the panel reads as caused by it.
  const panelLive = reduce || on(T.panelWake);

  return (
    <CardShell
      step="2"
      icon={<PaperPlaneTilt size={17} weight="regular" />}
      title="Compose & send RFQ"
      body="Create professional RFQs in minutes and reach shortlisted suppliers."
      active={active}
      dimmed={dimmed}
    >
      <div
        className="relative grid flex-1 gap-3 min-[560px]:grid-cols-[1.3fr_1fr]"
        aria-hidden
      >
        <div
          ref={formRef}
          className={cn(
            "flex flex-col rounded-[12px] border bg-white p-3 transition-colors duration-300",
            sending || sent ? "border-neutral-300" : "border-neutral-200",
          )}
        >
          <p className="font-display text-[12.5px] font-semibold text-neutral-900">
            New RFQ
          </p>
          <div className="mt-2 flex flex-col gap-1.5">
            <RfqField
              label="Product"
              value="Men's heavyweight French terry hoodies"
              placeholder="What are you sourcing?"
              filled={on(T.fillProduct)}
            />
            <div className="grid grid-cols-2 gap-1.5">
              <RfqField
                label="Quantity"
                value="12,000"
                placeholder="0"
                filled={on(T.fillQuantity)}
              />
              <RfqField
                label="Unit"
                value="pcs"
                placeholder="Select"
                filled={on(T.fillQuantity)}
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <RfqField
                label="Delivery date"
                value="30 Oct 2026"
                placeholder="Select date"
                filled={on(T.fillDate)}
              />
              <RfqField
                label="Destination"
                value="United Kingdom"
                placeholder="Select country"
                filled={on(T.fillCountry)}
              />
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[10.5px] text-neutral-500">
            <span>+ Add more details</span>
            <span className="flex items-center gap-1 rounded-pill border border-neutral-200 bg-neutral-50 px-1.5 py-0.5">
              <Paperclip size={10} weight="bold" />2 attachments
            </span>
          </div>
          <div className="mt-auto flex items-center justify-end gap-2 pt-3">
            <span className="rounded-pill border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700">
              Save draft
            </span>
            <span
              ref={sendButtonRef}
              className={cn(
                "flex min-w-[86px] items-center justify-center gap-1 rounded-pill border px-2.5 py-1 text-[11px] font-semibold transition-colors duration-200",
                sending
                  ? "border-transparent bg-brand-forest text-white"
                  : sent
                    ? "border-neutral-200 bg-white text-neutral-800"
                    : hovering
                      ? "border-neutral-300 bg-neutral-100 text-neutral-800"
                      : "border-neutral-300 bg-white text-neutral-800",
              )}
            >
              {sent ? (
                <>
                  <Check size={11} weight="bold" className="text-brand-forest" />
                  Sent
                </>
              ) : sending ? (
                "Sending..."
              ) : (
                <>
                  Send RFQ
                  <PaperPlaneTilt size={11} weight="fill" />
                </>
              )}
            </span>
          </div>
        </div>

        {/* Result of Send — empty recipients until click, then lives. */}
        <div
          className={cn(
            "relative flex flex-col items-center justify-center gap-2 overflow-hidden rounded-[12px] border p-3 text-center transition-all duration-300",
            panelLive
              ? "border-neutral-300 bg-white"
              : "border-dashed border-neutral-200 bg-neutral-50/80",
          )}
        >
          {/* Pre-send: quiet recipient roster — not a success panel. */}
          <div
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 transition-opacity duration-200",
              panelLive ? "pointer-events-none opacity-0" : "opacity-100",
            )}
          >
            <p className="text-[11px] font-medium text-neutral-500">
              Recipients
            </p>
            <span className="flex items-center gap-1">
              {["SM", "AB", "TX", "+1"].map((chip) => (
                <span
                  key={chip}
                  className="flex size-5 items-center justify-center rounded-full border border-neutral-200 bg-white font-mono text-[8px] font-semibold text-neutral-500"
                >
                  {chip}
                </span>
              ))}
            </span>
            <p className="text-[10.5px] text-neutral-400">
              Waiting for Send RFQ
            </p>
          </div>

          {/* Post-send: the consequence of the button press. */}
          <div
            className={cn(
              "flex flex-col items-center justify-center gap-2 transition-opacity duration-300",
              panelLive ? "opacity-100" : "opacity-0",
            )}
          >
            <span className="relative flex size-9 items-center justify-center">
              <span
                className={cn(
                  "absolute inset-0 rounded-full border transition-colors duration-300",
                  sent
                    ? "border-brand-forest/30"
                    : sending
                      ? "border-neutral-300"
                      : "border-neutral-200",
                )}
              />
              {sent && !reduce ? (
                <motion.span
                  className="absolute inset-0 rounded-full border border-brand-forest"
                  initial={{ scale: 0.7, opacity: 0.45 }}
                  animate={{ scale: 1.25, opacity: 0 }}
                  transition={{ duration: 0.65, ease: "easeOut" }}
                />
              ) : null}
              {sending && !sent ? (
                <span className="size-2 animate-pulse rounded-full bg-brand-forest" />
              ) : (
                <AmbientPulse active={sent} reduce={reduce}>
                  <Check
                    size={16}
                    weight="bold"
                    className={cn(
                      "transition-colors duration-300",
                      sent ? "text-brand-forest" : "text-neutral-300",
                    )}
                  />
                </AmbientPulse>
              )}
            </span>
            <span className="relative block h-[1.4em] w-full overflow-hidden">
              <span
                className={cn(
                  "absolute inset-x-0 text-[12px] font-semibold text-neutral-700 transition-opacity duration-300 ease-in-out",
                  sent && "opacity-0",
                )}
              >
                Sending to suppliers...
              </span>
              <span
                className={cn(
                  "absolute inset-x-0 text-[12px] font-semibold text-neutral-900 transition-opacity duration-300 ease-in-out",
                  sent ? "opacity-100" : "opacity-0",
                )}
              >
                RFQ sent successfully!
              </span>
            </span>
            <span className="text-[11px] text-neutral-500">
              {sent ? "4 suppliers notified" : "Notifying shortlist…"}
            </span>
            <span className="flex items-center gap-1">
              {["SM", "AB", "TX", "+1"].map((chip) => (
                <span
                  key={chip}
                  className="flex size-5 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 font-mono text-[8px] font-semibold text-neutral-600"
                >
                  {chip}
                </span>
              ))}
            </span>
            <span
              className={cn(
                "text-[10.5px] leading-snug text-neutral-500 transition-opacity duration-300",
                sent ? "opacity-100" : "opacity-0",
              )}
            >
              They will respond soon.
              <br />
              We&apos;ll notify you when they do.
            </span>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

/* ─── Card 3 · Conversations ───────────────────────────────────── */

function ConversationsCard({
  mark,
  reduce,
  on,
  active,
  dimmed,
  convoCursorRef,
}: {
  mark: number;
  reduce: boolean;
  on: (ts: number) => boolean;
  active: boolean;
  dimmed: boolean;
  convoCursorRef: RefObject<HTMLDivElement | null>;
}) {
  const badgeShown =
    !reduce && mark >= T.unreadBadge && mark < T.badgeClear;
  const typing = !reduce && mark >= T.typingStart && mark < T.typingEnd;
  // Receipt ladder: reply lands → Delivered → Seen.
  const delivered = on(T.msgDelivered);
  const seen = on(T.msgSeen);

  const draftText = on(T.draft4)
    ? DRAFT_REPLY
    : on(T.draft3)
      ? DRAFT_REPLY.slice(0, 30)
      : on(T.draft2)
        ? DRAFT_REPLY.slice(0, 18)
          : on(T.draft1)
          ? DRAFT_REPLY.slice(0, 9)
          : "";
  const drafting = !reduce && mark >= T.draft1 && mark < T.resetConvo;

  return (
    <CardShell
      step="3"
      icon={<ChatCircleText size={17} weight="regular" />}
      title="Manage supplier conversations"
      body="Keep all communication in one place and never miss an update."
      active={active}
      dimmed={dimmed}
    >
      <div
        className="grid h-full min-h-[220px] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[12px] border border-neutral-200 bg-white"
        aria-hidden
      >
        <div className="flex items-center gap-2 border-b border-neutral-200 px-2.5 py-2">
          <span className="relative flex size-6 shrink-0 items-center justify-center rounded-[6px] border border-neutral-200 bg-neutral-50 font-mono text-[9px] font-semibold text-neutral-600">
            SM
            <span
              className={cn(
                "absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-brand-forest text-[8px] font-semibold leading-none text-white transition-opacity duration-200",
                badgeShown ? "opacity-100" : "opacity-0",
              )}
            >
              1
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-semibold text-neutral-800">
              SM Sourcing Ltd.
            </span>
            {/* Fixed-width status so "Online" ↔ "typing..." never reflows. */}
            <span className="relative mt-0.5 flex h-[14px] items-center gap-1 text-[10px] text-neutral-500">
              <AmbientDot className="size-1.5" mode="breathe" reduce={reduce} />
              <span className="relative inline-block w-[4.5rem]">
                <span
                  className={cn(
                    "absolute inset-0 transition-opacity duration-200",
                    typing ? "opacity-0" : "opacity-100",
                  )}
                >
                  Online
                </span>
                <span
                  className={cn(
                    "absolute inset-0 transition-opacity duration-200",
                    typing ? "opacity-100" : "opacity-0",
                  )}
                >
                  typing...
                </span>
              </span>
            </span>
          </span>
          <span className="relative h-[22px] w-[58px] shrink-0">
            <span
              className={cn(
                "absolute inset-0 flex items-center justify-center rounded-pill border border-neutral-200 bg-neutral-50 text-[9.5px] font-medium text-neutral-600 transition-opacity duration-200",
                on(T.unreadBadge) && !seen ? "opacity-100" : "opacity-0",
              )}
            >
              New RFQ
            </span>
          </span>
        </div>

        {/* Slots always reserve final height — only opacity changes (no layout). */}
        <div className="flex min-h-0 flex-col justify-start gap-1.5 overflow-hidden px-2.5 py-2">
          <div
            className={cn(
              "max-w-[88%] rounded-[10px] rounded-bl-[3px] border border-neutral-200 bg-neutral-50 px-2 py-1.5 transition-opacity duration-200",
              on(T.msgReceived) ? "opacity-100" : "opacity-0",
            )}
          >
            <p className="text-[11px] leading-snug text-neutral-800">
              Hello, we received your RFQ.
            </p>
            <p className="mt-0.5 font-mono text-[8.5px] text-neutral-400">
              10:24 AM
            </p>
          </div>

          <div
            ref={convoCursorRef}
            className={cn(
              "relative max-w-[88%] rounded-[10px] rounded-bl-[3px] border border-neutral-200 bg-neutral-50 px-2 py-1.5 transition-opacity duration-200",
              on(T.typingStart) ? "opacity-100" : "opacity-0",
            )}
          >
            {/* Invisible final copy keeps the bubble height stable. */}
            <p
              className="invisible text-[11px] leading-snug"
              aria-hidden
            >
              Estimated lead time is 35 days.
            </p>
            <p
              className="invisible mt-0.5 font-mono text-[8.5px]"
              aria-hidden
            >
              10:25 AM · Delivered
            </p>
            <span
              className={cn(
                "absolute inset-0 flex items-center gap-1 px-2 transition-opacity duration-150",
                typing ? "opacity-100" : "opacity-0",
              )}
              aria-hidden
            >
              <span className="size-1 animate-pulse rounded-full bg-neutral-400" />
              <span className="size-1 animate-pulse rounded-full bg-neutral-400 [animation-delay:120ms]" />
              <span className="size-1 animate-pulse rounded-full bg-neutral-400 [animation-delay:240ms]" />
            </span>
            <div
              className={cn(
                "absolute inset-0 px-2 py-1.5 transition-opacity duration-200",
                on(T.typingEnd) && !typing ? "opacity-100" : "opacity-0",
              )}
            >
              <p className="text-[11px] leading-snug text-neutral-800">
                Estimated lead time is 35 days.
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[8.5px] text-neutral-400">
                <span>10:25 AM</span>
                {/* Delivered → Seen cross-fade; width reserved so the
                    timestamp line never reflows. */}
                <span className="relative inline-block">
                  <span className="invisible">· Delivered</span>
                  <span
                    className={cn(
                      "absolute inset-0 transition-opacity duration-300 ease-in-out",
                      delivered && !seen ? "opacity-100" : "opacity-0",
                    )}
                  >
                    · Delivered
                  </span>
                  <span
                    className={cn(
                      "absolute inset-0 transition-opacity duration-300 ease-in-out",
                      seen ? "opacity-100" : "opacity-0",
                    )}
                  >
                    · Seen
                  </span>
                </span>
              </p>
            </div>
          </div>

          <div
            className={cn(
              "flex max-w-[88%] items-center gap-1.5 rounded-[10px] border border-neutral-200 bg-white px-2 py-1.5 transition-opacity duration-200",
              on(T.attachment) ? "opacity-100" : "opacity-0",
            )}
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-[5px] border border-neutral-200 bg-neutral-50 text-neutral-600">
              <FileText size={11} weight="regular" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10.5px] font-semibold text-neutral-800">
                Quotation.pdf
              </span>
              <span className="block font-mono text-[8.5px] text-neutral-400">
                PDF · 245 KB · just now
              </span>
            </span>
          </div>
        </div>

        <div className="flex h-[36px] items-center gap-1.5 border-t border-neutral-200 px-2.5">
          <span className="min-w-0 flex-1 truncate text-[10.5px]">
            {draftText || reduce ? (
              <span className="text-neutral-800">
                {reduce ? DRAFT_REPLY : draftText}
                {/* Caret keeps blinking after the draft settles — quiet
                    proof the thread is still alive. */}
                {drafting ? (
                  <span className="ml-px inline-block h-[1em] w-px animate-pulse bg-neutral-400 align-middle" />
                ) : null}
              </span>
            ) : (
              <span className="text-neutral-400">Type a message...</span>
            )}
          </span>
          <PaperPlaneTilt
            size={12}
            weight="fill"
            className={cn(
              "shrink-0 transition-colors duration-300",
              draftText || reduce ? "text-brand-forest" : "text-neutral-300",
            )}
          />
        </div>
      </div>
    </CardShell>
  );
}

/* ─── Card 4 · Compliance ──────────────────────────────────────── */

function ComplianceCard({
  mark,
  reduce,
  on,
  active,
  dimmed,
  complianceRef,
}: {
  mark: number;
  reduce: boolean;
  on: (ts: number) => boolean;
  active: boolean;
  dimmed: boolean;
  complianceRef: RefObject<HTMLLIElement | null>;
}) {
  // Hold hierarchy through settle so the eye knows which row mattered.
  const rowLit = !reduce && mark >= T.compHighlight && mark < T.cursorMsa;
  // Temporary stronger emphasis exactly while the row is being updated —
  // gray fill + firmer border only, then it relaxes to the quiet lit state.
  const rowEmph = !reduce && mark >= T.compHighlight && mark < T.compEase;
  const updated = on(T.compUpdate);
  // Clicking the alert row opens its detail popover — the consequence of
  // the click, easing away before the cursor departs for the MSA card.
  // Transient interaction, so it never shows in reduced motion.
  const popOpen = !reduce && mark >= T.compRelease && mark < T.compPopClose;

  return (
    <CardShell
      step="4"
      icon={
        <span className="relative flex items-center justify-center">
          <ShieldCheck size={17} weight="regular" />
          <span
            className={cn(
              "absolute -right-1.5 -top-1.5 flex size-3.5 items-center justify-center rounded-full bg-brand-forest text-white transition-all duration-200",
              on(T.compShield) ? "scale-100 opacity-100" : "scale-75 opacity-0",
            )}
          >
            <Check size={8} weight="bold" />
          </span>
        </span>
      }
      title="Monitor compliance & certificates"
      body="Get timely alerts for expiring certificates across your supply chain."
      active={active}
      dimmed={dimmed}
    >
      <ul className="flex flex-1 flex-col gap-1.5" aria-hidden>
        {CERTIFICATES.map((cert, index) => {
          const isTarget = index === 0;
          return (
            <li
              key={cert.name}
              ref={isTarget ? complianceRef : undefined}
              className={cn(
                "relative flex items-center gap-2 rounded-[10px] border bg-white px-2.5 py-2 transition-all duration-500 ease-in-out",
                isTarget && rowLit
                  ? rowEmph
                    ? "border-neutral-400 bg-neutral-100"
                    : "border-neutral-300 bg-neutral-50"
                  : "border-neutral-200",
                !isTarget && rowLit && "opacity-40",
                isTarget && popOpen && "z-10",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-[6px] border bg-neutral-50 transition-colors duration-300",
                  isTarget && rowLit
                    ? "border-neutral-300 text-neutral-900"
                    : "border-neutral-200 text-neutral-600",
                )}
              >
                <Bell size={12} weight={isTarget && rowLit ? "fill" : "regular"} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "truncate text-[11.5px] font-semibold",
                      isTarget && rowLit
                        ? "text-neutral-950"
                        : "text-neutral-800",
                    )}
                  >
                    {cert.name}
                  </span>
                  {isTarget ? (
                    <span
                      className={cn(
                        "transition-opacity duration-300",
                        on(T.compDot) ? "opacity-100" : "opacity-0",
                      )}
                    >
                      <AmbientDot className="size-1.5" reduce={reduce} />
                    </span>
                  ) : null}
                </span>
                <span className="block truncate text-[10px] text-neutral-500">
                  Expires in{" "}
                  {isTarget ? (
                    <span className="relative inline-block tabular-nums font-medium text-neutral-700">
                      <span
                        className={cn(
                          "transition-opacity duration-200",
                          updated && "opacity-0",
                        )}
                      >
                        {cert.daysBefore}
                      </span>
                      <span
                        className={cn(
                          "absolute inset-0 transition-opacity duration-200",
                          updated ? "opacity-100" : "opacity-0",
                        )}
                      >
                        {cert.daysAfter}
                      </span>
                    </span>
                  ) : (
                    cert.daysBefore
                  )}{" "}
                  days · {cert.supplier}
                </span>
              </span>
              <CaretRight size={11} weight="bold" className="shrink-0 text-neutral-300" />

              {/* Alert detail popover — the payoff of clicking the row.
                  Anchored below the row, same hairline/mono language as
                  the rest of the section; only opacity/transform animate. */}
              {isTarget ? (
                <div
                  className={cn(
                    "pointer-events-none absolute left-7 top-[calc(100%+6px)] z-20 w-[min(15.5rem,calc(100%-1.75rem))] rounded-[10px] border border-neutral-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,15,20,0.04),0_14px_28px_-18px_rgba(15,15,20,0.16)] transition-all duration-300 ease-out",
                    popOpen
                      ? "translate-y-0 opacity-100"
                      : "-translate-y-1 opacity-0",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[8.5px] uppercase tracking-[0.08em] text-neutral-400">
                      Certificate alert
                    </span>
                    <AmbientDot className="size-1.5" reduce={reduce} />
                  </span>
                  <span className="mt-1.5 block text-[11.5px] font-semibold text-neutral-900">
                    {cert.name}
                  </span>
                  <span className="block text-[10px] text-neutral-500">
                    {cert.supplier} · Dhaka, Bangladesh
                  </span>
                  <span className="mt-2 flex items-center gap-1.5 border-t border-neutral-100 pt-2 text-[10px] text-neutral-700">
                    <Bell size={10} weight="fill" className="text-neutral-500" />
                    Expires in{" "}
                    <span className="font-semibold tabular-nums">
                      {cert.daysAfter} days
                    </span>
                    — renewal window open
                  </span>
                  <span className="mt-1 flex items-center gap-1.5 text-[10px] text-neutral-700">
                    <Check size={10} weight="bold" className="text-brand-forest" />
                    Renewal reminder scheduled
                  </span>
                  <span className="mt-2 flex items-center gap-0.5 text-[10px] font-medium text-neutral-500">
                    View certificate
                    <CaretRight size={9} weight="bold" />
                  </span>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </CardShell>
  );
}

/* ─── Card 5 · MSA generator ───────────────────────────────────── */

function MsaGeneratorCard({
  mark,
  reduce,
  on,
  active,
  dimmed,
  downloadRef,
}: {
  mark: number;
  reduce: boolean;
  on: (ts: number) => boolean;
  active: boolean;
  dimmed: boolean;
  downloadRef: RefObject<HTMLSpanElement | null>;
}) {
  // Believable software ladder: Queued → Generating → Preparing → Ready →
  // Download enabled. Each stage is its own beat inside the same layout.
  const generating = !reduce && mark >= T.msaGenerating && mark < T.msaPreparing;
  const preparing = !reduce && mark >= T.msaPreparing && mark < T.msaReady;
  const busy = generating || preparing;
  const ready = on(T.msaReady);
  const enabled = reduce || on(T.msaDownload);
  const pressed = !reduce && mark >= T.msaClick && mark < T.msaRelease;
  const hovering = !reduce && mark >= T.msaHover && mark < T.msaClick;
  const lineOn = [on(T.msaLine1), on(T.msaLine2), on(T.msaLine3)];
  const lineWidths = [86, 70, 78];
  const featOn = [
    on(T.msaFeat1),
    on(T.msaFeat2),
    on(T.msaFeat3),
    on(T.msaFeat4),
  ];

  return (
    <CardShell
      step="5"
      icon={<FileText size={17} weight="regular" />}
      title="Generate compliance documents"
      body="Create audit-ready documents and MSA statements in a few clicks."
      active={active}
      dimmed={dimmed}
    >
      <div className="grid flex-1 grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-3.5" aria-hidden>
        <div
          className={cn(
            "relative flex flex-col overflow-hidden rounded-[10px] border bg-white p-3 transition-colors duration-300",
            busy || ready ? "border-neutral-300" : "border-neutral-200",
          )}
        >
          <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-neutral-400">
            SourceBD
          </span>
          <span className="mt-2 font-display text-[11px] font-bold leading-snug text-neutral-900">
            Modern Slavery
            <br />
            Act Statement
          </span>
          <span className="mt-2.5 flex flex-col gap-1.5">
            {lineWidths.map((w, i) => (
              <span
                key={w}
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  lineOn[i] ? "bg-neutral-400" : "bg-neutral-100",
                )}
                style={{ width: `${lineOn[i] ? w : w * 0.35}%` }}
              />
            ))}
          </span>
          {/* Quiet scan while generating — reads as writing, not a gimmick. */}
          {busy && !reduce ? (
            <motion.span
              className="pointer-events-none absolute inset-x-2 h-px bg-neutral-400/70"
              initial={{ top: "28%", opacity: 0 }}
              animate={{ top: ["28%", "78%"], opacity: [0, 0.7, 0.7, 0] }}
              transition={{ duration: 0.95, ease: "linear", repeat: Infinity }}
              aria-hidden
            />
          ) : null}
          <svg
            viewBox="0 0 60 18"
            className="mt-auto h-4 w-12 text-neutral-500"
            aria-hidden
          >
            <path
              d="M4 13 C 12 3, 18 16, 26 9 S 44 4, 56 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              pathLength={1}
              style={{
                strokeDasharray: 1,
                strokeDashoffset: ready ? 0 : 1,
                transition: "stroke-dashoffset 600ms ease",
              }}
            />
          </svg>
        </div>

        <div className="flex min-w-0 flex-col">
          <span className="flex h-[1.6em] items-center gap-1.5 text-[11px] font-semibold">
            <span className="relative min-w-0 flex-1">
              <span
                className={cn(
                  "absolute inset-x-0 truncate text-neutral-500 transition-opacity duration-300 ease-in-out",
                  (busy || ready) && "opacity-0",
                )}
              >
                Queued
              </span>
              {/* Incoming status waits 100ms while the outgoing one fades,
                  so two strings are never double-exposed mid-crossfade. */}
              <span
                className={cn(
                  "absolute inset-x-0 truncate text-neutral-700 transition-opacity duration-300 ease-in-out",
                  generating ? "opacity-100 delay-100" : "opacity-0",
                )}
              >
                Generating from verified data…
              </span>
              <span
                className={cn(
                  "absolute inset-x-0 truncate text-neutral-700 transition-opacity duration-300 ease-in-out",
                  preparing ? "opacity-100 delay-100" : "opacity-0",
                )}
              >
                Preparing document…
              </span>
              <span
                className={cn(
                  "absolute inset-x-0 flex items-center gap-1 text-neutral-900 transition-opacity duration-300 ease-in-out",
                  ready ? "opacity-100 delay-100" : "opacity-0",
                )}
              >
                Ready
                <AmbientPulse active={ready} reduce={reduce}>
                  <Check
                    size={11}
                    weight="bold"
                    className="text-brand-forest"
                  />
                </AmbientPulse>
              </span>
            </span>
          </span>

          <span className="mt-2 block h-0.5 w-full overflow-hidden rounded-full bg-neutral-100">
            <span
              className={cn(
                "block h-full rounded-full bg-neutral-500",
                busy
                  ? "w-full transition-[width] duration-[1050ms] ease-linear"
                  : ready
                    ? "w-full opacity-0 transition-opacity duration-300"
                    : "w-0",
              )}
            />
          </span>

          {/* mb-2.5 guarantees breathing room above the button even when
              the column has no slack for mt-auto to distribute. */}
          <ul className="mb-2.5 mt-3 flex flex-col gap-1.5">
            {MSA_FEATURES.map((feature, i) => {
              const done = reduce || featOn[i] || ready;
              return (
                <li
                  key={feature}
                  className={cn(
                    "flex items-center gap-2 text-[10px] leading-snug transition-colors duration-300",
                    done ? "text-neutral-700" : "text-neutral-400",
                  )}
                >
                  <Check
                    size={9}
                    weight="bold"
                    className={cn(
                      "shrink-0 transition-colors duration-300",
                      done ? "text-brand-forest" : "text-neutral-300",
                    )}
                  />
                  {feature}
                </li>
              );
            })}
          </ul>

          <span
            ref={downloadRef}
            className={cn(
              "mt-auto flex items-center justify-center gap-1.5 rounded-pill border px-2 py-1.5 text-[10.5px] font-semibold transition-all duration-300 ease-in-out",
              // Enable is its own beat, shortly after Ready lands.
              enabled
                ? hovering
                  ? "border-neutral-800 bg-neutral-100 text-neutral-900"
                  : "border-neutral-800 text-neutral-900"
                : "border-neutral-200 text-neutral-400",
              pressed && "translate-y-px bg-neutral-100",
            )}
          >
            <DownloadSimple size={11} weight="bold" />
            Download PDF
          </span>
        </div>
      </div>
    </CardShell>
  );
}

/* ─── Section ──────────────────────────────────────────────────── */

export function BuyerWorkflowBento() {
  const prefersReduce = useReducedMotion() ?? false;
  // SSR renders with reduce=false (useReducedMotion is null on the server).
  // Gate on mount so the first client render matches the server HTML, then
  // flip to the settled reduced-motion state — avoids a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const reduce = mounted && prefersReduce;
  const rootRef = useRef<HTMLElement>(null);
  const inView = useInView(rootRef, { once: false, amount: 0.2 });
  const mark = useWorkflowClock(inView, reduce);

  /**
   * True from the event until this card's reset moment — reduce shows all.
   * Resets are STAGGERED per card (shortlist → RFQ → conversation → rest)
   * so the loop restart is hidden inside the MSA finale instead of being
   * one detectable global frame.
   */
  const onUntil = useCallback(
    (ts: number, until: number) => reduce || (mark >= ts && mark < until),
    [mark, reduce],
  );
  const onFollow = useCallback(
    (ts: number) => onUntil(ts, T.resetFollow),
    [onUntil],
  );
  const onRfq = useCallback((ts: number) => onUntil(ts, T.resetRfq), [onUntil]);
  const onConvo = useCallback(
    (ts: number) => onUntil(ts, T.resetConvo),
    [onUntil],
  );
  const on = useCallback((ts: number) => onUntil(ts, T.resetStart), [onUntil]);

  const gridRef = useRef<HTMLDivElement>(null);
  const bookmarkRef = useRef<HTMLSpanElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const sendButtonRef = useRef<HTMLSpanElement>(null);
  const convoCursorRef = useRef<HTMLDivElement>(null);
  const complianceRef = useRef<HTMLLIElement>(null);
  const downloadRef = useRef<HTMLSpanElement>(null);

  // Stable target bag so SharedCursor's effect doesn't thrash every render.
  const cursorTargets = useRef<CursorTargets>({
    bookmark: bookmarkRef,
    form: formRef,
    send: sendButtonRef,
    convo: convoCursorRef,
    compliance: complianceRef,
    download: downloadRef,
  }).current;

  /**
   * Sequential chapter focus: a card stays active from its chapter start
   * until the cursor DEPARTS for the next card (its animations settle,
   * then a ~1s dwell, then departure) — focus never leaves a card
   * mid-animation. The only dual-lit moments are the cursor glides and
   * the brief pre-wake of the next card.
   */
  const focus = !reduce && mark >= T.cursorIn1 && mark < T.resetStart;
  const followActive = focus && mark < T.cursorIn2;
  const rfqActive = focus && mark >= T.cursorIn2 && mark < T.handoffEnd;
  const convoActive =
    focus && mark >= T.unreadBadge && mark < T.cursorComp;
  const compActive =
    focus && mark >= T.cursorComp && mark < T.cursorMsa;
  const msaActive = focus && mark >= T.cursorMsa;

  // Pre-wake: each upcoming card un-dims 200–250ms BEFORE its chapter
  // starts (the conversation card brightens while the cursor is still
  // gliding toward it), so attention is handed off — the eye never has
  // to hunt for where the next movement begins.
  const rfqWaking = mark >= T.wakeRfq && mark < T.cursorIn2;
  const convoWaking = mark >= T.handoffStart && mark < T.unreadBadge;
  const compWaking = mark >= T.wakeComp && mark < T.cursorComp;
  const msaWaking = mark >= T.wakeMsa && mark < T.cursorMsa;

  return (
    <section
      ref={rootRef}
      className="border-b border-neutral-200 bg-white py-16 md:py-20 [overflow-anchor:none]"
      aria-label="Buyer workflow"
    >
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
        <SectionHeader
          kicker="Buyer workflow"
          title="Keep sourcing work moving."
          description="Take the right actions at every step — from finding the right supplier to managing compliance and documentation."
        />

        <p className="sr-only">
          Animated demonstration: a buyer follows a verified supplier to their
          shortlist, composes and sends an RFQ, receives a supplier reply with
          a quotation, sees a certificate expiry update, and downloads a
          generated Modern Slavery Act statement.
        </p>

        {/* Premium spacing: uniform, proportional gutters (equal x/y) that
            stay ≥ the cards' internal padding so outside whitespace never
            feels tighter than inside. */}
        <div
          ref={gridRef}
          className="relative mt-12 grid gap-6 sm:mt-14 md:mt-16 md:grid-cols-6 md:gap-5 xl:gap-6"
        >
          <div className="md:col-span-3">
            <FollowSuppliersCard
              mark={mark}
              reduce={reduce}
              on={onFollow}
              active={followActive}
              dimmed={focus && !followActive}
              bookmarkRef={bookmarkRef}
            />
          </div>
          <div className="md:col-span-3">
            <ComposeRfqCard
              mark={mark}
              reduce={reduce}
              on={onRfq}
              active={rfqActive}
              dimmed={focus && !rfqActive && !rfqWaking}
              formRef={formRef}
              sendButtonRef={sendButtonRef}
            />
          </div>
          <div className="md:col-span-3 xl:col-span-2">
            <ConversationsCard
              mark={mark}
              reduce={reduce}
              on={onConvo}
              active={convoActive}
              dimmed={focus && !convoActive && !convoWaking}
              convoCursorRef={convoCursorRef}
            />
          </div>
          <div className="md:col-span-3 xl:col-span-2">
            <ComplianceCard
              mark={mark}
              reduce={reduce}
              on={on}
              active={compActive}
              dimmed={focus && !compActive && !compWaking}
              complianceRef={complianceRef}
            />
          </div>
          <div className="md:col-span-6 xl:col-span-2">
            <MsaGeneratorCard
              mark={mark}
              reduce={reduce}
              on={on}
              active={msaActive}
              dimmed={focus && !msaActive && !msaWaking}
              downloadRef={downloadRef}
            />
          </div>

          <SharedCursor
            mark={mark}
            reduce={reduce}
            gridRef={gridRef}
            targets={cursorTargets}
          />
        </div>

      </div>
    </section>
  );
}
