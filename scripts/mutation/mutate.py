#!/usr/bin/env python3
"""Positive control for cycle 6's guards (closed-loop §16).

Each entry reverts one repair in a SOURCE file (never a test), runs the
dashboard suite, and records whether the suite went red. A guard that stays
green under its own revert is not a guard.
"""
import io, json, os, signal, subprocess, sys

# The sweep rewrites source files. It must therefore never run in the tree the
# author commits from: three commits on this branch were made while a sweep was
# in flight, each swept up the live mutant, and two of them shipped it — the
# branch then sat red for two commits while every CI check stayed green.
# `MUTATE_ROOT` is a worktree of its own, checked out at the frozen candidate.
ROOT = os.environ.get("MUTATE_ROOT") or os.path.expanduser("~/sb-mut")
OUT = os.environ.get("MUTATE_OUT") or os.path.expanduser("~/gate/mutations")
# The command that decides RED vs GREEN. It takes the root as its argument.
TEST_CMD = os.environ.get("MUTATE_TEST") or os.path.expanduser("~/dash-test.sh")

M = [
 ('f2-ownPill-ignores-inherited', 'lib/dashboard/build-models.ts', '  return !x.building_name && !x.inherited_from;', '  return !x.building_name;'),
 ('f3-registers-negative-bare',
 'lib/dashboard/build-models.ts',
 '  const buildings = pillBuildings(p);\n  if (buildings.length === 0) return MEMBERSHIP_WORDS;',
 '  const buildings = pillBuildings(p);\n  if (buildings.length >= 0) return MEMBERSHIP_WORDS;'),
 ('f3-certs-negative-bare',
 'lib/dashboard/build-models.ts',
 '  const buildings = certBuildings(p);\n  if (buildings.length === 0) return null;',
 '  const buildings = certBuildings(p);\n  if (buildings.length >= 0) return null;'),
 ('f3-table-row-not-on-epb', 'lib/dashboard/build-models.ts', '        : hasEpbRecord(p)\n          ? "no lines on the EPB page"\n          : "not on EPB list",', '        : "not on EPB list",'),
 ('f8-workers-no-coverage',
 'lib/dashboard/build-models.ts',
 '    coverage: multi ? (group.includedCount === group.totalCount ? `${group.totalCount} sites` : `${group.includedCount} of the ${group.totalCount} sites on file`) : null,',
 '    coverage: null,'),
 ('f12-cert-subline-early-return',
 'lib/dashboard/facts.ts',
 '    parts.push(\n'
 '      soonest.daysLeft === 0\n'
 '        ? `${expiring.length} expiring today`\n'
 '        : `${expiring.length} expiring in ${soonest.daysLeft} ${soonest.daysLeft === 1 ? "day" : "days"}`,\n'
 '    );',
 '    return soonest.daysLeft === 0\n      ? `${expiring.length} expiring today`\n      : `${expiring.length} expiring in ${soonest.daysLeft} ${soonest.daysLeft === 1 ? "day" : "days"}`;'),
 ('f10-scope-drops-products',
 'lib/dashboard/build-models.ts',
 '  return [ops ? scopeShorten(scopeList(ops)) : null, products ? `products: ${scopeShorten(scopeList(products))}` : null]\n    .filter(Boolean)\n    .join(" · ");',
 '  return scopeList(ops ?? scope).slice(0, SCOPE_SHOWN).join(", ");'),
 ('f11-one-chapter-only', 'lib/dashboard/build-models.ts', '      chapters: [...new Set(lines.map((l) => l.slice(0, 2)))].sort(),', '      chapters: lines[0] ? [lines[0].slice(0, 2)] : [],'),
 ('f13-six-brand-lists', 'lib/dashboard/build-models.ts', 'const BRAND_LISTS_WORDS = `not on ${BRAND_LISTS_WITH_RECORDS} brand lists read`;', 'const BRAND_LISTS_WORDS = `not on 6 brand lists`;'),
 ('f9-chapter-stamped-epb',
 'lib/dashboard/build-models.ts',
 '      { label: "Chapter", value: `${code.slice(0, 2)} · ${chapterName(code.slice(0, 2))}`, marks: [], note: "HS nomenclature" },',
 '      { label: "Chapter", value: `${code.slice(0, 2)} · ${chapterName(code.slice(0, 2))}`, marks: [ep] },'),
 ('f9-eyebrow-always-epb',
 'components/dashboard/product-sheet.tsx',
 '<Eyebrow>HS {model.hs}{model.exported ? " · EPB export line" : " · not on this record\'s EPB page"}</Eyebrow>',
 '<Eyebrow>HS {model.hs} · EPB export line</Eyebrow>'),
 ('c4-exported-always-true', 'lib/dashboard/build-models.ts', '  const exported = line !== null;', '  const exported = true;'),
 ('f7-agency-homepage-links', 'lib/dashboard/source-tiers.ts', '    return /\\d/.test(path) || u.search !== "" || /\\.(?:pdf|xlsx|xls|csv)$/i.test(path);', '    return true;'),
 ('f18-tabs-dead-anchors', 'components/dashboard/sheet.tsx', '          href={t.href ?? "#"}', '          href={`#${t.label.toLowerCase()}`}'),
 ('f17-every-mark-links-on-zero',
 'lib/dashboard/build-models.ts',
 '    rendered.length > 0 && rendered.every((m) => Boolean(m.href)) && rendered.every((m) => m.opens !== "list");',
 '    rendered.every((m) => Boolean(m.href)) && rendered.every((m) => m.opens !== "list");'),
 ('f1-composer-no-sanction', 'components/dashboard/rfq-composer.tsx', '  const blocked = sanctioned.length > 0 || model.missing.length > 0;', '  const blocked = model.missing.length > 0;'),
 ('f1-composer-no-banner',
 'components/dashboard/rfq-composer.tsx',
 '      {sanctioned.length > 0 ? (\n        <>\n          <SanctionBanner sample={sanctionSample} />',
 '      {false ? (\n        <>\n          <SanctionBanner sample={sanctionSample} />'),
 ('f4-rfq-error-ignored', 'components/dashboard/rfq-list.tsx', '        {model.error ? (', '        {false ? ('),
 ('f1-rfq-row-no-sanction', 'components/dashboard/rfq-list.tsx', '                    {r.sanctioned ? (', '                    {false ? ('),
 ('f15-pager-always', 'components/dashboard/results-panel.tsx', '  const paged = pages !== null && perPage !== undefined && shown >= perPage;', '  const paged = true;'),
 ('f16-meter-nan', 'components/dashboard/controls.tsx', '  const width = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;', '  const width = Math.max(0, Math.min(100, pct));'),
 ('f16-rscchip-nan', 'lib/dashboard/build-models.ts', '  if (!Number.isFinite(rsc.progress_pct)) return null;', '  if (rsc.progress_pct === null) return null;'),
 ('c4-rsc-progress-nan',
 'lib/dashboard/build-models.ts',
 '          progress: Number.isFinite(rsc.progress_pct) ? Math.round(rsc.progress_pct as number) : null,',
 '          progress: rsc.progress_pct !== null ? Math.round(rsc.progress_pct as number) : null,'),
 ('c4-rsc-read-date-from-profile',
 'lib/dashboard/build-models.ts',
 '          readDate: formatDay(rsc.fetched_at) ?? readDateOf(p, "RSC"),',
 '          readDate: readDateOf(p, "RSC") ?? formatDay(rsc.fetched_at),'),
 ('c1-sheet-scroll-hidden',
 'components/dashboard/sheet.tsx',
 '    <div data-sheet-scroll="true" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">',
 '    <div data-sheet-scroll="true" className="min-h-0 flex-1">'),
 ('tier-ramp-flattened', 'components/dashboard/marks.tsx', '  2: "bg-tier-2 text-tier-2-on",', '  2: "bg-tier-1 text-tier-1-on",'),
 ('a11y-checkbox-no-tabindex', 'components/dashboard/controls.tsx', '      aria-checked={on}\n      aria-disabled="true"', '      aria-checked={false}\n      aria-disabled="true"'),
 ('a11y-unnamed-columns', 'components/dashboard/results-table.tsx', '      {children ?? (srLabel ? <span className="sr-only">{srLabel}</span> : null)}', '      {children}'),
 ('a11y-thumbs-title-only', 'components/dashboard/photo-tiles.tsx', '          role="img"\n          aria-label={`HS ${t.hs} · ${t.short}`}\n', ''),
 ('f14-lockcard-promises-reply',
 'components/dashboard/sheet.tsx',
 '        <span>Send an RFQ from the record instead.</span>',
 '        <span>Send an RFQ from the record instead — the supplier&apos;s reply lands in Messages.</span>'),
 ('f22-save-to-list', 'components/dashboard/sheet.tsx', '        <Icon name="bookmark" /> Save\n      </Button>', '        <Icon name="bookmark" /> Save to list\n      </Button>'),
 ('screens-ai-on', 'app/dev/ds/dashboard-screens.tsx', '            <RfqComposer model={composer} aiEnabled={false} assertModal={false} />', '            <RfqComposer model={composer} aiEnabled={true} assertModal={false} />'),
 ('screens-pager-restored',
 'app/dev/ds/dashboard-screens.tsx',
 '      <PanelFooter shown={d.cards.length} total={d.discoverError ? null : d.total} note={SELECTION} />',
 '      <PanelFooter shown={d.cards.length} total={d.discoverError ? null : d.total} perPage={25} />'),
 ('f16-count-nan', 'lib/dashboard/gallery-data.ts', '  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;', '  if (typeof raw === "number") return raw;'),
 ('f4-gallery-rfq-error-swallowed',
 'lib/dashboard/gallery-data.ts',
 '    if (error || !Array.isArray(data)) rfqError = true;\n    else rfqRows = data as RfqListRow[];',
 '    rfqRows = !error && Array.isArray(data) ? (data as RfqListRow[]) : [];'),
 ('f21-scope-badge-stray-dot',
 'lib/dashboard/build-models.ts',
 '            badge: { tone: scoped.state === "valid" ? "positive" : scoped.state === "no-expiry" ? "type" : "caution", label: certStateLabel(scoped) },',
 '            badge: { tone: scoped.state === "valid" ? "positive" : scoped.state === "no-expiry" ? "type" : "caution", label: certChipLabel(scoped).replace(`${scoped.scheme} `, "").replace(/^./, '
 '(m) => m.toUpperCase()) },'),
 ('photo-substituted-for-missing',
 'lib/dashboard/hs-photos.ts',
 '  if (!row || !row.hasPhoto) return null;\n  return size === 512 ? `/products/hs/hs-${row.hs}.webp` : `/products/hs/hs-${row.hs}-${size}.webp`;',
 '  const hs = row && row.hasPhoto ? row.hs : "6105";\n  return size === 512 ? `/products/hs/hs-${hs}.webp` : `/products/hs/hs-${hs}-${size}.webp`;'),
 ('f2-meta-bgmea-inherited',
 'lib/dashboard/build-models.ts',
 '    const pill = (p.pills ?? []).find((x) => x.source_code.toUpperCase() === "BGMEA" && x.value && ownPill(x));',
 '    const pill = (p.pills ?? []).find((x) => x.source_code.toUpperCase() === "BGMEA" && x.value && !x.building_name);'),
 ('discoverargs-renamed', 'lib/dashboard/gallery-data.ts', '    p_min_sources: null,', '    p_min_sources_nonsense: null,'),
 ('radius-off-token',
 'components/dashboard/chips.tsx',
 '        "inline-flex items-center whitespace-nowrap rounded-sm border border-transparent font-medium",',
 '        "inline-flex items-center whitespace-nowrap rounded-[4px] border border-transparent font-medium",'),
 ('adequacy-nolines-unknown-dropped',
 'components/dashboard/photo-tiles.tsx',
 '<span className="text-xs">{unknown ? "Export lines could not be read" : "No export lines on file"}</span>',
 '<span className="text-xs">No export lines on file</span>'),
 ('adequacy-panel-caption-zero',
 'components/dashboard/results-panel.tsx',
 '            : `${formatCount(model.total)} ${model.total === 1 ? "supplier" : "suppliers"} · ${\n'
 '                model.selection ?? (model.shown > 0 ? `1–${model.shown}` : "none on this page")\n'
 '              }`}',
 '            : `0 suppliers`}'),
 ('adequacy-ask-enabled',
 'app/dev/ds/dashboard-screens.tsx',
 '          <SearchComposer chips={composerChips} askEnabled={false} />\n          {cardsPanel}\n        </AppShell>\n      </Frame>\n\n      <Frame\n        id="results-table"',
 '          <SearchComposer chips={composerChips} askEnabled={true} />\n          {cardsPanel}\n        </AppShell>\n      </Frame>\n\n      <Frame\n        id="results-table"'),
 ('adequacy-sanction-card-removed',
 'components/dashboard/supplier-result-card.tsx',
 '            {card.sanctioned ? <SanctionLine sample={card.sanctionSample} href={recordHref} /> : null}',
 '            {false ? <SanctionLine sample={card.sanctionSample} href={recordHref} /> : null}'),
 ('adequacy-score-on-sheet',
 'components/dashboard/supplier-sheet.tsx',
 '              <MetaLine facts={model.meta} />',
 '              <MetaLine facts={model.meta} /><span>SourceBD score 92 % match ★★★★</span>'),
 ('c6-workers-batch-unreconciled-keeps-rsc',
 'lib/dashboard/build-models.ts',
 '    return { value, source: null, coverage: null, excluded: [], excludesRecord: false, groupUnknown: true };',
 '    return { value, source: batch.source, coverage: null, excluded: [], excludesRecord: false, groupUnknown: false };'),
 ('c6-workers-excludes-record-silent',
 'lib/dashboard/build-models.ts',
 '    excludesRecord: multi && record !== undefined && group.excludedLabels.includes(record.label),',
 '    excludesRecord: false,'),
 ('c6-building-chip-loses-figures',
 'lib/dashboard/build-models.ts',
 '      label: [`RSC covers ${named}`, rscPercentWords(worst), needsLook ? rscStatusWords(worst.remediation_status) : null].filter(Boolean).join(" · "),',
 '      label: `RSC covers ${named}`,'),
 ('c6-building-chip-never-caution',
 'lib/dashboard/build-models.ts',
 '      tone: needsLook ? "caution" : "neutral",\n      icon: "shield",\n      label: [`RSC covers ${named}`',
 '      tone: "neutral",\n      icon: "shield",\n      label: [`RSC covers ${named}`'),
 ('c6-building-blocks-dropped', 'lib/dashboard/build-models.ts', '    rscBuildingBlocks: buildings.map((b) => ({', '    rscBuildingBlocks: [].map((b: (typeof buildings)[number]) => ({'),
 ('c6-scope-splits-inside-a-phrase', 'lib/dashboard/build-models.ts', '  for (const phrase of SCOPE_PHRASES) {', '  for (const phrase of [] as string[]) {'),
 ('c6-keep-upper-shouts-co', 'lib/dashboard/facts.ts', 'const KEEP_UPPER = new Set([', 'const KEEP_UPPER = new Set([\n  "CO",'),
 ('c6-sanction-banner-sr-only',
 'components/dashboard/sheet.tsx',
 '    <div data-sanction-visible="true" role="alert" className="flex items-center gap-2 bg-sanction px-6 py-2.5 text-sm font-medium text-sanction-on">',
 '    <div data-sanction-visible="true" role="alert" className="sr-only flex items-center gap-2 bg-sanction px-6 py-2.5 text-sm font-medium text-sanction-on">'),
 ('c6-long-name-truncated',
 'components/dashboard/type.tsx',
 '  return <As className={cn("text-title font-medium text-ink-strong [overflow-wrap:anywhere]", className)}>{children}</As>;',
 '  return <As className={cn("text-title font-medium text-ink-strong truncate", className)}>{children}</As>;'),
 ('c6-brand-rows-not-deduped', 'lib/dashboard/source-tiers.ts', '    if (seen.has(k)) continue;\n    seen.add(k);', '    seen.add(k);'),
 ('c6-checkbox-not-focusable', 'components/dashboard/controls.tsx', '      title="Selection arrives with the results work"', ''),
 ('c6-seg-drops-pressed-state', 'components/dashboard/controls.tsx', '          aria-pressed={o.value === value}', '          aria-pressed={undefined}'),
 ('c6-tier-ramp-not-a-ramp', 'lib/design/tokens.ts', '    "3": "#545C54",', '    "3": "#0F130F",'),
 ('c6-tier-ramp-coloured', 'lib/design/tokens.ts', '    "4": "#DDE0D5",', '    "4": "#D5E0FF",'),
 ('c6-rfq-counts-over-all-rows', 'lib/dashboard/gallery-data.ts', '    sent: rfqError ? null : rfqRows.filter((r) => r.status !== "cancelled").length,', '    sent: rfqError ? null : rfqRows.length,'),
 ('c6-rfq-quotes-counts-rows',
 'lib/dashboard/gallery-data.ts',
 '    quotes: rfqError ? null : rfqRows.reduce((n, r) => n + (r.quote_count ?? 0), 0),',
 '    quotes: rfqError ? null : rfqRows.filter((r) => (r.quote_count ?? 0) > 0).length,'),
 ('c6-rfq-chip-zero-on-failed-read',
 'lib/dashboard/gallery-data.ts',
 '      { label: "All", count: rfqError ? null : rfqModels.length, on: true },',
 '      { label: "All", count: rfqModels.length, on: true },'),
 ('c6-rfq-sidebar-zero-on-failed-read',
 'lib/dashboard/gallery-data.ts',
 '  const count = (pred: (r: (typeof rfqModels)[number]) => boolean) => (rfqError ? null : rfqModels.filter(pred).length);',
 '  const count = (pred: (r: (typeof rfqModels)[number]) => boolean) => rfqModels.filter(pred).length;'),
 ('c6-missing-words-always-plural',
 'lib/dashboard/build-models.ts',
 '    const words = missing.length === 1 ? `${cap(missing[0]!)} not on file` : `${cap(missing.slice(0, -1).join(", "))} and ${missing.at(-1)} not on file`;',
 '    const words = `${cap(missing.slice(0, -1).join(", "))} and ${missing.at(-1)} not on file`;'),
 ('c6-recordpage-accepts-a-search',
 'lib/dashboard/source-tiers.ts',
 '    if (/(?:^|\\/)(?:search|find|lookup|directory)(?:[-_/]|$)|[-_]search(?:[-_/]|$)/i.test(path)) return false;',
 '    if (false) return false;'),
 ('c6-recordpage-accepts-an-api-listing', 'lib/dashboard/source-tiers.ts', '    if (/(?:^|\\/)api(?:\\/|$)/i.test(path)) return false;', '    if (false) return false;'),
 ('c6-rsc-status-unmapped-dropped', 'lib/dashboard/facts.ts', '  if (s.includes("notfinal")) return "not finalised";', '  if (s.includes("notfinal")) return null;'),
 ('c6-training-unknown-shown-raw',
 'lib/dashboard/facts.ts',
 '  if (s.includes("unknown")) return "training status not on file";',
 '  if (s.includes("nope-never")) return "training status not on file";'),
 ('c6-fixture-drifts-from-production', 'lib/dashboard/fixtures.ts', '      employees_total: 3314,', '      employees_total: 3315,'),
 ('c6-fixture-invents-a-url',
 'lib/dashboard/fixtures.ts',
 'const ASOS_LIST = "https://www.asosplc.com/media/cmzk3m5n/factory-list-april-2026.pdf";',
 'const ASOS_LIST = "https://cdn.example.com/asos/factory-list-april-2026.pdf";'),
 ('c6-fixture-marks-a-real-company-sanctioned',
 'lib/dashboard/fixtures.ts',
 '      id: "50c0809d-fd67-45d6-989d-d3ef116c0528",\n'
 '      slug: "aswad-composite-mills",\n'
 '      company_name: "ASWAD COMPOSITE MILLS LTD.",\n'
 '      entity_type: "factory",\n'
 '      city: "Dhaka",\n'
 '      district: "Gazipur",\n'
 '      address_raw: "HOLDING NO #121, BLOCK NO #H,WORD NO-07, BERAIDER CHALLA, SREEPUR, GAZIPUR",\n'
 '      is_sanctioned: false,',
 '      id: "50c0809d-fd67-45d6-989d-d3ef116c0528",\n'
 '      slug: "aswad-composite-mills",\n'
 '      company_name: "ASWAD COMPOSITE MILLS LTD.",\n'
 '      entity_type: "factory",\n'
 '      city: "Dhaka",\n'
 '      district: "Gazipur",\n'
 '      address_raw: "HOLDING NO #121, BLOCK NO #H,WORD NO-07, BERAIDER CHALLA, SREEPUR, GAZIPUR",\n'
 '      is_sanctioned: true,'),
 ('c6-aswad-boiler-slot-invented',
 'lib/dashboard/fixtures.ts',
 '        electrical_inspection_url: `${ACCORD_FILE}/345171.pdf`,\n        boiler_inspection_url: null,',
 '        electrical_inspection_url: `${ACCORD_FILE}/345171.pdf`,\n        boiler_inspection_url: `${ACCORD_FILE}/345172.pdf`,'),
 ('c8-hs-lines-nulled', 'lib/dashboard/fixtures.ts', '  return { profile, hscodes: SQ_HS, workers: { value: 3690,', '  return { profile, hscodes: [], workers: { value: 3690,'),
 ('c8-hs-description-drifts', 'lib/dashboard/fixtures.ts', '  "6109": ["T-shirts, singlets and other vests, knitted or crocheted", "698"],', '  "6109": ["Body armour and ballistic vests", "698"],'),
 ('c8-hs-url-drifts',
 'lib/dashboard/fixtures.ts',
 '    return { code, description: line[0], source_url: `https://edb.epb.gov.bd/hscode-exporters/${line[1]}` };',
 '    return { code, description: line[0], source_url: `https://edb.epb.gov.bd/hscode-exporters/${Number(line[1]) + 1}` };'),
 ('c8-rfq-rows-emptied',
 'scripts/gallery/render-gallery-fixtures.ts',
 '    if (fn === "rfq_list") return { data: RFQ_ROWS, error: null };',
 '    if (fn === "rfq_list") return { data: [], error: null };'),
 ('c8-rfq-row-drifts', 'lib/dashboard/fixtures.ts', 'product_title: `${HOODIES} - 2026-07-18T18:33`, quantity: 12000,', 'product_title: `${HOODIES} - 2026-07-18T18:34`, quantity: 12000,'),
 ('c8-brand-negative-bare',
 'lib/dashboard/build-models.ts',
 '  const buildings = brandBuildings(p);\n  if (buildings.length === 0) return BRAND_LISTS_WORDS;',
 '  const buildings = brandBuildings(p);\n  if (buildings.length >= 0) return BRAND_LISTS_WORDS;'),
 ('c8-own-brand-ignores-building',
 'lib/dashboard/build-models.ts',
 'export function ownBrand(b: ProfileBrand): boolean {\n  return !b.building_name;',
 'export function ownBrand(b: ProfileBrand): boolean {\n  return true;'),
 ('c8-cert-mark-unlinked', 'components/dashboard/sheet.tsx', '  const mark = sourceMark(cert.markCode, cert.documentUrl);', '  const mark = sourceMark(cert.markCode);'),
 ('c8-every-mark-skips-certs', 'lib/dashboard/build-models.ts', '    ...model.certs.map((c) => sourceMark(c.markCode, c.documentUrl)),', '    ...[] as SourceMarkModel[],'),
 ('c8-brand-link-says-register-page', 'lib/dashboard/source-tiers.ts', '  return code.toUpperCase().startsWith("BRAND_") ? "list" : "record";', '  return "record";'),
 ('c8-register-label-marker', 'lib/dashboard/build-models.ts', '    .replace(/\\s*#\\S*/g, "")', '    .replace(/\\s*#\\s*$/g, "")'),
 ('c8-register-label-underscore', 'lib/dashboard/build-models.ts', '    .replace(/OEKO_TEX/gi, "OEKO-TEX")', '    .replace(/OEKO_TEX_NOPE/gi, "OEKO-TEX")'),
 ('c8-address-stub-shown', 'lib/dashboard/build-models.ts', '    if (fuller) return { text: fuller.address, marks: marksFiling(fuller.address) };', '    if (fuller) return { text: raw, marks: [] };'),
 ('c8-address-promotes-a-mailing-row',
 'lib/dashboard/build-models.ts',
 '  const rows = (p.addresses ?? []).filter((a) => a.kind === "factory" && a.source_code);',
 '  const rows = (p.addresses ?? []).filter((a) => a.source_code);'),
 ('c8-address-newlines-collapse',
 'components/dashboard/sheet.tsx',
 '              "min-w-0 flex-1 whitespace-pre-line text-base leading-[22px] text-ink [overflow-wrap:anywhere]",',
 '              "min-w-0 flex-1 text-base leading-[22px] text-ink [overflow-wrap:anywhere]",'),
 ('c8-locations-counts-rows',
 'lib/dashboard/build-models.ts',
 '  const addresses = mergeUniqueLocations(\n    (p.addresses ?? [])',
 '  const addresses = ((r: unknown[]) => r)(\n    (p.addresses ?? [])'),
 ('c8-rsc-mark-not-this-records',
 'lib/dashboard/build-models.ts',
 'function ownMark(p: ProfilePayload, code: string): SourceMarkModel | null {\n  return allSourceCodes(p).includes(code.toUpperCase()) ? mark(p, code) : null;',
 'function ownMark(p: ProfilePayload, code: string): SourceMarkModel | null {\n  return mark(p, code);'),
 ('c8-pages-unchanged-claimed',
 'components/dashboard/supplier-sheet.tsx',
 '          {model.sourceCount} {model.sourceCount === 1 ? "source" : "sources"}',
 '          {model.sourceCount} {model.sourceCount === 1 ? "source" : "sources"} · pages unchanged since read'),
 ('c8-scope-count-ambiguous', 'lib/dashboard/build-models.ts', '  const sep = items.some((i) => i.includes(",")) ? "; " : ", ";', '  const sep = ", ";'),
 ('c8-oeko-subscheme-collapses',
 'lib/dashboard/facts.ts',
 'const OEKO_SCHEMES = ["standard 100", "made in green", "organic cotton", "eco passport", "detox to zero", "step"] as const;',
 'const OEKO_SCHEMES = ["standard 100"] as const;'),
 ('c8-cert-kind-raw-token', 'lib/dashboard/facts.ts', '  SEDEX_SMETA: "Sedex SMETA",', '  SEDEX_SMETA_NOPE: "Sedex SMETA",'),
 ('c8-entity-type-raw-token',
 'lib/dashboard/facts.ts',
 '  const words = type.replace(/_/g, " ").trim();\n  return ENTITY_LABEL[type] ?? (words ? words[0]!.toUpperCase() + words.slice(1) : "Unknown type");',
 '  return ENTITY_LABEL[type] ?? type;'),
 ('c8-footer-range-claim',
 'components/dashboard/results-panel.tsx',
 '        {note\n'
 '          ? `${note}${total === null ? "" : ` · ${formatCount(total)} in the result set`}`\n'
 '          : `${shown > 0 ? `1–${shown}` : "none on this page"} of ${total === null ? "—" : formatCount(total)}`}',
 '        {`${shown > 0 ? `1–${shown}` : "none on this page"} of ${total === null ? "—" : formatCount(total)}`}{note ? ` · ${note}` : ""}'),
 ('c8-sidebar-counts-the-page',
 'app/dev/ds/dashboard-screens.tsx',
 '    counts: { suppliers: d.published, rfqs: d.rfqError ? null : d.rfqs.sent, saved: null },',
 '    counts: { suppliers: d.published, rfqs: d.rfqs.rows.length, saved: 0 },'),
 ('c8-sheet-tab-zero-on-unread', 'components/dashboard/sheet.tsx', '          {t.count !== null ? (', '          {(t.count = t.count ?? "0") ? ('),
 ('c8-products-tab-zero-on-unread',
 'lib/dashboard/build-models.ts',
 '      { label: "Products", count: input.hscodesError ? null : String(lines.length), href: "#products" },',
 '      { label: "Products", count: String(lines.length), href: "#products" },'),
 ('c8-rfq-chip-zero-on-unread',
 'components/dashboard/rfq-list.tsx',
 '            {c.count !== null ? <Code className="text-xs">{c.count}</Code> : null}',
 '            <Code className="text-xs">{c.count ?? 0}</Code>'),
 ('c8-rfq-summary-swapped',
 'components/dashboard/rfq-list.tsx',
 '              {model.sent} sent · {model.quotes} {model.quotes === 1 ? "quote" : "quotes"}',
 '              {model.quotes} sent · {model.sent} {model.sent === 1 ? "quote" : "quotes"}'),
 ('c8-rfq-error-copy-rewritten',
 'components/dashboard/rfq-list.tsx',
 'export const RFQ_ERROR_COPY = "Your RFQs could not be read just now. Nothing has been lost — try again in a moment.";',
 'export const RFQ_ERROR_COPY = "You have no RFQs on this account.";'),
 ('c8-rfq-target-count-nan',
 'lib/dashboard/build-models.ts',
 '  const count = Number.isFinite(r.target_supplier_count) ? Math.max(0, r.target_supplier_count) : 0;',
 '  const count = Math.max(1, r.target_supplier_count);'),
 ('c8-cancelled-reads-closed', 'lib/dashboard/build-models.ts', 'r.status === "closed" ? "Closed" : "Cancelled"', '"Closed"'),
 ('c8-chip-predicate-swapped',
 'lib/dashboard/gallery-data.ts',
 '      { label: "Open", count: count((r) => r.status.label.startsWith("Open")) },',
 '      { label: "Open", count: count((r) => r.status.label.startsWith("Quoted")) },'),
 ('c8-contrast-pair-deleted', 'lib/design/tokens.ts', '  { fg: "brand.on", bg: "brand",', '  { fg: "brand.on", bg: "canvas",'),
 ('c8-radius-scale-moved', 'lib/design/tokens.ts', '  sm: "0.375rem", // 6', '  sm: "0.25rem", // 6'),
 ('c8-composer-rail-dead-anchor',
 'components/dashboard/rfq-composer.tsx',
 '              href="#"\n              aria-disabled="true"',
 '              href={`#${s.label.toLowerCase().replace(/\\s+/g, "-")}`}\n              aria-disabled={undefined}'),
 ('c8-recent-search-dead-anchor', 'app/dev/ds/dashboard-screens.tsx', 'href: "#results-list" }', 'href: "#results" }'),
 ('c8-expires-in-zero-days', 'lib/dashboard/facts.ts', '      if (c.daysLeft === 0) return `${c.scheme} expires today`;', '      if (c.daysLeft === -1) return `${c.scheme} expires today`;'),
 ('c8-cert-empty-denies-a-building', 'components/dashboard/supplier-sheet.tsx', '              {model.certsEmptyChip}', '              {"No certificate on any register"}'),
 ('c9-rfq-rows-from-three-buyers',
 'lib/dashboard/fixtures.ts',
 'export const RFQ_ROWS: RfqListRow[] = [\n  { id: "46c33de8-831a-45b7-a813-beb82e8dcf26"',
 'export const RFQ_ROWS: RfqListRow[] = [\n'
 '  { id: "b40e3903-e81e-457f-a2c0-d9cefbc8c42e", product_title: "T-shirt", quantity: 100, quantity_unit: "pcs", ship_by: "2026-09-24", status: "open", target_supplier_count: 1, quote_count: 0, '
 'created_at: "2026-09-09T01:00:30.289024+00:00" },\n'
 '  { id: "46c33de8-831a-45b7-a813-beb82e8dcf26"'),
 ('c9-rfq-target-rank-typed',
 'lib/dashboard/gallery-data.ts',
 '    return buildRfqRow(r, t ? { name: t.name, tier: topTier(t.codes) } : null, today);',
 '    return buildRfqRow(r, t ? { name: t.name, tier: 2 } : null, today);'),
 ('c9-rfq-target-codes-drift',
 'lib/dashboard/fixtures.ts',
 'RFQ_ROWS.map((r) => [r.id, { name: "Thermax Woven Dyeing Ltd.", codes: ["OEKO_TEX"] }]),',
 'RFQ_ROWS.map((r) => [r.id, { name: "Thermax Woven Dyeing Ltd.", codes: ["BGMEA"] }]),'),
 ('c9-page-drops-rfq-targets',
 'app/dev/ds/page.tsx',
 '  const dashboard = await loadGalleryData(supabase, new Date(), RFQ_TARGETS);',
 '  const dashboard = await loadGalleryData(supabase, new Date());'),
 ('c9-workers-unreconciled', 'lib/dashboard/fixtures.ts', '  return { profile, hscodes: SQ_HS, workers: { value: 3690,', '  return { profile, hscodes: SQ_HS, workers: { value: 7690,'),
 ('c9-workers-source-drift',
 'lib/dashboard/fixtures.ts',
 '  return { profile, hscodes: [], workers: { value: 2350, source: "registry", fetched_at: null }, today: TODAY };',
 '  return { profile, hscodes: [], workers: { value: 2350, source: "RSC", fetched_at: null }, today: TODAY };'),
 ('c9-coverage-claims-completeness',
 'lib/dashboard/build-models.ts',
 '    coverage: multi ? (group.includedCount === group.totalCount ? `${group.totalCount} sites` : `${group.includedCount} of the ${group.totalCount} sites on file`) : null,',
 '    coverage: multi ? `${group.includedCount} of ${group.totalCount} sites` : null,'),
 ('c9-every-mark-ignores-disclosure-lists',
 'lib/dashboard/build-models.ts',
 '    rendered.length > 0 && rendered.every((m) => Boolean(m.href)) && rendered.every((m) => m.opens !== "list");',
 '    rendered.length > 0 && rendered.every((m) => Boolean(m.href));'),
 ('c9-cert-link-skips-recordpage',
 'components/dashboard/sheet.tsx',
 '        {recordPage(cert.documentUrl) ? (\n          <a href={cert.documentUrl!}',
 '        {cert.documentUrl ? (\n          <a href={cert.documentUrl!}'),
 ('c9-member-member',
 'lib/dashboard/build-models.ts',
 '    chips.unshift({ tone: "neutral", label: /\\bmember$/i.test(label) ? label : `${label} member` });',
 '    chips.unshift({ tone: "neutral", label: `${label} member` });'),
 ('c9-locations-counts-spellings', 'lib/dashboard/build-models.ts', '  const addresses = mergeUniqueLocations(', '  const addresses = ((rows: unknown[]) => rows)('),
 ('c9-tile-empty-reads-zero', 'components/dashboard/supplier-result-card.tsx', '        {tile.value ?? "—"}', '        {tile.value ?? "0"}'),
 ('c9-rsc-chip-drops-the-others',
 'lib/dashboard/build-models.ts',
 '    const named = needsLook && worst !== first ? `${worst.building_name}${more}` : `${first.building_name}${more}`;',
 '    const named = needsLook && worst !== first ? `${worst.building_name}` : `${first.building_name}${more}`;'),
 ('c9-subline-expiring-zero-days', 'lib/dashboard/facts.ts', '      soonest.daysLeft === 0\n        ? `${expiring.length} expiring today`', '      false\n        ? `${expiring.length} expiring today`'),
 ('c9-table-drops-the-qualifier', 'lib/dashboard/build-models.ts', '    workersCoverage: workersCoverageWords(w)?.replace(/^across /, "") ?? null,', '    workersCoverage: w.coverage,'),
 ('c9-empty-copy-promises-delivery',
 'components/dashboard/rfq-list.tsx',
 'export const RFQ_EMPTY_COPY = "Your first RFQ lands here. Suppliers answer inside the platform, with the record attached.";',
 'export const RFQ_EMPTY_COPY = "Your first RFQ lands here. Suppliers reply by email within 48 hours.";'),
 ('c9-composer-promises-delivery',
 'components/dashboard/rfq-composer.tsx',
 '<Label className="text-ink-strong">The message this RFQ carries</Label>',
 '<Label className="text-ink-strong">The message the supplier receives</Label>'),
 ('c9-pending-checked-negated',
 'lib/dashboard/build-models.ts',
 '  const pending = (value: string | null, m: SourceMarkModel | null = null, checked = "registers checked")',
 '  const pending = (value: string | null, m: SourceMarkModel | null = null, checked = "no registers checked")'),
 ('c9-composer-chip-invented',
 'app/dev/ds/dashboard-screens.tsx',
 'const composerChips = [{ label: `Text · ${GALLERY_QUERY.q}` }, { label: "Certificate · GOTS" }];',
 'const composerChips = [{ label: `Text · ${GALLERY_QUERY.q}` }, { label: "Certificate · GOTS" }, { label: "RSC ≥ 80 %" }];'),
 ('c9-sort-label-drift', 'app/dev/ds/dashboard-screens.tsx', 'sortLabel: "Most sources", view', 'sortLabel: "Best match", view'),
 ('c9-recent-count-from-page',
 'app/dev/ds/dashboard-screens.tsx',
 '    recent: d.total !== null ? [{ label: GALLERY_QUERY.title, count: d.total, href: "#results-list" }] : [],',
 '    recent: [{ label: GALLERY_QUERY.title, count: d.cards.length, href: "#results-list" }],'),
 ('c9-screen-width-drift', 'app/dev/ds/dashboard-screens.tsx', 'export const SCREEN_WIDTH = 1440;', 'export const SCREEN_WIDTH = 1280;'),
 ('c9-contrast-pair-removed', 'lib/design/tokens.ts', '  { fg: "line.strong", bg: "surface", min: UI, use: "input outline" },\n', ''),
 ('c9-sanction-aaa-lowered',
 'lib/design/tokens.ts',
 '  { fg: "sanction.on", bg: "sanction", min: 7, use: "sanction banner (held to AAA)" },',
 '  { fg: "sanction.on", bg: "sanction", min: TEXT, use: "sanction banner (held to AAA)" },'),
 ('c9-backgrounds-drop-locked',
 'lib/design/tokens.ts',
 'const BACKGROUNDS = ["canvas", "surface", "surface.sunken", "locked", "quiet"];',
 'const BACKGROUNDS = ["canvas", "surface", "surface.sunken", "quiet"];'),
 ('c9-cssvar-default-renamed', 'lib/design/tokens.ts', '  return key === "DEFAULT" ? `--ds-${group}` : `--ds-${group}-${key}`;', '  return `--ds-${group}-${key}`;'),
 ('c9-body-font-size', 'lib/design/tokens.ts', '  base: ["0.875rem", { lineHeight: "1.375rem" }], // 14 — body', '  base: ["1rem", { lineHeight: "1.375rem" }], // 14 — body'),
 ('c9-table-row-density', 'lib/design/tokens.ts', '  tableRow: 36, // admin and directory rows, 13px text', '  tableRow: 44, // admin and directory rows, 13px text'),
 ('c9-sidebar-width', 'lib/design/tokens.ts', '  sidebar: 232, // app shell nav width', '  sidebar: 260, // app shell nav width'),
 ('c9-content-width', 'lib/design/tokens.ts', '  content: "75rem", // 1200', '  content: "60rem", // 1200'),
 ('c9-fast-duration', 'lib/design/tokens.ts', '  fast: "120ms",', '  fast: "1200ms",'),
 ('c9-tier-label-drift', 'lib/design/tokens.ts', '  { rank: 1, label: "Government" },', '  { rank: 1, label: "Gov" },'),
 ('c9-bloom-uses-sanction-red', 'lib/design/tokens.ts', '  bloom: "0 0 0 4px rgb(63 227 116 / 0.28)",', '  bloom: "0 0 0 4px rgb(143 23 17 / 0.28)",'),
 ('meta-colour-guard-exemption-widened',
 'lib/design/tokens.test.ts',
 'const NO_MARKUP = ["lib/dashboard/fixtures.ts", "lib/dashboard/fixtures.production.json"];',
 'const NO_MARKUP = ["lib/dashboard/fixtures.ts", "lib/dashboard/fixtures.production.json", "components/dashboard"];'),
 ('c10-factory-address-any-kind',
 'lib/dashboard/build-models.ts',
 '  const rows = (p.addresses ?? []).filter((a) => a.kind === "factory" && a.source_code);',
 '  const rows = (p.addresses ?? []).filter((a) => a.source_code);'),
 ('c10-sources-denominator-25', 'lib/dashboard/build-models.ts', 'const SOURCES_WITH_RECORDS = 14;', 'const SOURCES_WITH_RECORDS = 25;'),
 ('c10-cert-negative-any-register',
 'lib/dashboard/build-models.ts',
 '  return elsewhere ? `No certificate on ${elsewhere}` : `No certificate on ${CERT_REGISTERS} registers`;',
 '  return elsewhere ? `No certificate on ${elsewhere}` : "No certificate on any register";'),
 ('c10-scope-gots-only',
 'lib/dashboard/build-models.ts',
 '  const withScope = certList.filter((c) => (c.scope ?? "").trim().length > 0);',
 '  const withScope = certList.filter((c) => (c.scope ?? "").trim().length > 0 && c.kind.toUpperCase() === "GOTS" && c.state !== "expired");'),
 ('c10-scope-empty-claims-a-read',
 'lib/dashboard/build-models.ts',
 '  return certList.length === 0 ? certsEmptyWords(p) : "no scope on the certificates on file";',
 '  void certList;\n  return `${CERT_REGISTERS} cert registers checked`;'),
 ('c10-address-mark-first-row-only',
 'lib/dashboard/build-models.ts',
 '      .sort((a, b) => a.tier - b.tier || a.code.localeCompare(b.code));',
 '      .sort((a, b) => a.tier - b.tier || a.code.localeCompare(b.code)).slice(0, 1);'),
 ('c10-address-fuller-no-tiebreak',
 'lib/dashboard/build-models.ts',
 '      .sort(\n'
 '        (a, b) =>\n'
 '          words(b.address).length - words(a.address).length ||\n'
 '          mark(p, a.source_code).tier - mark(p, b.source_code).tier ||\n'
 '          a.address.localeCompare(b.address),\n'
 '      )[0];',
 '      .sort((a, b) => words(b.address).length - words(a.address).length)[0];'),
 ('c10-checkbox-dead-tab-stop',
 'components/dashboard/controls.tsx',
 '      role="checkbox"\n      aria-checked={on}\n      aria-disabled="true"\n      title="Selection arrives with the results work"',
 '      role="checkbox"\n      tabIndex={0}\n      aria-checked={on}'),
 ('c10-icon-no-role', 'components/dashboard/icons.tsx', '      role={label ? "img" : undefined}\n', ''),
 ('c10-more-chip-silent-placeholder',
 'components/dashboard/chips.tsx',
 '          aria-disabled={moreHref === "#" ? "true" : undefined}\n'
 '          tabIndex={moreHref === "#" ? -1 : undefined}\n'
 '          title={moreHref === "#" ? "The rest arrive with the record page" : undefined}\n',
 ''),
 ('c10-what-is-hidden-silent', 'components/dashboard/sheet.tsx', '            aria-disabled="true"\n            tabIndex={-1}\n            title="What is hidden arrives with the plans page"\n', ''),
 ('c10-topbar-date-as-corpus-fact', 'lib/dashboard/gallery-data.ts', '  if (d.recordsReadOn && d.recordsRead !== null)', '  if (d.recordsReadOn && d.recordsRead !== null && false)'),
 ('c10-blank-count-is-zero', 'lib/dashboard/gallery-data.ts', '  if (typeof raw !== "string" || raw.trim() === "") return null;', '  if (typeof raw !== "string") return null;'),
 ('c10-icon-stub-renders-nothing',
 'test-stubs/phosphor-icons-react.cjs',
 '  const { size, weight, children, ...rest } = props || {};',
 '  const { size, weight, children, ...rest } = props || {};\n  if (rest) return null;'),
 ('c11-meter-unnamed', 'components/dashboard/controls.tsx', '      role="meter"\n      aria-label={label}\n', '      role="meter"\n'),
 ('c11-no-skip-link', 'components/dashboard/app-shell.tsx', '      <a\n        href={`#${mainId}`}\n', '      <a\n        href="#"\n'),
 ('c11-content-not-a-landmark',
 'components/dashboard/app-shell.tsx',
 '        <main\n          id={mainId}\n          aria-label={screenLabel}\n          className={cn("mx-auto flex w-full max-w-[calc(75rem+3rem)] flex-col gap-4 p-6", contentClassName)}\n        >\n          {children}\n        </main>',
 '        <div\n          id={mainId}\n          aria-label={screenLabel}\n          className={cn("mx-auto flex w-full max-w-[calc(75rem+3rem)] flex-col gap-4 p-6", contentClassName)}\n        >\n          {children}\n        </div>'),
 ('c11-panel-title-not-a-heading', 'components/dashboard/results-panel.tsx', '        <Title as="h1">{model.title}</Title>', '        <Title>{model.title}</Title>'),
 ('c11-sheet-tab-inert-but-focusable', 'components/dashboard/sheet.tsx', '          tabIndex={t.href === null ? -1 : undefined}\n', ''),
 ('c11-remove-name-on-a-graphic',
 'components/dashboard/search-composer.tsx',
 '            <button type="button" disabled aria-label={`Remove ${c.label}`} className="opacity-70 disabled:cursor-not-allowed">\n              <Icon name="x" small />\n            </button>',
 '            <span className="opacity-70">\n              <Icon name="x" small label={`Remove ${c.label}`} />\n            </span>'),
 ('c11-read-date-is-the-newest', 'lib/dashboard/gallery-data.ts', '    const oldest = times[0];', '    const oldest = times[times.length - 1];'),
 ('c11-heading-level-skipped', 'components/dashboard/sheet.tsx', '          <Heading level="sm" as="h2" className="flex-1">', '          <Heading level="sm" as="h3" className="flex-1">'),
 ('c12-composer-rail-literals',
 'app/dev/ds/dashboard-screens.tsx',
 '        missing: detailMissing.length === 0 ? undefined : `${listWords(detailMissing.map((f, i) => (i === 0 ? f : f.toLowerCase())))} missing`,\n'
 '        count: `${DETAIL_FIELDS.length - detailMissing.length}/${DETAIL_FIELDS.length}`,',
 '        missing: "Reply-by date and destination missing",\n        count: "2/6",'),
 ('c13-caption-loses-its-subject',
 'lib/dashboard/gallery-data.ts',
 '    parts.push(`${formatCount(d.recordsRead)} ${d.recordsRead === 1 ? "record" : "records"} on this page, read ${d.recordsReadOn}`);',
 '    parts.push(`supplier records read ${d.recordsReadOn}`);'),
 ('c13-rfq-claims-a-reply-state',
 'lib/dashboard/build-models.ts',
 '          : { tone: "type", label: "Open · no quote yet", icon: "send" };',
 '          : { tone: "positive", label: "Sent · awaiting reply", icon: "send" };'),
 ('c13-nav-state-is-a-fill-only',
 'components/dashboard/app-shell.tsx',
 '                on && "bg-brand-tint text-brand-ink hover:bg-brand-tint shadow-[inset_3px_0_0_rgb(var(--ds-brand))]",',
 '                on && "bg-brand-tint text-brand-ink hover:bg-brand-tint",'),
 ('c13-toggle-state-is-a-fill-only',
 'components/dashboard/controls.tsx',
 '            o.value === value && "bg-brand-tint text-brand-ink shadow-[inset_0_-2px_0_rgb(var(--ds-brand))]",',
 '            o.value === value && "bg-brand-tint text-brand-ink",'),
 ('c13-modal-background-live', 'components/dashboard/sheet.tsx', '      {behind === undefined ? null : <div inert>{behind}</div>}', '      {behind === undefined ? null : <div>{behind}</div>}'),
 ('c13-landmarks-share-an-id',
 'app/dev/ds/dashboard-screens.tsx',
 '        <AppShell sidebar={results.sidebar} topbar={tableTopbarModel(d)} mainId="results-table-main" screenLabel="results table">',
 '        <AppShell sidebar={results.sidebar} topbar={tableTopbarModel(d)} mainId="results-list-main" screenLabel="results table">'),
 ('c14-sheet-read-date-is-a-maximum',
 'lib/dashboard/build-models.ts',
 '  return formatDayRange(new Date(oldest).toISOString(), new Date(newest).toISOString());',
 '  void oldest;\n  return formatDay(new Date(newest).toISOString());'),
 ('c14-caption-travels-to-the-rfq-screen', 'app/dev/ds/dashboard-screens.tsx', '  const drawsRecords = active !== "rfqs";', '  const drawsRecords = true;'),
 ('c14-step-state-is-a-hairline',
 'components/dashboard/rfq-composer.tsx',
 '                s.active && "bg-surface ring-1 ring-inset ring-line border-l-[3px] border-brand pl-[7px]",',
 '                s.active && "bg-surface ring-1 ring-inset ring-line",'),
 ('c14-day-range-collapses-to-one-day',
 'lib/dashboard/facts.ts',
 '  if (a === b) return a;\n  const year = a.slice(a.lastIndexOf(" ") + 1);',
 '  if (a !== b) return b;\n  const year = a.slice(a.lastIndexOf(" ") + 1);'),
 ('c15-place-ignores-the-address',
 'lib/dashboard/build-models.ts',
 '  const column = placeLabel(s.city, s.district);\n  if (column) return column;',
 '  const column = placeLabel(s.city, s.district);\n  return column;'),
 ('c15-state-indicator-retinted', 'components/dashboard/app-shell.tsx', 'shadow-[inset_3px_0_0_rgb(var(--ds-brand))]', 'shadow-[inset_3px_0_0_rgb(var(--ds-brand-tint))]'),
 ('c15-sanction-edge-dropped', 'components/dashboard/results-table.tsx', 'r.sanctioned && "shadow-[inset_4px_0_0_rgb(var(--ds-sanction))]"', 'r.sanctioned && ""'),
 ('c15-corpus-count-never-singular',
 'lib/dashboard/gallery-data.ts',
 '  if (d.published !== null) parts.push(`${formatCount(d.published)} published ${d.published === 1 ? "supplier" : "suppliers"}`);',
 '  if (d.published !== null) parts.push(`${formatCount(d.published)} published suppliers`);'),
 ('c16-details-step-drops-two-fields',
 'app/dev/ds/dashboard-screens.tsx',
 '  const DETAIL_FIELDS = ["Name", "Reply-by date", "Incoterm", "Destination", "Currency", "Attachments"];',
 '  const DETAIL_FIELDS = ["Name", "Reply-by date", "Incoterm", "Destination"];'),
 ('c16-checkbox-role-dropped',
 'components/dashboard/controls.tsx',
 '      role="checkbox"\n      aria-checked={on}',
 '      role="presentation"\n      aria-checked={on}'),
 ('c17-table-topbar-shares-the-named-span',
 'app/dev/ds/dashboard-screens.tsx',
 '<AppShell sidebar={results.sidebar} topbar={tableTopbarModel(d)} mainId="results-table-main" screenLabel="results table">',
 '<AppShell sidebar={results.sidebar} topbar={results.topbar} mainId="results-table-main" screenLabel="results table">'),
 ('c17-table-span-uses-the-named-population',
 'lib/dashboard/gallery-data.ts',
 '  const tableSpan = readSpan([...named, ...extra]);',
 '  const tableSpan = readSpan(named);'),
 ('c17-table-screenlabel-duplicates-results-list',
 'app/dev/ds/dashboard-screens.tsx',
 'screenLabel="results table"',
 'screenLabel="results list"'),
 ('c17-topbar-search-region-loses-its-label',
 'components/dashboard/app-shell.tsx',
 '        aria-label={screenLabel ? `Quick search, ${screenLabel}` : "Quick search"}',
 '        aria-label={undefined}'),
 ('c18-table-caption-drops-the-extra-rows',
 'app/dev/ds/dashboard-screens.tsx',
 'function tableSelection(d: GalleryData): string {\n  const extraCount = d.rows.length - d.cards.length;\n  if (extraCount <= 0) return SELECTION;\n  return `the named test records of the rebuild spec, plus discovery\'s next ${extraCount} live match${extraCount === 1 ? "" : "es"}`;\n}',
 'function tableSelection(d: GalleryData): string {\n  return SELECTION;\n}'),
 ('c18-main-landmark-loses-its-name',
 'components/dashboard/app-shell.tsx',
 '        <main\n          id={mainId}\n          aria-label={screenLabel}',
 '        <main\n          id={mainId}'),
 ('c18-skip-link-text-hardcoded',
 'components/dashboard/app-shell.tsx',
 '        {screenLabel ? `Skip to content, ${screenLabel}` : "Skip to content"}',
 '        {"Skip to content"}'),
 ('c18-supplier-sheet-claims-exclusive-modal',
 'app/dev/ds/dashboard-screens.tsx',
 '<SupplierSheet model={d.sheet} assertModal={false} />',
 '<SupplierSheet model={d.sheet} />'),
 ('c18-product-sheet-claims-exclusive-modal',
 'app/dev/ds/dashboard-screens.tsx',
 '<ProductSheet model={d.productSheet} assertModal={false} />',
 '<ProductSheet model={d.productSheet} />'),
 ('c18-composer-claims-exclusive-modal',
 'app/dev/ds/dashboard-screens.tsx',
 '<RfqComposer model={composer} aiEnabled={false} assertModal={false} />',
 '<RfqComposer model={composer} aiEnabled={false} />'),
 ('c18-read-span-count-off-by-one',
 'lib/dashboard/gallery-data.ts',
 '      count: read.length || null,',
 '      count: read.length + 1 || null,'),
 ('c18-table-read-date-dropped',
 'lib/dashboard/gallery-data.ts',
 '  const tableRecordsReadOn = tableSpan.on;',
 '  const tableRecordsReadOn = null;'),
 ('c19-results-table-note-drops-tableselection',
 'app/dev/ds/dashboard-screens.tsx',
 'note={`Same header and footer, 36px rows, ${d.rows.length} rows: ${tableSelection(d)}.`}',
 'note={`Same header and footer, 36px rows, ${d.rows.length} rows: the four named records.`}'),
 ('c19-product-sheet-note-ignores-exported',
 'app/dev/ds/dashboard-screens.tsx',
 "note={`HS ${d.productSheet.hs}${d.productSheet.exported ? ` on ${d.productSheet.supplierName}'s EPB exporter page` : `, not on ${d.productSheet.supplierName}'s EPB exporter page`}. The photo is the catalogue's illustrative photo for the heading, never the supplier's own.`}",
 "note={`HS ${d.productSheet.hs} on ${d.productSheet.supplierName}'s EPB exporter page. The photo is the catalogue's illustrative photo for the heading, never the supplier's own.`}"),
 ('c19-rfq-list-note-denies-the-zero-row-render',
 'app/dev/ds/dashboard-screens.tsx',
 'note={`The viewer\'s own RFQs from rfq_list: ${d.rfqs.rows.length} real row${d.rfqs.rows.length === 1 ? "" : "s"}, newest first. Production holds seven across three buyers and rfq_list is scoped to auth.uid(), so five — one buyer\'s own — is the longest list it can return to anybody. A viewer who owns none still sees "0 sent · 0 quotes" and reads the empty state below it, "Your first RFQ lands here."; only a failed read replaces both with "count not read" and an error message.`}',
 'note={`The viewer\'s own RFQs from rfq_list: ${d.rfqs.rows.length} real rows, newest first. Production holds seven across three buyers and rfq_list is scoped to auth.uid(), so these five — one buyer\'s own — are the longest list it can return to anybody. A viewer who owns none reads the empty state instead, "Your first RFQ lands here." — never "0 sent".`}'),
 ('c19-sheet-default-loses-modality',
 'components/dashboard/sheet.tsx',
 'export function Sheet({ label, assertModal = true, children }: { label: string; assertModal?: boolean; children: ReactNode }) {',
 'export function Sheet({ label, assertModal = false, children }: { label: string; assertModal?: boolean; children: ReactNode }) {'),
 ('c19-dialog-default-loses-modality',
 'components/dashboard/rfq-composer.tsx',
 'export function Dialog({ label, assertModal = true, children }: { label: string; assertModal?: boolean; children: ReactNode }) {',
 'export function Dialog({ label, assertModal = false, children }: { label: string; assertModal?: boolean; children: ReactNode }) {'),
]

