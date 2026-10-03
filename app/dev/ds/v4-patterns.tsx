// /dev/ds, third v4 section: the patterns of Paper's `03 Patterns` (B2, 4 Oct 2026) built on
// the kit. Sample states use placeholders, as the boards do: no published supplier is
// sanctioned, no real quote or order exists yet, and real export rows stay in Paper (private).
// The components answer to the viewport: shrink the window under 640px for the phone forms.

import type { ReactNode } from "react";
import { Button, FactChip, Table, TableFrame, Td, Th, Tr, Unpublished } from "@/components/kit";
import {
  AcceptSummary,
  Bubble,
  CertProblem,
  CertTable,
  ChatThread,
  ClaimRail,
  ConfirmedClaim,
  DateLine,
  ExportsFreshness,
  ExportsSummary,
  ExportsTable,
  FactList,
  FactRow,
  FileChip,
  LockedContact,
  LockedContactRow,
  MapCard,
  NeedsAttention,
  OpenClaim,
  PinLegend,
  QuoteComparison,
  Refusal,
  RscBlock,
  SanctionBanner,
  SanctionDropped,
  SanctionTag,
  SiteList,
  SourceGroups,
  SourceList,
  SourcesCell,
  SupplierRow,
  Timeline,
  sanctionRowClass,
  type RscBlockData,
} from "@/components/patterns";
import { cn } from "@/lib/utils";

const TODAY = new Date("2026-10-03T00:00:00Z");
const LONG_NAME = "Zaheen Knitwears Limited (Shed - 3, 4, 5, 10, 11, 12, 13) & (Building - Security, ETP and Fire Pump)";

function Block({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-line pt-6 first:border-t-0 first:pt-0" data-pattern={title}>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {note ? <p className="max-w-prose text-sm text-ink-3">{note}</p> : null}
      {children}
    </section>
  );
}

const ALL_SOURCES = ["EPB", "RSC", "BGMEA", "BKMEA", "BGAPMEA", "GOTS", "OEKO-TEX", "WRAP", "ASOS", "H&M", "Next"];

const RSC_FULL: RscBlockData = {
  factoryId: "9342",
  covered: true,
  remediation: "100% of initial items fixed",
  training: "Completed",
  workers: "2,662 workers",
  reports: { Fire: "#", Electrical: "#", Structural: "#", Boiler: "#", "Corrective action plan": "#" },
  checkedOn: "30 Jul 2026",
};
const RSC_LAPSED: RscBlockData = {
  factoryId: "10902",
  covered: false,
  remediation: "42% of initial items fixed",
  training: "Yet to start",
  workers: "250 workers",
  reports: { Fire: "#", Electrical: "#", Structural: "#", Boiler: null, "Corrective action plan": "#" },
  checkedOn: "24 Jul 2026",
};

