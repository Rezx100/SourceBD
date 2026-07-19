"use client";

// Verified-record steps — /home-demo only.
// A single connected product demonstration: lookup → evidence → verified record.

import {
  ArrowDown,
  ArrowRight,
  Buildings,
  Certificate,
  Check,
  CheckCircle,
  FileText,
  MagnifyingGlass,
  ShieldCheck,
} from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";

import { SectionHeader } from "@/components/marketing/home/section-header";
import { BlurFade } from "@/components/ui/blur-fade";

const LOOKUP_ROWS = [
  { label: "Government registry", icon: Buildings },
  { label: "Trade association", icon: ShieldCheck },
  { label: "Certificate issuer", icon: Certificate },
] as const;

const EVIDENCE_ROWS = [
  { label: "Certificate", meta: "Issuer record" },
  { label: "Registry", meta: "Statutory source" },
  { label: "Export history", meta: "Trade record" },
  { label: "Compliance", meta: "Document trail" },
] as const;

function StepHeading({
  step,
  label,
  title,
}: {
  step: string;
  label: string;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[12px] font-medium text-brand-forest">
          {step}
        </span>
        <span className="h-px w-5 bg-neutral-300" aria-hidden />
        <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-neutral-500">
          {label}
        </span>
      </div>
      <h3 className="whitespace-nowrap font-display text-xl font-bold leading-tight tracking-tight text-neutral-900">
        {title}
      </h3>
    </div>
  );
}