# An interrupted sweep used to leave the tree mutated, and the next run then
# measured a repo that was not the candidate. The file under test is restored
# on the way out however the process dies.
_INFLIGHT = {}

def _restore_and_die(signum, frame):
    for rel, src in _INFLIGHT.items():
        with io.open(os.path.join(ROOT, rel), "w", encoding="utf-8") as f:
            f.write(src)
    print(f"\ninterrupted by signal {signum}; restored {len(_INFLIGHT)} file(s)")
    sys.exit(130)

for _sig in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
    signal.signal(_sig, _restore_and_die)


def read(rel):
    with io.open(os.path.join(ROOT, rel), encoding="utf-8") as f: return f.read()
def write(rel, s):
    with io.open(os.path.join(ROOT, rel), "w", encoding="utf-8") as f: f.write(s)

def git(*args):
    return subprocess.run(["git", "-C", ROOT, *args], capture_output=True, text=True)


def refuse(why):
    sys.stderr.write("refusing to sweep: " + why + "\n")
    sys.exit(2)


if os.path.realpath(ROOT) == os.path.realpath(os.environ.get("MUTATE_FORBID") or os.path.expanduser("~/sb")):
    refuse("MUTATE_ROOT is the tree you commit from; use a worktree of its own")
if not os.path.isdir(os.path.join(ROOT, ".git")) and not os.path.isfile(os.path.join(ROOT, ".git")):
    refuse(f"{ROOT} is not a git worktree; create one at the frozen candidate first")

