// Certificate expiry (Paper `10 · Compliance · certificate expiry, expired first`, `11 · Alerts ·
// certificate expiry`): every certificate on the saved suppliers that has lapsed with no renewal on
// file, then those lapsing inside 90 days, in three groups under a filter, one ask each. A real
// table from 768; on a phone each row is the date, the certificate, the supplier and a 48-tall Ask.
// Server components. Paper's "Follow-up: Not asked yet" is not here; the landing's rows read "asked
// 3 Oct 2026" from the RFQs sent to the supplier (`askedDates`), which is the record of the ask.
// Download CSV writes the certificates the filter shows (`/api/v1/export`).

import { ChatCircle, Clock, Hourglass, ShieldCheck, XCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { ButtonLink, Table, Td, Tr, Unpublished, rowLinkClass } from "@/components/kit";
import { DownloadCsv } from "@/components/export/download-csv";
import { LinkPending } from "@/components/patterns/link-pending";
import { cn } from "@/lib/utils";
import { BackToHub } from "./hub";
import { type UflpaNotice } from "./uflpa-read";
import { certExportHref, expiredHeading, expiryCounts, expiryHref, expiryItems, expirySubline, expiryTabs, shortDay, within30Heading, within90Heading, type CertItem, type ExpiryGroups, type ExpiryShow } from "./words";

export function ExpiryHead({ groups, saved, show, download }: { groups: ExpiryGroups; saved: number | null; show: ExpiryShow; download: boolean }) {
  const counts = expiryCounts(groups);
  const shown = show === "all" ? counts.all : show === "expired" ? counts.expired : show === "30" ? counts.within30 : counts.within90;
  return (
    <header className="flex shrink-0 flex-col gap-3 px-6 pb-3 pt-4 max-md:px-4 max-md:pt-1">
      <BackToHub />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-semibold tracking-tight text-ink max-md:hidden">Certificate expiry</h1>
          <p className="text-base text-ink-3 max-md:hidden">Ask suppliers for renewals before certificates expire.</p>
          <p className="text-base text-ink-3 md:hidden">{expirySubline(counts.all, saved)}</p>
        </div>
        <div className="flex items-center gap-3 max-md:w-full">
          <nav aria-label="Show" className="flex h-8 overflow-clip rounded-sm border border-line-strong max-md:hidden">
            {expiryTabs(counts).map((t, i) => (
              <Link
                key={t.show}
                href={expiryHref(t.show)}
                prefetch={false}
                aria-current={t.show === show ? "true" : undefined}
                className={cn(
                  "flex items-center px-3 text-sm leading-4 outline-none hover:bg-brand-wash focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus",
                  i > 0 && "border-l border-line-strong",
                  t.show === show ? "bg-brand-tint font-semibold text-ink" : "font-medium text-ink-2",
                )}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          {download && shown > 0 ? <DownloadCsv href={certExportHref(show)} className="max-md:h-input-touch" /> : null}
        </div>
      </div>
    </header>
  );
}

function Name({ i }: { i: CertItem }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <Link href={i.certHref} prefetch={false} className={rowLinkClass}>
        {i.scheme}
      </Link>
      {i.number ? <span className="font-mono text-sm text-ink-2">{i.number}</span> : null}
    </span>
  );
}

function GroupBar({ state, children }: { state: "expired" | "expiring"; children: React.ReactNode }) {
  const Glyph = state === "expired" ? XCircle : Clock;
  return (
    <div className="flex h-8 items-center gap-2 bg-caution-tint px-4 max-md:h-9">
      <Glyph size={16} weight="fill" className="shrink-0 text-caution-icon" aria-hidden />
      <h2 className="text-sm font-semibold text-caution max-md:text-base">{children}</h2>
    </div>
  );
}

function Group({ state, heading, items }: { state: "expired" | "expiring"; heading: string; items: readonly CertItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-label={heading}>
      <GroupBar state={state}>{heading}</GroupBar>
      <div className="max-md:hidden">
        <Table className="min-w-[860px]">
          <tbody>
            {items.map((i) => (
              <Tr key={i.key}>
                <Td className="w-[210px] pl-4">
                  <span className="font-medium text-caution">{i.when}</span>
                  {i.relative ? <span className="block text-xs text-ink-3">{i.relative}</span> : null}
                </Td>
                <Td className="w-[190px]">
                  <Name i={i} />
                </Td>
                <Td className="w-[260px]">
                  <span className="font-medium text-ink">{i.supplier}</span>
                  {i.place ? <span className="text-ink-3"> · {i.place}</span> : null}
                </Td>
                <Td className="w-[180px]">{i.issuer ?? <Unpublished>Not listed</Unpublished>}</Td>
                <Td align="right" className="pr-2">
                  <ButtonLink href={i.askHref} kind="secondary" prefetch={false}>
                    {i.askLabel}
                  </ButtonLink>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
    </section>
  );
}

/** "GOTS expired 8 Oct · 3 days ago", "WRAP ends 15 Oct · in 4 days": the phone row's first line. */
export function phoneWhen(i: CertItem, today: Date): string {
  if (i.when.startsWith("No longer listed")) return i.when;
  const day = shortDay(i.expiresOn, today) ?? i.expiresOn;
  if (i.state === "expiring") return `${i.scheme} ends ${day}${i.relative ? ` · ${i.relative}` : ""}`;
  const ago = -i.days;
  return `${i.scheme} expired ${day}${ago > 0 ? ` · ${ago} ${ago === 1 ? "day" : "days"} ago` : ""}`;
}

/**
 * Alerts on a phone (Paper page 36 `alerts`): the UFLPA result of the saved suppliers in one card,
 * then the certificates the filter shows, expired first, with how many have expired over a meter,
 * one card of rows with Ask for it each.
 */
export function ExpiryPhone({ groups, show, uflpa, today }: { groups: ExpiryGroups; show: ExpiryShow; /** `uflpaNotice`; null when the check was not read. */ uflpa: UflpaNotice | null; today: Date }) {
  const items = expiryItems(groups, show);
  const expired = items.filter((i) => i.state === "expired").length;
  // Nothing to say: no empty padded box over the page's own sentence.
  if (!uflpa && items.length === 0) return null;
  return (
    <div className="flex flex-col gap-5 px-5 pb-6 pt-2 md:hidden">
      {uflpa ? (
        <div className={cn("flex gap-3 rounded-[12px] p-3.5", uflpa.hit ? "bg-caution-tint" : "bg-subtle")}>
          <ShieldCheck size={20} className={cn("shrink-0", uflpa.hit ? "text-caution-icon" : "text-ink-3")} aria-hidden />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className={cn("text-[15px]/[21px] font-medium", uflpa.hit ? "text-caution" : "text-ink")}>UFLPA Entity List</p>
            <p className={cn("text-sm", uflpa.hit ? "text-caution" : "text-ink-2")}>{uflpa.line}</p>
          </div>
        </div>
      ) : null}
      {items.length > 0 ? (
        <section aria-labelledby="alerts-certs" className="flex flex-col">
          <div className="flex items-baseline justify-between pb-3.5 pt-1">
            <h2 id="alerts-certs" className="flex items-baseline gap-2 text-lg font-medium tracking-tight text-ink">
              Certificates <span className="font-normal text-ink-3">{items.length}</span>
            </h2>
            <span className="text-sm text-ink-3">Expired first</span>
          </div>
          <div className="flex flex-col gap-1.5 pb-4">
            <div className="flex justify-between text-sm">
              <span className="text-ink-2">Expired</span>
              <span className="font-medium tabular-nums text-ink">
                {expired} of {items.length}
              </span>
            </div>
            <div className="flex h-1.5 shrink-0 overflow-clip rounded-full bg-sunken">
              <div className="rounded-full bg-caution-icon" style={{ width: `${Math.round((expired / items.length) * 100)}%` }} />
            </div>
          </div>
          <ul className="flex flex-col overflow-clip rounded-[10px] border border-line">
            {items.map((i) => (
              <li key={i.key} className="flex flex-col gap-2 border-t border-line p-4 first:border-t-0">
                <p className="flex items-center gap-1.5 text-xs font-medium text-caution">
                  <Hourglass size={16} className="shrink-0 text-caution-icon" aria-hidden />
                  {phoneWhen(i, today)}
                </p>
                <Link href={i.certHref} prefetch={false} className="flex items-center gap-1.5 self-start rounded-sm text-md/[22px] font-medium text-ink outline-none active:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
                  {i.supplier}
                  <LinkPending />
                </Link>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5 text-xs">
                    {i.number ? <span className="font-mono text-ink-2">{i.number}</span> : null}
                    <span className="text-ink-3">{i.issuer ? `Issued by ${i.issuer}` : i.scheme}</span>
                  </div>
                  <Link href={i.askHref} prefetch={false} className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-sunken px-3.5 text-base font-medium text-ink outline-none active:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">
                    <ChatCircle size={16} className="shrink-0" aria-hidden />
                    Ask for it
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** The groups the filter shows, each under its own bar. */
export function ExpiryList({ groups, show }: { groups: ExpiryGroups; show: ExpiryShow }) {
  const all = show === "all";
  return (
    <div className="mx-6 mb-6 flex flex-col overflow-clip rounded-md border border-line max-md:hidden">
      <div className="flex h-9 items-center border-b border-line bg-subtle text-xs font-semibold text-ink-3 max-md:hidden">
        <span className="w-[210px] pl-4">Expires</span>
        <span className="w-[190px] px-3">Certificate</span>
        <span className="w-[260px] px-3">Supplier</span>
        <span className="w-[180px] px-3">Issued by</span>
      </div>
      {all || show === "expired" ? <Group state="expired" heading={expiredHeading(groups.expired.length)} items={groups.expired} /> : null}
      {all || show === "30" ? <Group state="expiring" heading={within30Heading(groups.within30.length)} items={groups.within30} /> : null}
      {all || show === "90" ? <Group state="expiring" heading={within90Heading(groups.within90.length)} items={groups.within90} /> : null}
    </div>
  );
}

/** Nothing on a filter, or nothing at all: a sentence, with the way back to every date. */
export function ExpiryNone({ show, anyRead }: { show: ExpiryShow; anyRead: boolean }) {
  return (
    <div className="flex flex-col gap-1 px-6 py-8 max-md:px-4">
      <p className="text-md font-semibold text-ink">{!anyRead ? "The certificate dates did not load" : show === "all" ? "Nothing needs a look" : "No certificate in this group"}</p>
      <p className="text-base text-ink-2">
        {!anyRead
          ? "No certificate dates could be read. Your saved suppliers are safe."
          : show === "all"
            ? "No certificate on your saved suppliers has expired without a renewal or expires in the next 90 days."
            : "Every certificate on your saved suppliers is in another group."}
      </p>
      {!anyRead ? (
        <Link href={expiryHref(show)} prefetch={false} className="pt-2 text-base font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font]">
          Try again
        </Link>
      ) : null}
      {show === "all" || !anyRead ? null : (
        <Link href={expiryHref("all")} prefetch={false} className="pt-2 text-base font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font]">
          Show every certificate
        </Link>
      )}
    </div>
  );
}
