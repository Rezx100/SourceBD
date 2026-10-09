"use client";

// The certificates of a list or table row as marks only (founder, 9 Oct 2026: the pill beside the
// first mark read as a stray warning). A mark whose body has a lapsed or lapsing certificate lights
// up: a caution frame and a corner glyph, XCircle for expired and Clock for expiring (shape tells
// them apart; red is never a date). Hover with a mouse, or tap or press Enter, and every body's
// sentence opens under the marks. Inside a link (the pane and phone lists) a button cannot nest, so
// `reveal` is off there: the marks still light up and the row opens the record with every certificate.

import { CheckCircle, Clock, MinusCircle, XCircle } from "@phosphor-icons/react/dist/ssr";
import { Popover as P } from "radix-ui";
import { useRef, useState } from "react";
import { popoverClass } from "@/components/kit";
import { cn } from "@/lib/utils";
import { SourceMark, hasSourceMark } from "./source-mark";
import type { CertBody, CertSummary } from "./words";

const lit = (s: CertBody["state"]) => s === "expired" || s === "expiring";

const GLYPH: Record<CertBody["state"], { Icon: typeof Clock; cls: string; weight?: "fill" }> = {
  expired: { Icon: XCircle, cls: "text-caution-icon", weight: "fill" },
  expiring: { Icon: Clock, cls: "text-caution-icon", weight: "fill" },
  valid: { Icon: CheckCircle, cls: "text-ink-2", weight: "fill" },
  none: { Icon: MinusCircle, cls: "text-ink-3" },
};

function Mark({ body }: { body: CertBody }) {
  const g = GLYPH[body.state];
  return (
    <span className="relative inline-flex">
      {hasSourceMark(body.code) ? (
        <SourceMark source={body.code} className={cn(lit(body.state) && "border-caution-icon bg-cert-expiring-bg")} />
      ) : (
        <span className={cn("inline-flex h-6 items-center rounded-md border px-1.5 text-xs font-medium", lit(body.state) ? "border-caution-icon bg-cert-expiring-bg text-cert-expiring-fg" : "border-line text-ink-2")}>{body.scheme}</span>
      )}
      {lit(body.state) ? (
        <span data-lit={body.state} className="absolute -right-1 -top-1 flex rounded-full bg-surface">
          <g.Icon size={11} weight="fill" className={g.cls} />
        </span>
      ) : null}
    </span>
  );
}

/** The marks: the worst body first, then two more with approved marks, then "+N". */
function Marks({ cert }: { cert: CertSummary }) {
  const others = cert.others.filter((b) => hasSourceMark(b.code)).slice(0, 2);
  const rest = cert.total - 1 - others.length;
  return (
    <span aria-hidden className="inline-flex items-center gap-1.5">
      <Mark body={cert.first} />
      {others.map((b) => (
        <Mark key={b.code} body={b} />
      ))}
      {rest ? <span className="pl-0.5 text-xs font-medium text-ink-3">+{rest}</span> : null}
    </span>
  );
}

/** Every body once, worst first, each with its glyph and its whole sentence. */
function Detail({ cert }: { cert: CertSummary }) {
  const bodies = [cert.first, ...cert.others];
  return (
    <>
      <p className="pb-2 text-xs font-medium text-ink-3">{cert.total === 1 ? "1 certificate" : `${cert.total} certificates`}</p>
      <ul className="flex flex-col gap-1.5">
        {bodies.map((b) => {
          const g = GLYPH[b.state];
          return (
            <li key={b.code} className="flex items-start gap-2 text-sm">
              <g.Icon size={14} weight={g.weight} className={cn("mt-0.5 shrink-0", g.cls)} aria-hidden />
              <span className={lit(b.state) ? "font-medium text-caution" : "text-ink-2"}>{b.words}</span>
            </li>
          );
        })}
      </ul>
      {cert.total > bodies.length ? <p className="pt-2 text-xs text-ink-3">The record’s Certificates tab lists every one with its date.</p> : null}
    </>
  );
}

export function CertSummaryCell({ cert, reveal = false }: { cert: CertSummary; reveal?: boolean }) {
  const [open, setOpen] = useState(false);
  const mouse = useRef(false);
  // A screen reader hears every body the marks show, each with its state, not the marks.
  const said = cert.total === 1 ? cert.first.words : `${cert.total} certificates: ${[cert.first, ...cert.others].map((b) => b.words).join("; ")}`;
  if (!reveal)
    return (
      <span className="inline-flex items-center" title={cert.words}>
        <span className="sr-only">{said}</span>
        <Marks cert={cert} />
      </span>
    );
  return (
    <P.Root open={open} onOpenChange={setOpen}>
      <P.Trigger
        type="button"
        className="-m-1 inline-flex items-center rounded-md p-1 outline-none hover:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus data-[state=open]:bg-sunken"
        onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
        onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(false)}
        onPointerDown={(e) => {
          mouse.current = e.pointerType === "mouse";
        }}
        // A mouse already opened it on hover: its click must not toggle it shut. A tap or a key toggles.
        onClick={(e) => {
          if (mouse.current) e.preventDefault();
          mouse.current = false;
        }}
      >
        <span className="sr-only">{said}</span>
        <Marks cert={cert} />
      </P.Trigger>
      <P.Portal>
        <P.Content
          side="bottom"
          align="start"
          sideOffset={6}
          // Nothing inside takes focus; a hover must never pull focus off the row.
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(popoverClass, "w-auto min-w-56 max-w-80 p-3")}
        >
          <Detail cert={cert} />
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
