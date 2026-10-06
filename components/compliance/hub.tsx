// The Compliance hub (Paper `10 · Compliance · needs attention, ranked`, `11 · Alerts`): the
// certificates that need a look with one ask each, and a 344 column with the UFLPA counts, the
// modern slavery statement and the expiry dates. Server components. Each card stands on its own
// read: a failed read is said in the card that needed it, and never shown as nothing to check.

import { ArrowLeft, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { ButtonLink, ErrorPanel, InlineError, Skeleton, buttonClass } from "@/components/kit";
import { DownloadCsv } from "@/components/export/download-csv";
import { EvidencePackButton } from "./evidence-pack";
import { NeedsAttention, type AttentionItem } from "@/components/patterns";
import type { Attention } from "@/lib/dashboard/needs-attention";
import { cn } from "@/lib/utils";
import { COMPLIANCE_HREF, EXPIRY_HREF, attentionGroup, attentionGroupLines, certExportHref, MSA_HREF, UFLPA_HREF, UFLPA_WORDS, comingUp, hubCaption, uflpaCounts, uflpaNote, type CertList, type MsaSummary, type UflpaPayload } from "./words";

const textLink = "rounded-sm font-medium text-brand underline decoration-1 [text-underline-position:from-font] outline-none hover:decoration-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

/** The way back to the hub from a sub-page. */
export function BackToHub() {
  return (
    <Link href={COMPLIANCE_HREF} prefetch={false} className={cn(textLink, "inline-flex items-center gap-1.5 self-start text-base max-md:min-h-11")}>
      <ArrowLeft size={16} className="shrink-0" aria-hidden />
      Compliance
    </Link>
  );
}

export function HubHead({ saved, download = false, pack = false }: { saved: number | null; download?: boolean; /** Offer the evidence pack: there are saved suppliers for it to cover. */ pack?: boolean }) {
  return (
    <header className="flex shrink-0 items-end justify-between gap-4 border-b border-line px-6 pb-4 pt-5 max-md:hidden">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Compliance</h1>
        <p className="text-base text-ink-3">{hubCaption(saved)}</p>
      </div>
      <div className="flex items-center gap-2">
        {pack ? <EvidencePackButton saved={saved} /> : null}
        {download ? <DownloadCsv href={certExportHref()} /> : null}
      </div>
    </header>
  );
}

/** The phone has no header bar: the same button, over the cards. */
export function PhonePack({ saved }: { saved: number | null }) {
  return (
    <div className="px-4 pb-1 pt-3 md:hidden">
      <EvidencePackButton saved={saved} className="max-md:h-input-touch max-md:w-full" />
    </div>
  );
}

/** Certificates that need a look: the pattern, one ask each. */
export function AttentionCard({ attention }: { attention: Attention }) {
  const lines = attentionGroupLines(attention.rows);
  const items: AttentionItem[] = attention.rows.map((r) => ({
    group: lines[attentionGroup(r)],
    state: r.state,
    supplier: r.supplier,
    what: r.what,
    note: r.note,
    action: (
      <ButtonLink href={r.askHref} kind="secondary" prefetch={false}>
        {r.askLabel}
      </ButtonLink>
    ),
  }));
  return <NeedsAttention items={items} total={attention.total} scope="Expired first, then expiring within 90 days" />;
}

/** Both certificate reads failed: said where the list was, never as "nothing needs attention". */
export function AttentionError({ retryHref }: { retryHref: string }) {
  return (
    <ErrorPanel
      title="We couldn't load your compliance checks."
      retry={
        <Link href={retryHref} prefetch={false} className={buttonClass({ kind: "primary", className: "max-md:h-input-touch" })}>
          Try again
        </Link>
      }
    >
      The certificate list did not answer. Your saved suppliers are safe.
    </ErrorPanel>
  );
}

/** One read of the two failed: the other still lists, and this says what is missing. */
export function PartialNote({ missing }: { missing: "expired" | "expiring" }) {
  return (
    <InlineError>
      {missing === "expired" ? "The expired certificates did not load. Certificates that lapse soon are listed below." : "The certificates that lapse soon did not load. Expired certificates are listed below."}
    </InlineError>
  );
}

function Card({ title, aside, children, className }: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-lg border border-line p-4", className)}>
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

/** "Forced labour: UFLPA checks": the three counts and what they are checked against. */
export function UflpaCard({ uflpa }: { uflpa: UflpaPayload | null }) {
  return (
    <Card
      title="Forced labour: UFLPA checks"
      aside={
        <Link href={UFLPA_HREF} prefetch={false} className={cn(textLink, "text-base max-md:flex max-md:min-h-11 max-md:items-center")}>
          Open
        </Link>
      }
    >
      {uflpa === null ? (
        <InlineError>We couldn&apos;t read the UFLPA checks.</InlineError>
      ) : (
        <>
          <dl className="flex flex-col">
            {uflpaCounts(uflpa).map((c) => (
              <div key={c.status} className="flex justify-between gap-3 border-b border-line py-1.5 last:border-b-0">
                <dt className="text-base text-ink-2">{UFLPA_WORDS[c.status].label}</dt>
                <dd className="text-base font-semibold tabular-nums text-ink">{c.count === 1 ? "1 supplier" : `${c.count} suppliers`}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-ink-3">UFLPA Entity List, US DHS. Entries added since our last read are not checked.</p>
        </>
      )}
    </Card>
  );
}

/** The statement is drafted in the browser and nothing is stored, so no card claims a draft in progress. */
export function MsaCard({ msa }: { msa: MsaSummary | null }) {
  return (
    <Card title="Modern slavery statement">
      <p className="text-sm text-ink-2">UK Modern Slavery Act 2015, section 54. Draft it from your saved suppliers. Nothing leaves your browser.</p>
      {msa ? <p className="text-xs text-ink-3">Built from {msa.total_published} published saved {msa.total_published === 1 ? "supplier" : "suppliers"}, {msa.rsc_covered} covered by the RSC.</p> : null}
      <ButtonLink href={MSA_HREF} kind="secondary" full prefetch={false} className="max-md:h-input-touch">
        Draft the statement
      </ButtonLink>
    </Card>
  );
}

/** "Certificate expiry dates": how many lapse in the next 90 days and the first, and the way to the whole list. */
export function ExpiryCard({ expiring, today }: { expiring: CertList | null; today: Date }) {
  const c = comingUp(expiring, today);
  return (
    <Card title="Expiry dates" className="gap-2">
      <p className="text-sm text-ink-2">{c.words}</p>
      <Link href={EXPIRY_HREF} prefetch={false} className={cn(textLink, "text-base max-md:flex max-md:min-h-11 max-md:items-center")}>
        See every expiry date
      </Link>
    </Card>
  );
}

/** The phone's line over the certificates: what none found means. */
export function PhoneUflpaNote({ uflpa, saved }: { uflpa: UflpaPayload | null; saved: number | null }) {
  const words = uflpaNote(uflpa, saved);
  if (!words) return null;
  return (
    <p className="flex items-start gap-2 px-4 pb-3 pt-2 text-base text-ink-2 md:hidden">
      <CheckCircle size={16} weight="fill" className="mt-1 shrink-0 text-ink-2" aria-hidden />
      {words}
    </p>
  );
}

/** No saved suppliers: the hub draws from the saved list. */
export function HubEmpty() {
  return (
    <div className="flex max-w-prose flex-col gap-3 px-6 py-10 max-md:px-4">
      <h2 className="text-lg font-semibold text-ink">No saved suppliers yet.</h2>
      <p className="text-md text-ink-2">Compliance checks the suppliers you save: their certificates, the UFLPA Entity List and a modern slavery statement draft.</p>
      <div className="pt-1">
        <Link href="/app" prefetch={false} className={buttonClass({ kind: "primary", size: "lg", className: "max-md:h-input-touch max-md:w-full" })}>
          Search suppliers
        </Link>
      </div>
    </div>
  );
}

export function ComplianceSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading compliance checks" className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-2 border-b border-line px-6 pb-4 pt-5 max-md:hidden">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Compliance</h1>
        <Skeleton className="h-3 w-[320px]" />
      </div>
      <div className="mx-6 mt-5 flex flex-col rounded-md border border-line max-md:mx-4" aria-hidden>
        {[
          [200, 120],
          [160, 140],
          [220, 100],
        ].map(([a, b], i) => (
          <div key={i} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
            <Skeleton className="size-5 shrink-0 rounded-full" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3.5" style={{ width: a }} />
              <Skeleton tone="subtle" className="h-3" style={{ width: b }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