function Connector({
  delay,
  reduce,
}: {
  delay: number;
  reduce: boolean;
}) {
  const transition = reduce
    ? { duration: 0 }
    : { delay, duration: 0.55, ease: "easeOut" as const };

  return (
    <>
      <div
        className="relative hidden items-center justify-center md:flex"
        aria-hidden
      >
        <div className="absolute left-0 right-0 h-px bg-neutral-200" />
        <motion.div
          className="absolute left-0 right-0 h-px origin-left bg-brand-forest"
          initial={reduce ? false : { scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, amount: 0.8 }}
          transition={transition}
        />
        <motion.span
          className="relative grid size-7 place-items-center rounded-full border border-neutral-200 bg-white text-brand-forest"
          initial={reduce ? false : { opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={transition}
        >
          <ArrowRight size={13} weight="bold" />
        </motion.span>
      </div>

      <div
        className="relative flex h-14 items-center justify-center md:hidden"
        aria-hidden
      >
        <div className="absolute bottom-0 top-0 w-px bg-neutral-200" />
        <motion.div
          className="absolute bottom-0 top-0 w-px origin-top bg-brand-forest"
          initial={reduce ? false : { scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true, amount: 0.8 }}
          transition={transition}
        />
        <motion.span
          className="relative grid size-7 place-items-center rounded-full border border-neutral-200 bg-white text-brand-forest"
          initial={reduce ? false : { opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={transition}
        >
          <ArrowDown size={13} weight="bold" />
        </motion.span>
      </div>
    </>
  );
}

function LookupDemo({ reduce }: { reduce: boolean }) {
  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
      <div className="flex items-center gap-2 border-b border-neutral-200 bg-white px-3 py-2.5">
        <MagnifyingGlass
          size={15}
          className="shrink-0 text-neutral-500"
          aria-hidden
        />
        <span className="text-[13px] text-neutral-600">Searching source records</span>
        <motion.span
          className="ml-auto size-1.5 rounded-full bg-brand-forest"
          animate={reduce ? undefined : { opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        />
      </div>
      <div className="space-y-1.5 p-2">
        {LOOKUP_ROWS.map(({ label, icon: Icon }, index) => (
          <motion.div
            key={label}
            className="flex items-center gap-2.5 rounded-lg border border-neutral-200 bg-white px-3 py-2.5"
            initial={reduce ? false : { opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{
              delay: reduce ? 0 : 0.18 + index * 0.2,
              duration: reduce ? 0 : 0.35,
            }}
          >
            <Icon size={16} className="text-neutral-500" aria-hidden />
            <span className="text-[13px] font-medium text-neutral-700">
              {label}
            </span>
            <CheckCircle
              size={17}
              weight="fill"
              className="ml-auto text-brand-forest"
              aria-hidden
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function EvidenceDemo({ reduce }: { reduce: boolean }) {
  return (
    <div className="relative mt-6 pl-6">
      <div
        className="absolute bottom-3 left-[7px] top-3 w-px bg-neutral-200"
        aria-hidden
      />
      <motion.div
        className="absolute bottom-3 left-[7px] top-3 w-px origin-top bg-brand-forest"
        initial={reduce ? false : { scaleY: 0 }}
        whileInView={{ scaleY: 1 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{
          delay: reduce ? 0 : 0.85,
          duration: reduce ? 0 : 0.9,
          ease: "easeOut",
        }}
        aria-hidden
      />
      <div className="space-y-2.5">
        {EVIDENCE_ROWS.map((item, index) => (
          <motion.div
            key={item.label}
            className="relative rounded-lg border border-neutral-200 bg-white px-3 py-2.5"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{
              delay: reduce ? 0 : 0.9 + index * 0.18,
              duration: reduce ? 0 : 0.35,
            }}
          >
            <span
              className="absolute -left-[22px] top-1/2 size-2.5 -translate-y-1/2 rounded-full border-2 border-white bg-brand-forest"
              aria-hidden
            />
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-neutral-500" aria-hidden />
              <span className="text-[13px] font-semibold text-neutral-800">
                {item.label}
              </span>
              <span className="ml-auto font-mono text-[12px] text-neutral-500">
                {item.meta}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function RecordDemo({ reduce }: { reduce: boolean }) {
  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3.5">
        <div className="grid size-9 place-items-center rounded-lg bg-neutral-100 font-display text-sm font-bold text-neutral-600">
          SR
        </div>
        <div>
          <p className="text-[13px] font-semibold text-neutral-900">
            Supplier record
          </p>
          <p className="font-mono text-[12px] text-neutral-500">
            Evidence reconciled
          </p>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-neutral-600">Verification status</span>
          <motion.span
            className="font-mono text-[12px] text-neutral-500"
            initial={reduce ? false : { opacity: 1 }}
            whileInView={{ opacity: reduce ? 0 : [1, 1, 0] }}
            viewport={{ once: true }}
            transition={{
              delay: reduce ? 0 : 1.65,
              duration: reduce ? 0 : 0.55,
              times: [0, 0.65, 1],
            }}
          >
            Checking…
          </motion.span>
        </div>

        <motion.div
          className="flex items-center gap-2.5 rounded-lg bg-brand-forest px-3.5 py-3 text-white"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{
            delay: reduce ? 0 : 2.05,
            duration: reduce ? 0 : 0.45,
            ease: "easeOut",
          }}
        >
          <span className="grid size-6 place-items-center rounded-full bg-white/15">
            <Check size={14} weight="bold" aria-hidden />
          </span>
          <span className="text-sm font-semibold">Verified record</span>
          <span className="ml-auto font-mono text-[12px] text-white/75">
            Sources attached
          </span>
        </motion.div>

        <motion.div
          className="grid grid-cols-2 gap-2"
          initial={reduce ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{
            delay: reduce ? 0 : 2.25,
            duration: reduce ? 0 : 0.4,
          }}
        >
          {["Authority ranked", "Traceable claims"].map((label) => (
            <span
              key={label}
              className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-center text-[12px] font-medium text-neutral-700"
            >
              {label}
            </span>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

export function VerifiedRecordSteps() {
  const reduce = useReducedMotion() ?? false;

  return (
    <section
      className="border-b border-neutral-200 bg-neutral-50 py-16 md:py-20"
      aria-label="How the verified record is built"
    >
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
        <BlurFade delay={0.08}>
          <SectionHeader
            kicker="How the record is built"
            title="How every supplier record is verified."
            description="Independent evidence is gathered, reconciled, and attached before a supplier record becomes searchable."
          />
        </BlurFade>

        <motion.div
          className="mt-16 overflow-hidden rounded-card border border-neutral-200 bg-white sm:mt-[4.5rem] md:mt-20 md:grid md:grid-cols-[minmax(0,1.05fr)_48px_minmax(0,0.95fr)_48px_minmax(0,1.15fr)]"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: reduce ? 0 : 0.5, ease: "easeOut" }}
        >
          <article className="p-5 sm:p-6 lg:p-7">
            <StepHeading step="01" label="Find" title="Look up the claim." />
            <LookupDemo reduce={reduce} />
          </article>

          <Connector delay={0.72} reduce={reduce} />

          <article className="border-y border-neutral-200 bg-neutral-50/70 p-5 sm:p-6 md:border-y-0 lg:p-7">
            <StepHeading step="02" label="Build" title="Assemble the evidence." />
            <EvidenceDemo reduce={reduce} />
          </article>

          <Connector delay={1.62} reduce={reduce} />

          <article className="p-5 sm:p-6 lg:p-7">
            <StepHeading
              step="03"
              label="Verify"
              title="Update the supplier record."
            />
            <RecordDemo reduce={reduce} />
          </article>
        </motion.div>
      </div>
    </section>
  );
}