# A sweep measures the candidate. A tree that is already dirty is not the
# candidate, and a leftover mutation from an interrupted run would be measured
# as if it were the author's code.
dirty = git("status", "--porcelain").stdout.strip()
if dirty:
    refuse(f"{ROOT} is not clean:\n{dirty}")
SWEPT_SHA = git("rev-parse", "HEAD").stdout.strip()

# An anchor that does not appear exactly once is not measuring what its name
# says. Zero matches used to print SKIP and carry on, so a repair silently
# removed a whole guard from the sweep while the headline still read "0
# survived"; two matches are worse, because `replace(old, new, 1)` mutates
# the first occurrence and scores RED for whatever that happened to break.
# `c6-long-name-truncated` pointed at `[overflow-wrap:anywhere]` in the card,
# which occurs twice — both on a tile sub-line, neither on the long supplier
# name the entry is named after, so it had never once measured its subject.
_stale = []
for _name, _rel, _old, _new in M:
    _n = read(_rel).count(_old)
    if _n != 1:
        _stale.append(f"  {_name}: anchor appears {_n} times in {_rel}")
if _stale:
    refuse("these anchors are not measuring one place:\n" + "\n".join(_stale))

# The positive control needs a positive control. If the unmutated tree is
# already red, every entry goes red and the sweep reports a perfect score
# while proving nothing at all.
print(f"baseline: {SWEPT_SHA[:7]} in {ROOT}", flush=True)
_b = subprocess.run([TEST_CMD, ROOT], capture_output=True, text=True, timeout=1800)
with io.open(os.path.join(OUT, "baseline.txt"), "w", encoding="utf-8") as f:
    f.write(_b.stdout + _b.stderr)
