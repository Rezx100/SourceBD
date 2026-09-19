// Sheet primitives (REZ-A, artifact SupplierSheet README): the stage a sheet
// or dialog sits over, the 32% scrim, the 880px sheet with its 52px bar, tabs
// with mono counts, sections, the FactsPanel (28px rows, label 150px, a mark
// at the row's end), the striped locked contact card, stat blocks, the
// certificate card, the RSC block and the sticky frosted action bar.

import type { ReactNode } from "react";
import { certStateLabel, rscStatusNeedsLook, type CertModel } from "@/lib/dashboard/facts";
import type { FactRow } from "@/lib/dashboard/models";
import { sourceMark } from "@/lib/dashboard/source-tiers";
import { cn } from "@/lib/utils";
import { Badge } from "./chips";
import { Button, Meter } from "./controls";
import { Icon } from "./icons";
import { SourceMark } from "./marks";
import { Caption, Code, Eyebrow, Heading, Label } from "./type";

/** `.stage`: a fixed-height frame that clips the shell under a sheet or dialog. */
export function Stage({ height, children }: { height: number; children: ReactNode }) {
  return (
    <div className="relative overflow-hidden" style={{ height }}>
      {children}
    </div>
  );
}

export function Scrim() {
  return <div aria-hidden className="absolute inset-0 bg-surface-inverse opacity-[0.32]" />;
}

/** `.sheet`: 880px, `surface`, a `line` left rule, `shadow-lg`. */
export function Sheet({ label, children }: { label: string; children: ReactNode }) {
  return (
    <aside
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="absolute bottom-0 right-0 top-0 flex w-[880px] flex-col border-l border-line bg-surface shadow-lg"
    >
      {children}
    </aside>
  );
}

export function SheetBar({ children }: { children: ReactNode }) {
  return <div className="flex h-[52px] shrink-0 items-center gap-3 border-b border-line-subtle px-5">{children}</div>;
}

