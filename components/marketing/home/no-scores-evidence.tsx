"use client";

// 03 — "No invented scores." A compact evidence grid, not a 2-item list.
//
// Earlier cuts of this card capped the row list to 2 certifications,
// which under-sold what SourceBD actually screens for a given supplier —
// registries and certifications alike. This version renders every real
// authority mark on file (registry filings + certifications, capped only
// to bound card height — never trimmed to look sparse) as a dense chip
// grid, so the card reads as "we checked a lot", truthfully, using only
// live data. The one thing that is NOT a filed record — the proprietary
// score — gets a single slim footer line, not a large illustration: the
// space belongs to the real evidence, not to decorating its absence.
//
// Replays every time the card re-enters view (not once). Fully honours
// prefers-reduced-motion: everything renders at rest immediately.

import { useRef } from "react";
import { motion, useInView, useReducedMotion, type Variants } from "motion/react";
import { Prohibit, Quotes } from "@phosphor-icons/react/dist/ssr";

import { ProfileSourceMark } from "@/components/supplier/profile-ui";
import { cn } from "@/lib/utils";

export type AuthorityItem = {
  /** Logo-resolver tag, e.g. "BGMEA", "GOTS", "OEKO_TEX". */
  code: string;
  kind: "registry" | "certification";
  label: string;
  status: string;
  tone: "valid" | "expiring" | "expired" | "evergreen";
  /** Verbatim issuer scope text (e.g. GOTS "Operations: … | Products: …",
   * OEKO-TEX standard label) — never SourceBD-authored, never a fallback
   * guess. Certifications only; registries carry none. */
  scope: string | null;
};

const TONE_TEXT_CLASS: Record<AuthorityItem["tone"], string> = {
  valid: "text-sem-green",
  evergreen: "text-sem-green",
  expiring: "text-sem-amber",
  expired: "text-neutral-500",
};

const gridVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};

const chipVariants: Variants = {
  hidden: { opacity: 0, y: 6, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.32, ease: "easeOut" } },
};

const footerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4 } },
};

export function NoScoresEvidence({
  items,
  overflow,
}: {
  items: AuthorityItem[];
  overflow: number;
}) {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  // Replays every time the card re-enters view (not once) — easy to
  // trigger on demand by scrolling away and back.
  const isInView = useInView(ref, { once: false, amount: 0.4 });
  const show = reduce || isInView;
  const footerDelay = reduce ? 0 : 0.05 + items.length * 0.05 + 0.25;

  return (
    <div
      ref={ref}
      role="img"
      aria-label={`${items.length} real registry filings and certifications on file, each with the issuer's own record; SourceBD score deliberately unpublished`}
      className="w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm"
    >
      <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
        <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
          Issuer records
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-400">
          {items.length + overflow} on file
        </span>
      </div>

      <motion.div
        initial="hidden"
        animate={show ? "visible" : "hidden"}
        variants={reduce ? undefined : gridVariants}
        className="grid grid-cols-2 gap-1.5 p-2.5"
      >
        {items.map((item, i) => (
          <motion.div
            key={`${item.kind}-${item.code}-${i}`}
            variants={reduce ? undefined : chipVariants}
            title={item.scope ? `Issuer-stated scope: ${item.scope}` : undefined}
            className="flex min-w-0 items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50/70 px-2 py-1.5"
          >
            <ProfileSourceMark
              tag={item.code}
              label={item.label}
              size="sm"
              className="!size-6 !shrink-0 !rounded-md"
            />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1">
                <span className="truncate font-display text-[11px] font-semibold leading-tight text-neutral-900">
                  {item.label}
                </span>
                {item.scope ? (
                  <Quotes
                    size={8}
                    weight="fill"
                    aria-hidden
                    className="shrink-0 text-neutral-400"
                  />
                ) : null}
              </div>
              <span
                className={cn(
                  "block truncate text-[9px] font-semibold leading-tight",
                  TONE_TEXT_CLASS[item.tone],
                )}
              >
                {item.status}
              </span>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {overflow > 0 ? (
        <p className="px-3 pb-2 text-right font-mono text-[9px] uppercase tracking-[0.1em] text-neutral-400">
          +{overflow} more on file
        </p>
      ) : null}

      {/* The one thing on this card that is not a filed record — a slim
          line, not a set piece. The evidence above gets the real estate. */}
      <motion.div
        initial="hidden"
        animate={show ? "visible" : "hidden"}
        variants={reduce ? undefined : footerVariants}
        transition={reduce ? undefined : { duration: 0.4, delay: footerDelay }}
        className="flex items-center justify-center gap-1.5 border-t border-dashed border-neutral-200 bg-neutral-50 py-2"
      >
        <Prohibit size={11} aria-hidden className="text-neutral-400" />
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
          SourceBD score — deliberately unpublished
        </span>
      </motion.div>
    </div>
  );
}