if _b.returncode != 0:
    refuse("the unmutated tree is red, so every mutation would score RED; see baseline.txt")
print("baseline GREEN\n", flush=True)

results = []
only = sys.argv[1] if len(sys.argv) > 1 else None
for name, rel, old, new in M:
    if only and only not in name: continue
    src = read(rel)
    if old not in src:
        results.append({"mutation": name, "file": rel, "applied": False, "red": None, "note": "anchor not found"})
        print(f"SKIP  {name}: anchor not found in {rel}"); continue
    _INFLIGHT[rel] = src
    write(rel, src.replace(old, new, 1))
    try:
        r = subprocess.run([TEST_CMD, ROOT], capture_output=True, text=True, timeout=900)
        out = r.stdout + r.stderr
        failed = [l.strip()[2:] for l in out.splitlines() if l.startswith("✖ ") and "failing tests" not in l]
        ran = "# tests" in out or "\u2139 tests" in out
        # `dash-test.sh` runs `tsc || exit 1` before the tests, so a mutation
        # that does not compile exits non-zero with no test having run. That is
        # the type checker rejecting it, not a guard catching it, and counting
        # it as RED overstates the suite. The cycle-7 sweep had one
        # (`screens-pager-restored`) and reported 73/73.
        if r.returncode != 0 and not ran:
            verdict, red = "NOCOMPILE", None
        else:
            red = r.returncode != 0
            verdict = "RED   " if red else "GREEN "
        results.append({"mutation": name, "file": rel, "applied": True, "red": red, "compiled": ran, "failing": failed[:6]})
        print(verdict.ljust(6) + " " + name + ("  <-- NOT CAUGHT" if red is False else "") + ("  <-- DID NOT COMPILE, so no test ran" if red is None else ""))
        with io.open(os.path.join(OUT, name + ".txt"), "w", encoding="utf-8") as f: f.write(out)
    finally:
        write(rel, src)
        _INFLIGHT.pop(rel, None)

# A filtered run used to overwrite the whole sweep's summary with its own few
# rows, and the bundle then shipped a one-row summary beside a 111-line log.
name_out = "summary.json" if not only else f"summary-{only.strip('-') or 'filtered'}.json"
with io.open(os.path.join(OUT, name_out), "w", encoding="utf-8") as f:
    json.dump({"sha": SWEPT_SHA, "root": ROOT, "filter": only, "entries": results}, f, indent=2)
caught = sum(1 for r in results if r.get("red") is True)
survived = sum(1 for r in results if r.get("red") is False)
nocompile = sum(1 for r in results if r.get("red") is None and r.get("applied"))
skipped = sum(1 for r in results if not r.get("applied"))
print(f"\n{SWEPT_SHA[:7]}: {caught} caught / {survived} survived / {nocompile} did not compile / {skipped} skipped, of {len(results)}")
if not results:
    print("NOTHING RAN. A filter that matches no entry prints a clean headline and proves nothing.")
elif survived or nocompile or skipped:
    print("A sweep is only evidence when every entry compiles, applies, and goes red.")