export function SheetScroll({ children }: { children: ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>;
}

/**
 * A tab links only to a section this sheet actually renders. The others keep
 * the approved fragment's inert `href="#"` and say so to a screen reader,
 * rather than pointing at an anchor that does not exist.
 */
export function SheetTabs({ tabs }: { tabs: readonly { label: string; count: string | null; href: string | null; active?: boolean }[] }) {
  return (
    <nav aria-label="Record sections" className="mt-2 flex gap-5 border-b border-line-subtle px-6">
      {tabs.map((t) => (
        <a
          key={t.label}
          href={t.href ?? "#"}
          aria-disabled={t.href === null ? "true" : undefined}
          title={t.href === null ? "This section arrives with the record page" : undefined}
          aria-current={t.active ? "true" : undefined}
          className={cn(
            "-mb-px inline-flex h-10 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent text-base font-medium text-ink-muted",
            t.href === null && "text-ink-subtle",
            t.active && "border-brand text-ink-strong",
          )}
        >
          {t.label}
          {t.count !== null ? (
            <span className={cn("font-mono text-[11px] text-ink-subtle", t.active && "text-brand-ink")}>{t.count}</span>
          ) : null}
        </a>
      ))}
    </nav>
  );
}

/** `.sec`: a section with its heading row. */
export function SheetSection({
  id,
  title,
  caption,
  action,
  children,
}: {
  id?: string;
  title?: string;
  caption?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="flex flex-col gap-4 border-b border-line-subtle px-6 py-5">
      {title ? (
        <div className="flex items-baseline gap-2">
          <Heading level="sm" as="h3" className="flex-1">
            {title}
          </Heading>
          {caption ? <Caption>{caption}</Caption> : null}
          {action ? <span className="ml-auto text-sm font-medium">{action}</span> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** `.fp`: the facts panel. Every row has room for a mark; a missing value reads "Not on file". */
export function FactsPanel({ rows }: { rows: readonly FactRow[] }) {
  return (
    <div className="flex flex-col">
      {rows.map((r) => (
        <div key={r.label} className="flex min-h-fact-row items-start gap-3 border-t border-line-subtle py-[3px] first:border-t-0">
          <span className="w-[150px] shrink-0 text-sm font-medium leading-[22px] text-ink-muted">{r.label}</span>
          <span className={cn("min-w-0 flex-1 text-base leading-[22px] text-ink [overflow-wrap:anywhere]", r.value === null && "text-quiet-ink")}>
            {r.value === null ? (
              <>
                Not on file
                {r.note ? ` · ${r.note}` : ""}
              </>
            ) : r.href ? (
              <a href={r.href} className="inline-flex items-center gap-0.5 text-brand-ink">
                {r.code ? <Code>{r.value}</Code> : r.value} <Icon name="external" small />
              </a>
            ) : r.code ? (
              <Code>{r.value}</Code>
            ) : (
              r.value
            )}
            {r.value !== null && r.note ? <Caption className="ml-1.5">{r.note}</Caption> : null}
            {r.badge ? (
              <Badge tone={r.badge.tone} className="ml-1.5 align-middle">
                {r.badge.label}
              </Badge>
            ) : null}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 pt-[3px]">
            {r.marks && r.marks.length > 0 ? (
              r.marks.map((m) => <SourceMark key={m.code} mark={m} sm />)
            ) : r.value === null && r.checked ? (
              <Caption className="whitespace-nowrap">{r.checked}</Caption>
            ) : r.pendingSource ? (
              <span className="whitespace-nowrap text-xs text-ink-subtle" title="The register that filed this value is not attributed per field yet">
                source pending
              </span>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  );
}

/** `.lockcard`: the contact block, locked by default. Striped, never blurred. The plan name comes from settings; without one the label is just "Contact details". */
export function LockCard({ hidden, plan }: { hidden: string; plan: string | null }) {
  return (
    <div data-locked="true" className="overflow-hidden rounded-md border border-locked-line">
      <div className="locked-pattern flex flex-col gap-1.5 p-4 text-locked-ink">
        <Label className="inline-flex items-center gap-1.5 text-ink-strong">
          <Icon name="lock" /> Contact details{plan ? ` · ${plan}` : ""}
        </Label>
        <span className="text-xs">{hidden}</span>
      </div>
      <div className="flex flex-col gap-3 px-4 py-3 text-sm text-ink-muted">
        {/* No promise about delivery: the RPC does not say whether this record
            has been claimed, and an unclaimed supplier is not reached until
            REZ-D ships behind RFQ_EMAIL_UNCLAIMED (handoff §4.6). */}
        <span>Send an RFQ from the record instead.</span>
        <span className="flex items-center gap-2">
          <Button>See plans</Button>
          <a href="#" className="inline-flex items-center gap-0.5 text-sm font-medium text-brand-ink">
            What is hidden <Icon name="chev-r" small />
          </a>
        </span>
      </div>
    </div>
  );
}

/** `.stats`: four stat blocks in a row. */
export function Stats({ items }: { items: readonly { key: string; value: string; sub: string | null }[] }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {items.map((s) => (
        <div key={s.key} className="flex min-w-0 flex-col gap-0.5 rounded-sm border border-line px-3 py-2.5">
          <Eyebrow>{s.key}</Eyebrow>
          <span className="whitespace-nowrap text-2xl font-normal text-ink-strong">{s.value}</span>
          {/* The sub-line carries a certificate's scope and a chapter list; held
              to one line it ran out of its cell and over the next stat. */}
          {s.sub ? <Caption className="[overflow-wrap:anywhere]">{s.sub}</Caption> : null}
        </div>
      ))}
    </div>
  );
}

const CERT_BADGE_TONE = { valid: "positive", expiring: "caution", expired: "caution", "no-expiry": "type" } as const;
const CERT_BADGE_ICON = { valid: "check-c", expiring: "clock", expired: "warn", "no-expiry": undefined } as const;

/** `.cert`: one certificate card. */
export function CertCard({ cert }: { cert: CertModel }) {
  const mark = sourceMark(cert.markCode);
  return (
    <div className="flex flex-col gap-1 rounded-sm border border-line px-3.5 py-3">
      <div className="flex items-center gap-2">
        <SourceMark mark={mark} />
        <Label className="flex-1 text-ink-strong">{cert.scheme}</Label>
        <Badge tone={CERT_BADGE_TONE[cert.state]} icon={CERT_BADGE_ICON[cert.state]}>
          {certStateLabel(cert)}
        </Badge>
      </div>
      {cert.number ? <Code className="text-ink">{cert.number}</Code> : <Caption>No certificate number on file</Caption>}
      <Caption>
        {[cert.issuer, cert.scope ? `scope: ${cert.scope}` : null].filter(Boolean).join(" · ")}
        {cert.documentUrl ? (
          <a href={cert.documentUrl} className="ml-1.5 inline-flex items-center gap-0.5 text-brand-ink">
            Certificate <Icon name="external" small />
          </a>
        ) : null}
      </Caption>
    </div>
  );
}

export function CertGrid({ certs }: { certs: readonly CertModel[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {certs.map((c) => (
        <CertCard key={`${c.kind}-${c.number ?? c.expiresOn ?? ""}`} cert={c} />
      ))}
    </div>
  );
}

/** `.rsc`: the remediation meter with status words and the five report links. The RPC carries only active rows; "no longer covered" arrives with REZ-C. */
export function RscBlock({
  progress,
  status,
  training,
  links,
}: {
  progress: number | null;
  status: string | null;
  training: string | null;
  links: readonly { label: string; href: string | null }[];
}) {
  const words = [status, training].filter(Boolean).join(" · ");
  // "not finalised" is as much a caution as "behind schedule"; matching two of
  // the five states left the other one in the positive treatment.
  const behind = rscStatusNeedsLook(status);
  return (
    <div className="grid grid-cols-2 items-start gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Label className="text-ink-strong">
            {progress === null ? "Remediation not on file" : `Remediation ${progress} %`}
          </Label>
          {behind ? (
            <Badge tone="caution" icon="shield">
              Active · {status}
            </Badge>
          ) : (
            <Badge tone="positive" icon="check-c">
              Active
            </Badge>
          )}
          {words ? <Caption className="ml-auto">{words}</Caption> : null}
        </div>
        {progress === null ? null : <Meter pct={progress} thick />}
      </div>
      <div className="flex flex-wrap gap-2">
        {links.map((l) =>
          l.href ? (
            <a
              key={l.label}
              href={l.href}
              className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-line px-2.5 text-sm font-medium text-ink"
            >
              {l.label} <Icon name="external" small />
            </a>
          ) : (
            <span
              key={l.label}
              className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-dashed border-quiet-line px-2.5 text-sm text-quiet-ink"
            >
              {l.label} · not on file
            </span>
          ),
        )}
      </div>
    </div>
  );
}

/** `.actbar`: the sticky frosted action bar. The caption is only made when every mark on the sheet links to its register page. */
export function ActionBar({ sanctioned, everyMarkLinks }: { sanctioned: boolean; everyMarkLinks: boolean }) {
  return (
    <div className="glass flex shrink-0 items-center gap-2 border-t border-line-subtle px-6 py-3">
      <Button variant="primary" lg disabled={sanctioned}>
        <Icon name="send" /> Send RFQ
      </Button>
      <Button lg>
        <Icon name="bookmark" /> Save
      </Button>
      <Button lg>
        <Icon name="compare" /> Compare
      </Button>
      <Caption className="ml-auto">{everyMarkLinks ? "Every source mark links to its register page" : "Source marks link to their register page where one is on file"}</Caption>
    </div>
  );
}

/**
 * The full-width sanction banner under the bar of a sanctioned record — on
 * every tab. `data-sanction-visible` is what a guard asserts: spec §2 says the
 * warning "cannot be hidden by layout", and every assertion about it used to
 * match on its text, which an `sr-only` class leaves in place.
 */
export function SanctionBanner({ sample }: { sample?: boolean }) {
  return (
    <div data-sanction-visible="true" role="alert" className="flex items-center gap-2 bg-sanction px-6 py-2.5 text-sm font-medium text-sanction-on">
      <Icon name="warn" />
      Sanctioned{sample ? " · sample record" : ""} — matched on a sanctions screen. RFQs cannot be sent to this supplier.
    </div>
  );
}
