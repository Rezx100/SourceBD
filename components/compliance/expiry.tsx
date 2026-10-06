// Certificate expiry (Paper `10 · Compliance · certificate expiry, expired first`, `11 · Alerts ·
// certificate expiry`): every certificate on the saved suppliers that has lapsed with no renewal on
// file, then those lapsing inside 90 days, in three groups under a filter, one ask each. A real
// table from 768; on a phone each row is the date, the certificate, the supplier and a 48-tall Ask.
// Server components. Paper's "Follow-up: Not asked yet" is not here: nothing records whether a
// supplier was asked. Download CSV writes the certificates the filter shows (`/api/v1/export`).

import { Clock, XCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { ButtonLink, Table, Td, Tr, Unpublished, rowLinkClass } from "@/components/kit";
import { DownloadCsv } from "@/components/export/download-csv";
import { cn } from "@/lib/utils";
import { BackToHub } from "./hub";
import { certExportHref, expiredHeading, expiryCounts, expiryHref, expirySubline, expiryTabs, within30Heading, within90Heading, type CertItem, type ExpiryGroups, type ExpiryShow } from "./words";

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
                  "flex items-center px-3 text-sm leading-4 outline-none hover:bg-brand-wash focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand",
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
    <div className={cn("flex h-8 items-center gap-2 px-4 max-md:h-9", state === "expired" ? "bg-danger-tint" : "bg-caution-tint")}>
      <Glyph size={16} weight="fill" className={cn("shrink-0", state === "expired" ? "text-danger" : "text-caution-icon")} aria-hidden />
      <h2 className={cn("text-sm font-semibold max-md:text-base", state === "expired" ? "text-danger" : "text-caution")}>{children}</h2>
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
                  <span className={cn("font-medium", i.state === "expired" ? "text-danger" : "text-caution")}>{i.when}</span>
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
      <ul className="md:hidden">
        {items.map((i) => (
          <li key={i.key} className="flex items-center gap-3 border-b border-line px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className={cn("text-base font-medium", i.state === "expired" ? "text-danger" : "text-caution")}>
                {i.when}
                {i.relative ? <span className="font-normal text-ink-3"> · {i.relative}</span> : null}
              </p>
              <p className="flex items-baseline gap-1.5 text-md font-medium text-ink">
                {i.scheme}
                {i.number ? <span className="font-mono text-sm font-normal text-ink-2">{i.number}</span> : null}
              </p>
              <p className="text-base text-ink-2">{i.supplier}</p>
            </div>
            <ButtonLink href={i.askHref} kind="secondary" size="touch" prefetch={false} className="h-12 shrink-0">
              Ask
            </ButtonLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The groups the filter shows, each under its own bar. */
export function ExpiryList({ groups, show }: { groups: ExpiryGroups; show: ExpiryShow }) {
  const all = show === "all";
  return (
    <div className="mx-6 mb-6 flex flex-col overflow-clip rounded-md border border-line max-md:mx-0 max-md:rounded-none max-md:border-x-0">
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
        <Link href={expiryHref(show)} prefetch={false} className="pt-2 text-base font-medium text-brand underline decoration-1 [text-underline-position:from-font]">
          Try again
        </Link>
      ) : null}
      {show === "all" || !anyRead ? null : (
        <Link href={expiryHref("all")} prefetch={false} className="pt-2 text-base font-medium text-brand underline decoration-1 [text-underline-position:from-font]">
          Show every certificate
        </Link>
      )}
    </div>
  );
}
