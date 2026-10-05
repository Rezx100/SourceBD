// The public supplier record (B9g; Paper `30 Marketing · Public supplier page`): the same record a buyer sees, drawn for
// a visitor who is not signed in. One page, no tabs and no query: every section is in the first HTML (the page is
// static and cached for five minutes, so nothing here may read the URL or a cookie). The name and the five-cell summary
// of what the registers hold, "Needs a look" and the key facts, the certificates, safety, sites, products and sources,
// and beside them Contact, which is locked: Save and Send RFQ are "Sign up" links that come back to this record.
// The model is the buyer record's own (`buildSheet`), so it holds counts of contact details at most and never a value;
// here it holds not even the counts. A sanctioned record keeps the solid band and the refusal in words.

import Link from "next/link";
import { buttonClass } from "@/components/kit";
import { REFUSAL, SanctionBanner, SourceList, type SourceEntry } from "@/components/patterns";
import type { SupplierSheetModel } from "@/lib/dashboard/models";
import { cn } from "@/lib/utils";
import { CertificatesPanel, OverviewPanel, ProductsPanel, SafetyPanel, SitesPanel, SourcesPanel } from "./panels";
import { Summary } from "./record-view";
import { TABS, dayOfWords, recordSubline, summaryCells, tabCount, type TabId } from "./words";

const SECTION: Record<TabId, string> = { overview: "Overview", certificates: "Certificates", safety: "Safety", sites: "Sites", sources: "Sources", products: "Products" };

export const PUBLIC_NOTICE =
  "Authority logos identify the data sources we aggregate from. SourceBD is not affiliated with or endorsed by BGMEA, BKMEA, BTMA, EPB, OEKO-TEX, WRAP, GOTS, RSC, or any of the brands named on this page. Every datum traces to the issuing authority shown in Sources.";

function signUp(slug: string) {
  return `/signup?next=${encodeURIComponent(`/suppliers/${slug}`)}`;
}

function Contact({ slug, sanctioned }: { slug: string; sanctioned: boolean }) {
  return (
    <section aria-label="Contact" className="flex w-full max-w-details flex-col gap-3 rounded-lg border border-line p-4">
      <h2 className="text-base font-semibold text-ink">Contact</h2>
      <p className="text-sm text-ink-2">Contact details are locked. Sign up free and send an RFQ; the supplier replies in SourceBD.</p>
      {sanctioned ? (
        <p className="text-sm font-medium text-sanction">{REFUSAL}</p>
      ) : (
        <Link href={signUp(slug)} prefetch={false} className={buttonClass({ kind: "primary" })}>
          Sign up to contact
        </Link>
      )}
    </section>
  );
}

export function PublicRecord({ model, today }: { model: SupplierSheetModel; today: Date }) {
  const slug = model.slug;
  const cells = summaryCells(model, today);
  const list = model.sanctions[0] ?? null;
  const listName = list?.list ?? "sanctions list";
  const sources: SourceEntry[] = model.sources.map((s) => ({ source: s.mark.code, label: s.mark.label, fullName: s.name, checkedOn: dayOfWords(s.readDate) }));
  const sitesHref = `/suppliers/${slug}`;
  const sections: { id: TabId; body: React.ReactNode }[] = [
    { id: "overview", body: <OverviewPanel model={model} today={today} /> },
    { id: "certificates", body: <CertificatesPanel model={model} today={today} /> },
    { id: "safety", body: <SafetyPanel model={model} /> },
    { id: "sites", body: <SitesPanel model={model} tabHref={() => sitesHref} site={null} wide /> },
    { id: "products", body: <ProductsPanel model={model} /> },
    { id: "sources", body: <SourcesPanel model={model} today={today} /> },
  ];
  return (
    <section aria-label="Supplier record" data-record="public" className="flex flex-col bg-surface">
      {model.sanctioned ? (
        <SanctionBanner
          title={`On the ${listName}${list?.listedOn ? ` since ${list.listedOn}` : ""}.`}
          detail={`${REFUSAL} From the ${listName}${list?.screenedOn ? ` · checked ${list.screenedOn}` : ""}.`}
        />
      ) : null}

      <header className="mx-auto flex w-full max-w-[1200px] flex-col gap-1.5 px-4 pb-3 pt-8 sm:px-6 lg:px-10">
        <p className="font-mono text-sm text-ink-3">Public record · {model.sources.length} sources</p>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <h1 className="min-w-0 flex-1 basis-60 text-3xl font-semibold tracking-tight text-ink [overflow-wrap:anywhere] max-sm:text-2xl">{model.name}</h1>
          <div className="flex shrink-0 items-center gap-2">
            <Link href={signUp(slug)} prefetch={false} className={buttonClass({ kind: "secondary" })}>
              Save
            </Link>
            {model.sanctioned ? <span className="text-base font-medium text-sanction">{REFUSAL}</span> : (
              <Link href={signUp(slug)} prefetch={false} className={buttonClass({ kind: "primary" })}>
                Sign up to contact
              </Link>
            )}
          </div>
        </div>
        <p className="text-base text-ink-2 max-sm:text-md">{recordSubline(model)}</p>
      </header>

      <div className="mx-auto flex w-full max-w-[1200px] gap-8 px-4 pb-12 pt-4 sm:px-6 lg:px-10">
        <div className="flex min-w-0 flex-1 flex-col gap-8">
          <Summary cells={cells} />
          <nav aria-label="Record sections" className="-mx-4 flex gap-4 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
            {TABS.map((t) => {
              const n = tabCount(model, t.id);
              return (
                <a key={t.id} href={`#${t.id}`} className="flex min-h-11 shrink-0 items-center gap-1.5 text-md font-medium text-ink-2 hover:text-ink sm:min-h-10 sm:text-base">
                  {SECTION[t.id]}
                  {n ? <span className="text-xs text-ink-3">{n}</span> : null}
                </a>
              );
            })}
          </nav>
          {sections.map((s) => (
            <section key={s.id} id={s.id} aria-label={SECTION[s.id]} className="flex scroll-mt-16 flex-col gap-3">
              <h2 className="text-xl font-semibold tracking-tight text-ink">{SECTION[s.id]}</h2>
              {s.body}
            </section>
          ))}
          <div className="lg:hidden">
            <Contact slug={slug} sanctioned={model.sanctioned} />
          </div>
        </div>
        <aside aria-label="Contact and sources" className={cn("hidden w-details shrink-0 flex-col gap-4 pt-1 lg:flex")}>
          <Contact slug={slug} sanctioned={model.sanctioned} />
          {sources.length > 0 ? <SourceList sources={sources} today={today} /> : null}
        </aside>
      </div>

      <p className="mx-auto mb-8 max-w-[640px] px-4 text-center text-sm text-ink-3">{PUBLIC_NOTICE}</p>
    </section>
  );
}