export function V4Patterns() {
  return (
    <div className="space-y-10">
      <Block title="Source marks" note="A 24px mark with its short name in words, in tier order, each group named. Brand supplier lists are names in a dashed frame, never logos. 03 Patterns · 1.">
        <SourceGroups sources={ALL_SOURCES} />
        <div className="flex flex-wrap items-start gap-8">
          <SourceList
            today={TODAY}
            sources={[
              { source: "EPB", checkedOn: "2026-08-14" },
              { source: "RSC", checkedOn: "2026-09-18" },
              { source: "BGMEA", checkedOn: "2026-07-24" },
              { source: "BKMEA", checkedOn: "2026-06-26" },
              { source: "ASOS", checkedOn: "2026-05-02" },
            ]}
          />
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-ink-3">A table cell: three marks and the rest with its noun</p>
            <SourcesCell sources={ALL_SOURCES} />
          </div>
        </div>
      </Block>

      <Block title="Fact row" note="Label, value with its unit, the source in words with its date. A chip only when something is wrong. 03 Patterns · 2.">
        <FactList className="max-w-pane">
          <FactRow label="BGMEA reg. no." values={[{ value: "3498", mono: true, source: "From BGMEA · checked 24 Jul 2026" }]} />
          <FactRow label="BGAPMEA member no." values={[{ value: "597", mono: true, source: "From BGAPMEA" }]} chip={<FactChip state="stale">Last checked 26 Jun 2026</FactChip>} />
          <FactRow
            label="Workforce"
            values={[
              { value: "4,200 employees", source: "As declared to BGMEA · checked 24 Jul 2026" },
              { value: "1,230 workers", source: "Counted by RSC, factory 10861 · checked 24 Jul 2026" },
            ]}
            chip={<FactChip state="disagree">Sources disagree</FactChip>}
          />
          <FactRow label="BKMEA membership" values={[{ value: "625 - B/2002", mono: true, source: "From BKMEA · page changed 22 Sep 2026" }]} chip={<FactChip state="changed">Source page changed</FactChip>} />
          <FactRow label="Year founded" values={[{ value: "1985", source: "Source not linked yet. It is one of the 11 sources." }]} />
          <FactRow label="Lead time" empty="Ask in your RFQ." chip={<FactChip state="notOnFile">Not published</FactChip>} />
        </FactList>
      </Block>

      <Block title="Certificate row" note="Problems sort first: expired, expiring, valid, no expiry on file. Within 30 days the chip counts down; 31 to 90 days it shows the date. 03 Patterns · 3.">
        <CertTable
          today={TODAY}
          from="From GOTS, OEKO-TEX and WRAP"
          certs={[
            { scheme: "OEKO-TEX Standard 100", number: "32597-100", issuer: "OEKO-TEX", expiresOn: null, documentUrl: "#", documentLabel: "Open label check" },
            { scheme: "GOTS", number: "GOTS-31587", issuer: "TÜV Rheinland (China) Ltd.", expiresOn: "2027-05-12", documentUrl: "#" },
            { scheme: "WRAP", number: "7865", issuer: "WRAP", expiresOn: "2026-09-29", documentUrl: "#" },
            { scheme: "GOTS", number: "GOTS-26992", issuer: "IDFL Laboratory and Institute Inc.", expiresOn: "2026-10-08", documentUrl: "#" },
            { scheme: "WRAP", number: "15037", issuer: "WRAP", expiresOn: "2026-11-19", documentUrl: "#" },
          ]}
        />
      </Block>

      <Block title="RSC block" note="Facts as text, five report links, a missing one as a plain line. Never a progress bar. 03 Patterns · 4.">
        <div className="flex flex-wrap items-start gap-8">
          <RscBlock data={RSC_FULL} className="w-full max-w-pane" />
          <RscBlock data={RSC_LAPSED} className="w-full max-w-pane" />
        </div>
      </Block>

      <Block title="Sanction banner" note="A sample state with placeholders: no published supplier is sanctioned. No close button, Send RFQ refused in words wherever the supplier appears. 03 Patterns · 5.">
        <div className="flex max-w-pane flex-col overflow-clip rounded-lg border border-line">
          <SanctionBanner title="On the UFLPA Entity List since [date of listing]." detail="You can't send this supplier an RFQ. From the DHS UFLPA Entity List · checked [date]." />
          <div className="flex flex-col gap-1 p-5">
            <p className="text-xl font-semibold tracking-tight text-ink-3">[Supplier name]</p>
            <p className="text-base text-ink-3">Factory · [district]</p>
          </div>
          <div className="flex h-16 items-center justify-between gap-3 border-t border-line px-5">
            <Refusal />
            <Button>Save</Button>
          </div>
        </div>
        <div className="flex max-w-[470px] flex-col gap-4">
          <div className={cn("flex h-10 items-center gap-3 rounded-sm border-l-2 border-sanction px-3 bg-sanction-tint")}>
            <span className="flex-1 text-base font-medium text-ink-3">[Supplier name]</span>
            <SanctionTag list="UFLPA Entity List" />
          </div>
          <SanctionDropped count={1} list="UFLPA Entity List" />
        </div>
      </Block>

      <Block title="Locked contact" note="Counts with their nouns, never a value: contact is gated on the server. 03 Patterns · 6.">
        <div className="flex flex-wrap items-start gap-8">
          <LockedContact emails={1} phones={4} action={<Button kind="primary">Send RFQ</Button>} />
          <LockedContact emails={0} phones={0} />
          <div className="w-full max-w-[392px] overflow-clip rounded-lg border border-line">
            <LockedContactRow emails={1} phones={4} />
          </div>
        </div>
      </Block>

      <Block title="Supplier list row" note="The narrow forms: with the pane docked, and on a phone. A long name wraps; nothing is cut off. The wide row is a row of the table. 03 Patterns · 7.">
        <div className="flex flex-wrap items-start gap-8">
          <div className="w-full max-w-[440px] overflow-clip rounded-md border border-line">
            <SupplierRow layout="pane" href="#" name="Aboni Knitwear Ltd." type="Factory" place="Dhaka" sources={11} selected problem={<CertProblem small state="expired">WRAP expired 29 Sep 2026</CertProblem>} />
            <SupplierRow layout="pane" href="#" name="Hossain Dyeing & Printing Mills Ltd." type="Factory" place="Gazipur" sources={1} problem={<CertProblem small state="none">OEKO-TEX, no expiry date published</CertProblem>} />
            <SupplierRow layout="pane" href="#" name="A.R. Fashion" type="Buying house" place={null} sources={1} />
          </div>
          <div className="w-full max-w-[390px] overflow-clip rounded-lg border border-line">
            <SupplierRow layout="phone" href="#" name="Aboni Knitwear Ltd." type="Factory" place="Dhaka" sources={11} problem={<CertProblem state="expired" more={3}>WRAP expired 29 Sep 2026</CertProblem>} />
            <SupplierRow layout="phone" href="#" name={LONG_NAME} type="Factory" place="Narayanganj" sources={1} problem={<span className="text-ink-3">No certificates found</span>} />
          </div>
        </div>
        <TableFrame>
          <Table>
            <thead>
              <tr>
                <Th>Supplier</Th>
                <Th>Certificates</Th>
              </tr>
            </thead>
            <tbody>
              <Tr className={sanctionRowClass}>
                <Td className="font-medium text-ink-3">[Supplier name]</Td>
                <Td>
                  <SanctionTag list="UFLPA Entity List" />
                </Td>
              </Tr>
              <Tr>
                <Td className="font-medium text-ink">A.R. Fashion</Td>
                <Td>
                  <Unpublished>None found</Unpublished>
                </Td>
              </Tr>
            </tbody>
          </Table>
        </TableFrame>
      </Block>

      <Block title="Quote comparison" note="A sample state: the RFQ and the suppliers are real, every figure is a sample and says so. Best against target first; no-reply rows stay. 03 Patterns · 8.">
        <QuoteComparison
          sample
          title="Men's heavyweight French terry hoodies, 420gsm"
          quantity={10000}
          shipBy="15 Oct 2026"
          target={6.5}
          quotes={[
            { status: "quoted", supplier: "S M Knitwears Limited", price: 6.9, moq: 12000, leadDays: 75, validUntil: "25 Oct 2026", action: <Button>Accept quote</Button> },
            { status: "no-reply", supplier: "Thermax Woven Dyeing Ltd.", sentOn: "18 Jul 2026", action: <Button kind="quiet">Send reminder</Button> },
            { status: "quoted", supplier: "Aboni Knitwear Ltd.", price: 6.15, moq: 3000, leadDays: 60, validUntil: "30 Oct 2026", action: <Button kind="primary">Accept quote</Button> },
          ]}
        />
        <div className="max-w-[358px]">
          <AcceptSummary sample price={6.15} quantity={10000} leadDays={60} />
        </div>
      </Block>

      <Block title="Order timeline" note="A sample state. Done a filled check, now a brand ring, planned a dashed circle; a passed plan says how late it is. On a phone the done ones fold into a line. 03 Patterns · 9.">
        <Timeline
          today={TODAY}
          className="max-w-pane"
          items={[
            { name: "PO issued", status: "done", on: "2026-08-22", byline: "Logged by you" },
            { name: "Lab dips approved", status: "done", on: "2026-09-05", byline: "Logged by you" },
            { name: "Fabric in house", status: "done", on: "2026-09-19", byline: "Logged by Aboni Knitwear Ltd. · 3 photos" },
            { name: "Trims in house", status: "planned", on: "2026-09-30", byline: "Planned by Aboni Knitwear Ltd. · not logged yet" },
            { name: "Bulk cutting started", status: "now", on: "2026-10-02", byline: "Logged by Aboni Knitwear Ltd." },
            { name: "Final inspection", status: "planned", on: "2026-11-06", byline: "Planned by Aboni Knitwear Ltd." },
            { name: "Ex-factory, by sea from Chittagong", status: "planned", on: "2026-11-14", byline: "Planned by Aboni Knitwear Ltd." },
          ]}
        />
      </Block>

      <Block title="Chat" note="A sample state. The supplier on the left, you on the right; the date once per day, times on bubbles, Read once under your last message. The composer is B6's. 03 Patterns · 10.">
        <div className="flex h-[520px] max-w-pane flex-col overflow-clip rounded-lg border border-line">
          <ChatThread>
            <DateLine>2 Oct 2026</DateLine>
            <Bubble from="them" meta="Aboni Knitwear Ltd. · 10:12">
              We received your RFQ for 10,000 hoodies. Please share the tech pack and the fabric composition.
            </Bubble>
            <Bubble from="you" meta="You · 11:05">
              Tech pack attached. Fabric is 80% cotton, 20% polyester, 420gsm brushed back.
              <FileChip name="Tech pack · hoodie 420gsm.pdf" detail="PDF · 2.1 MB" />
            </Bubble>
            <Bubble from="them" meta="Aboni Knitwear Ltd. · 11:20">
              Thank you. We will send the quote by Monday.
            </Bubble>
            <Bubble from="you" meta="You · 11:22" read>
              Thank you, Monday works.
            </Bubble>
          </ChatThread>
        </div>
      </Block>

      <Block title="Needs attention" note="One row per problem on the saved suppliers, with one action. Empty is a sentence. 03 Patterns · 11.">
        <NeedsAttention
          className="max-w-[760px]"
          items={[
            { state: "expired", supplier: "Aboni Knitwear Ltd.", what: "WRAP 7865 expired 29 Sep 2026.", note: "No renewal on file.", action: <Button>Ask for the new certificate</Button> },
            { state: "expiring", supplier: "Mondol Intimates Ltd.", what: "GOTS-26992 expires in 5 days, 8 Oct 2026.", action: <Button>Ask for the renewal</Button> },
          ]}
        />
        <NeedsAttention items={[]} className="max-w-[760px]" />
      </Block>

      <Block title="Locations" note="One clean address per site, its kind and precision in words. The map is the existing Barikoi capture (B4 wires it and the two-way selection). 03 Patterns · 12.">
        <div className="flex flex-wrap items-start gap-8">
          <SiteList
            selected={1}
            className="w-full max-w-[460px]"
            sites={[
              { n: 1, kind: "factory-exact", address: "Plot 169–171, Hemayetpur, Tetuljhora Union, Savar, Dhaka 1340", note: "From BGMEA, BKMEA and OEKO-TEX", href: "#" },
              { n: 2, kind: "factory-exact", address: "Kandi Baliarpur, Horindhara, Tetuljhora Union, Savar, Dhaka 1340", note: "From BGAPMEA", href: "#" },
              { n: 3, kind: "office", address: "2B/1 Darussalam Road, Mirpur 1, Dhaka 1216", note: "From BGMEA, BKMEA and BGAPMEA", href: "#" },
              { n: 4, kind: "factory-approx", address: "Nayapara, Kashimpur, Gazipur", note: "The pin marks the area, not the building.", href: "#" },
            ]}
          />
          <div className="flex w-full max-w-[360px] flex-col gap-4">
            <PinLegend />
            <MapCard count={3} summary="2 factory sites in Savar · 1 office in Mirpur" href="#" map={<div className="size-full bg-sunken" />} />
          </div>
        </div>
      </Block>

      <Block title="Statement claim to confirm" note="Anything only the buyer can know stays a marked gap until they confirm it; Download is blocked and says why. 03 Patterns · 13.">
        <div className="flex flex-wrap items-start gap-8">
          <div className="flex w-full max-w-pane flex-col gap-4 rounded-lg border border-line px-10 py-8 max-sm:px-5">
            <p className="text-xs font-semibold text-ink-3">Modern slavery statement · draft · Supply chain in Bangladesh</p>
            <p className="text-md text-ink">
              We worked with <OpenClaim>how many suppliers in Bangladesh</OpenClaim> suppliers. Our team visited <OpenClaim focused>which factories you visited</OpenClaim> in person.
            </p>
            <p className="text-md text-ink">
              We ask every supplier for its <ConfirmedClaim>factory list and audit reports</ConfirmedClaim> before the first order.
            </p>
            <p className="text-xs text-ink-3">Dashed amber = a claim only you can confirm. Underlined = confirmed by you on 3 Oct 2026.</p>
          </div>
          <ClaimRail
            downloadHref="#"
            claims={[
              { label: "How many suppliers in Bangladesh", action: <Button>Fill in</Button> },
              { label: "Which factories you visited", action: <Button>Fill in</Button> },
            ]}
          />
        </div>
      </Block>

      <Block title="Exports" note="A sample state. Totals say how many rows they come from; real rows stay in Paper (private), so the names below are placeholders. 03 Patterns · 14.">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm text-ink-3">Exports · Example Factory Ltd. · 3 export records</p>
          <ExportsFreshness latest="28 Feb 2026" />
        </div>
        <ExportsSummary
          stats={[
            { label: "Pieces, last 12 months", value: "98,000 pieces", note: "From 3 records" },
            { label: "FOB per piece, by HS code", value: "US$2.05 to US$4.06", note: "3 HS codes, 1 record each" },
            { label: "Destinations", value: "Spain, Canada", note: "2 records and 1 record" },
            { label: "Buyers", value: "3 buyers", note: "Example Buyer A in 1 record" },
            { label: "Latest export", value: "28 Feb 2026", note: "Newest of 3 records" },
          ]}
        />
        <ExportsTable
          rows={[
            { date: "28 Feb 2026", product: "Women's dresses, cotton knit", hs: "61044200", pieces: 30000, fobPerPiece: 4.06, fobValue: 121800, buyer: "Example Buyer A", destination: "Spain", mode: "Sea", detail: ["Left from Chittagong customs house", "Net weight 6,000 kg", "Gross weight 8,000 kg"] },
            { date: "27 Feb 2026", product: "Women's tank tops, cotton knit", hs: "61091000", pieces: 38000, fobPerPiece: 2.05, fobValue: 77900, buyer: "Example Buyer B", destination: "Canada", mode: "Sea" },
            { date: "26 Feb 2026", product: "Women's pyjama sets, cotton knit", hs: "61082100", pieces: 30000, fobPerPiece: 3.1, fobValue: 93000, buyer: "Example Buyer C", destination: "Canada", mode: "Air" },
          ]}
        />
      </Block>
    </div>
  );
}
