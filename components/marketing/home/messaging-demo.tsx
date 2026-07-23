"use client";

// Second cinematic browser — the "reach them directly" beat that follows
// discovery/vetting. A live message thread plays out inside a faux-browser
// frame: the buyer sends an inquiry, the factory shows a typing indicator and
// replies, the buyer attaches an RFQ, and the factory confirms receipt. It
// loops.
//
// Purpose on the page: make the "not a broker — reach them directly"
// positioning tangible. All content is illustrative (same convention as the
// ProductDemo / HeroDossierPreview). No PII, no SBI numeric.
//
// Motion: honours prefers-reduced-motion — the full thread renders at rest
// with no typing indicators or entrance animation.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react";
import {
  Check,
  Circle,
  FileText,
  Lock,
  PaperPlaneTilt,
} from "@phosphor-icons/react/dist/ssr";

import { CompanyAvatar } from "@/components/supplier/company-avatar";
import { cn } from "@/lib/utils";

const SPRING: Transition = { type: "spring", stiffness: 260, damping: 22, mass: 0.9 };
const STEP_MS = 1500;

type Msg = {
  from: "buyer" | "supplier";
  text?: string;
  typing?: boolean; // supplier "types" before this message appears
  rfq?: { title: string; meta: string };
};

const RAW: Msg[] = [
  { from: "buyer", text: "Hi — interested in your OEKO-TEX knit capacity for AW25. What’s your MOQ?" },
  {
    from: "supplier",
    typing: true,
    text: "MOQ is 3,000 pcs per style. OEKO-TEX & GOTS certified — sample lead time is 7 days.",
  },
  { from: "buyer", rfq: { title: "RFQ · 12,000 pcs cotton polo", meta: "AW25 · 3 colourways · FOB Chattogram" } },
  { from: "supplier", typing: true, text: "Received ✓ We’ll send a full costed quote within 24 hours." },
];

// Expand messages into an ordered phase timeline (typing phase, then show
// phase), so a single advancing tick drives the whole thread.
let phaseCursor = 0;
const THREAD = RAW.map((m) => {
  const typingPhase = m.typing ? phaseCursor++ : null;
  const showPhase = phaseCursor++;
  return { ...m, typingPhase, showPhase };
});
const TOTAL_PHASES = phaseCursor;
const HOLD_PHASES = 3; // linger on the finished thread before looping
const CYCLE_PHASES = TOTAL_PHASES + HOLD_PHASES;

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-neutral-200 bg-white px-3.5 py-3 shadow-sm">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="size-1.5 rounded-full bg-neutral-400"
            animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
          />
        ))}
      </div>
    </div>
  );
}

function Bubble({ m, reduce }: { m: Msg; reduce: boolean }) {
  const buyer = m.from === "buyer";
  return (
    <motion.div
      className={cn("flex", buyer ? "justify-end" : "justify-start")}
      initial={reduce ? false : { opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={SPRING}
    >
      {m.rfq ? (
        <div className="max-w-[86%] rounded-2xl rounded-br-sm border border-brand-forest/25 bg-brand-forest-soft px-3.5 py-3 sm:max-w-[70%]">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-white text-brand-forest">
              <FileText size={16} weight="duotone" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[12px] font-bold text-neutral-900 sm:text-[13px]">{m.rfq.title}</p>
              <p className="truncate text-[11px] text-neutral-500 sm:text-[12px]">{m.rfq.meta}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-end gap-1 text-[10px] font-semibold text-brand-forest sm:text-[11px]">
            Sent <Check size={11} weight="bold" aria-hidden />
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "max-w-[86%] px-3.5 py-2.5 text-[12px] leading-relaxed shadow-sm sm:max-w-[70%] sm:text-[13px]",
            buyer
              ? "rounded-2xl rounded-br-sm bg-brand-forest text-white"
              : "rounded-2xl rounded-bl-sm border border-neutral-200 bg-white text-neutral-800",
          )}
        >
          {m.text}
        </div>
      )}
    </motion.div>
  );
}

export function MessagingDemo() {
  const reduce = useReducedMotion() ?? false;
  const [tick, setTick] = useState(reduce ? TOTAL_PHASES : 0);
  const [loop, setLoop] = useState(0);
  const frozen = useRef(false);

  useEffect(() => {
    if (reduce) {
      frozen.current = true;
      setTick(TOTAL_PHASES);
    }
  }, [reduce]);

  useEffect(() => {
    if (frozen.current) return;
    const id = setInterval(() => {
      setTick((t) => {
        if (t >= CYCLE_PHASES - 1) {
          setLoop((l) => l + 1);
          return 0;
        }
        return t + 1;
      });
    }, STEP_MS);
    return () => clearInterval(id);
  }, []);

  // Supplier "typing" shows on the phase immediately before its message.
  const typingSide = THREAD.find((m) => m.typingPhase != null && m.typingPhase === tick);

  return (
    <div className="mx-auto w-full max-w-6xl">
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
            <span className="text-[11px] font-medium text-neutral-600 sm:text-[12px]">SourceBD · Messages</span>
          </div>
        </div>

        {/* URL bar */}
        <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2 sm:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1 sm:px-3">
            <Lock size={12} weight="fill" className="shrink-0 text-brand-forest" aria-hidden />
            <span className="truncate font-mono text-[11px] text-neutral-500 sm:text-[12px]">
              sourcebd.net/app/messages/dbl-group
            </span>
          </div>
        </div>

        {/* Thread header */}
        <div className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3 sm:px-5">
          <CompanyAvatar name="DBL Group" verified className="scale-[0.7] sm:scale-75" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[14px] font-bold text-neutral-900 sm:text-[15px]">DBL Group</p>
            <p className="flex items-center gap-1.5 text-[11px] text-neutral-500 sm:text-[12px]">
              <Circle size={8} weight="fill" className="text-brand-forest" aria-hidden />
              Verified factory · Gazipur
            </p>
          </div>
          <span className="hidden items-center gap-1 rounded-pill border border-brand-forest/20 bg-brand-forest-soft px-2.5 py-1 text-[11px] font-semibold text-brand-forest sm:inline-flex">
            <Check size={12} weight="bold" aria-hidden />
            Direct · no broker
          </span>
        </div>

        {/* Conversation viewport */}
        <div className="relative bg-bg-l0">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10"
            style={{
              background:
                "radial-gradient(120% 60% at 50% -10%, rgba(255,255,255,0.7), transparent 40%)",
            }}
          />
          <div
            key={loop}
            className="relative z-0 flex h-[300px] flex-col justify-end gap-2.5 px-4 py-4 sm:h-[380px] sm:gap-3 sm:px-6 lg:h-[420px]"
          >
            <AnimatePresence>
              {THREAD.filter((m) => tick >= m.showPhase).map((m) => (
                <Bubble key={m.showPhase} m={m} reduce={reduce} />
              ))}
              {typingSide ? <TypingBubble key="typing" /> : null}
            </AnimatePresence>
          </div>
        </div>

        {/* Composer */}
        <div className="flex items-center gap-2 border-t border-neutral-200 bg-white px-3 py-2.5 sm:px-4">
          <div className="flex-1 truncate rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[12px] text-neutral-400 sm:text-[13px]">
            Write a message…
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-forest px-3 py-2 text-[12px] font-semibold text-white sm:text-[13px]">
            <PaperPlaneTilt size={14} weight="fill" aria-hidden />
            <span className="hidden sm:inline">Send</span>
          </span>
        </div>
      </div>
    </div>
  );
}
