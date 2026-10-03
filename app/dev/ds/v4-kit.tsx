// /dev/ds, second v4 section: the kit of Paper's `02 Components` (B1, 4 Oct 2026), every
// state beside its board's name. The components are the real ones; hover, focus and
// pressed are the browser's, so hover a cell and press Tab. (The proof harness forces
// them through `data-force` for its screenshots.) Open overlays are drawn through their
// panels, because the live ones are portalled: `v4-kit-live.tsx` opens those.

import {
  BookmarkSimple,
  CalendarBlank,
  CaretDown,
  Check,
  ChatCircleText,
  DotsThree,
  DownloadSimple,
  Bell,
  MagnifyingGlass,
  PaperPlaneTilt,
  Plus,
  Receipt,
  SlidersHorizontal,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import {
  ActionBar,
  BulkBar,
  Button,
  CertChip,
  Checkbox,
  Count,
  DialogPanel,
  Empty,
  ErrorPanel,
  FactChip,
  Field,
  FilterChip,
  IconButton,
  InlineError,
  Input,
  PaneSkeleton,
  Pagination,
  Radio,
  RefusedBar,
  RowSkeleton,
  Segmented,
  Select,
  SelectCell,
  SheetPanel,
  SkeletonRows,
  StandingFilter,
  Switch,
  Tab,
  TabBar,
  TabLink,
  Table,
  TableFrame,
  TableScroll,
  Tabs,
  TabsList,
  Td,
  Th,
  Toast,
  Tr,
  TypeChip,
  Unpublished,
  bulkActionClass,
  bulkCloseClass,
  linkClass,
  menuClass,
  menuItemClass,
  popoverClass,
  selectItemClass,
  tooltipClass,
  rowLinkClass,
  toastActionClass,
} from "@/components/kit";
import { cn } from "@/lib/utils";
import { LiveOverlays } from "./v4-kit-live";

const LONG_NAME = "Zaheen Knitwears Limited (Shed - 3, 4, 5, 10, 11, 12, 13) & (Building - Security, ETP and Fire Pump)";

function Block({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-line pt-6 first:border-t-0 first:pt-0" data-kit={title}>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {note ? <p className="max-w-prose text-sm text-ink-3">{note}</p> : null}
      {children}
    </section>
  );
}

/** A state cell: `force` tells the proof harness which pseudo-state to hold on the first control inside. */
function Cell({ force, children }: { force?: "hover" | "focus-visible" | "active"; children: ReactNode }) {
  return (
    <div data-force={force} className="flex w-[168px] shrink-0 items-center">
      {children}
    </div>
  );
}

const STATES = ["Default", "Hover", "Focus-visible", "Pressed", "Disabled", "Loading"];

function ButtonStates({ kind, name, note, verb, doing }: { kind: "primary" | "secondary" | "quiet" | "danger" | "link"; name: string; note: string; verb: string; doing: string }) {
  const b = (extra: object = {}) => (
    <Button kind={kind} {...extra}>
      {verb}
    </Button>
  );
  return (
    <div className="flex items-center gap-4">
      <div className="w-32 shrink-0">
        <p className="text-base font-medium text-ink">{name}</p>
        <p className="text-xs text-ink-3">{note}</p>
      </div>
      <Cell>{b()}</Cell>
      <Cell force="hover">{b()}</Cell>
      <Cell force="focus-visible">{b()}</Cell>
      <Cell force="active">{b()}</Cell>
      <Cell>{b({ disabled: true })}</Cell>
      <Cell>
        {kind === "link" ? (
          <span className="text-xs text-ink-3">No loading state; the page shows progress.</span>
        ) : (
          <Button kind={kind} loading loadingLabel={doing}>
            {verb}
          </Button>
        )}
      </Cell>
    </div>
  );
}

function Buttons() {
  return (
    <Block title="Buttons" note="One primary per region. Labels start with a verb. Danger only in confirm dialogs. 02 Components · 1.">
      <div className="space-y-4 overflow-x-auto">
        <div className="flex gap-4 border-b border-line pb-2 text-xs font-medium text-ink-3">
          <span className="w-32 shrink-0">Kind</span>
          {STATES.map((s) => (
            <span key={s} className="w-[168px] shrink-0">
              {s}
            </span>
          ))}
        </div>
        <ButtonStates kind="primary" name="Primary" note="One per region" verb="Send RFQ" doing="Sending" />
        <ButtonStates kind="secondary" name="Secondary" note="Everything else" verb="Save search" doing="Saving" />
        <ButtonStates kind="quiet" name="Quiet" note="Toolbars, rows" verb="Clear all" doing="Clearing" />
        <ButtonStates kind="danger" name="Danger" note="Confirm dialogs only" verb="Cancel order" doing="Cancelling" />
        <ButtonStates kind="link" name="Link" note="In text and rows" verb="Download CSV" doing="" />
      </div>
      <div className="flex flex-wrap items-end gap-10 pt-4">
        <figure className="space-y-2">
          <IconButton icon={DotsThree} label="More actions" kind="quiet" size={24} />
          <figcaption className="text-xs text-ink-3">24 · icon in a row</figcaption>
        </figure>
        <figure className="space-y-2">
          <IconButton icon={SlidersHorizontal} label="Columns" />
          <figcaption className="text-xs text-ink-3">32 · icon only</figcaption>
        </figure>
        <figure className="space-y-2">
          <Button icon={DownloadSimple}>Download CSV</Button>
          <figcaption className="text-xs text-ink-3">32 · default, icon left</figcaption>
        </figure>
        <figure className="space-y-2">
          <Button kind="primary" size="lg" icon={PaperPlaneTilt}>
            Send RFQ
          </Button>
          <figcaption className="text-xs text-ink-3">40 · main form action</figcaption>
        </figure>
        <figure className="space-y-2">
          <div className="flex gap-2">
            <Button size="lg">Cancel</Button>
            <Button kind="primary" size="lg">
              Create order
            </Button>
          </div>
          <figcaption className="text-xs text-ink-3">Footer: Cancel left of the action, 8 apart</figcaption>
        </figure>
        <figure className="w-[358px] space-y-2">
          <Button kind="primary" size="touch" full>
            Accept quote
          </Button>
          <figcaption className="text-xs text-ink-3">Phone · 48 tall, full width, 16px label</figcaption>
        </figure>
      </div>
    </Block>
  );
}

function Inputs() {
  const cells: { cap: string; force?: "hover" | "focus-visible"; node: ReactNode }[] = [
    { cap: "Default", node: <Field label="HS code">{(a) => <Input {...a} placeholder="e.g. 6105" />}</Field> },
    { cap: "Hover", force: "hover", node: <Field label="HS code">{(a) => <Input {...a} placeholder="e.g. 6105" />}</Field> },
    { cap: "Focus: 2px brand edge", force: "focus-visible", node: <Field label="HS code">{(a) => <Input {...a} defaultValue="6105" />}</Field> },
    { cap: "Filled, with help", node: <Field label="HS code" help="Add several HS codes, separated by commas.">{(a) => <Input {...a} defaultValue="6105, 6109" />}</Field> },
    { cap: "Disabled", node: <Field label="HS code" disabled>{(a) => <Input {...a} defaultValue="6105" disabled />}</Field> },
    { cap: "Error: icon and words under the field", node: <Field label="HS code" error="Use numbers only, e.g. 6105.">{(a) => <Input {...a} defaultValue="61O5" />}</Field> },
  ];
  return (
    <Block title="Inputs" note="Label above at 13/500, help below at 12, error below with an icon at 13. One column, never wider than 480. 02 Components · 2.">
      <div className="flex flex-wrap items-start gap-6">
        {cells.map((c) => (
          <div key={c.cap} data-force={c.force} className="flex w-48 flex-col gap-1.5">
            {c.node}
            <p className="text-xs text-ink-3">{c.cap}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-start gap-10 pt-4">
        <div className="w-60 space-y-2">
          <Field label="Ship to">{(a) => <Select {...a} name="ship" defaultValue="uk" options={[{ value: "uk", label: "United Kingdom" }, { value: "de", label: "Germany" }, { value: "es", label: "Spain" }]} />}</Field>
          <div className={cn(menuClass, "static w-60")}>
            <div className={selectItemClass} data-state="checked">
              United Kingdom
              <Check size={16} className="text-brand" aria-hidden />
            </div>
            <div className={selectItemClass} data-highlighted="">
              Germany
            </div>
            <div className={selectItemClass}>Spain</div>
            <div className={selectItemClass}>Canada</div>
          </div>
          <p className="text-xs text-ink-3">Open: selected has tint and a check; hover is sunken.</p>
        </div>
        <div className="w-[200px] space-y-6">
          <Field label="Ship by" help="Day, month, year. You can type 30/10/2026.">{(a) => <Input {...a} defaultValue="30 Oct 2026" icon={CalendarBlank} iconSide="end" />}</Field>
          <Field label="Deliver by" error="Deliver by must come after ship by.">{(a) => <Input {...a} defaultValue="15 Oct 2026" icon={CalendarBlank} iconSide="end" />}</Field>
        </div>
        <div className="w-[320px] space-y-2">
          <Field label="Supplier">{(a) => <Input {...a} defaultValue="knit" icon={MagnifyingGlass} />}</Field>
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-8 pt-4">
        {(
          [
            ["Default", <Checkbox key="a">GOTS</Checkbox>],
            ["Hover", <span key="b" data-force="hover"><Checkbox>GOTS</Checkbox></span>],
            ["Checked", <Checkbox key="c" defaultChecked>GOTS</Checkbox>],
            ["Some selected", <Checkbox key="d" mixed>Select all 25 on this page</Checkbox>],
            ["Focus-visible", <span key="e" data-force="focus-visible"><Checkbox>WRAP</Checkbox></span>],
            ["Disabled", <Checkbox key="f" disabled>SA8000</Checkbox>],
            ["Error", <div key="g" className="space-y-1"><Checkbox aria-invalid="true">I have read the statement</Checkbox><p className="text-sm text-danger">Tick this to download.</p></div>],
          ] as [string, ReactNode][]
        ).map(([cap, node]) => (
          <div key={cap} className="w-[150px] space-y-2">
            {node}
            <p className="text-xs text-ink-3">{cap}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-start gap-20 pt-4">
        <div className="space-y-3">
          <h4 className="text-base font-semibold text-ink">Radio</h4>
          <div className="flex flex-wrap gap-6">
            <Radio name="rowh" defaultChecked>Compact</Radio>
            <Radio name="rowh">Comfortable</Radio>
            <span data-force="focus-visible"><Radio name="rowh2">Focus</Radio></span>
            <Radio name="rowh3" disabled>Disabled</Radio>
          </div>
        </div>
        <div className="space-y-3">
          <h4 className="text-base font-semibold text-ink">Switch · desktop 32x18</h4>
          <div className="flex flex-wrap items-center gap-6">
            <Switch defaultChecked>On</Switch>
            <Switch>Off</Switch>
            <span data-force="focus-visible"><Switch defaultChecked>Focus</Switch></span>
            <Switch disabled>Disabled</Switch>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-6 pt-4">
        <div className="flex w-[302px] flex-col gap-1.5">
          <p className="text-sm font-medium text-ink">Tech pack</p>
          <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-line-strong bg-surface p-4">
            <Button icon={UploadSimple}>Upload tech pack</Button>
            <p className="text-xs text-ink-3">A PDF or an image, up to 10 MB. Or drop it here.</p>
          </div>
        </div>
        <p className="max-w-prose pt-6 text-xs text-ink-3">The upload box is drawn here with the kit&apos;s button; the file picker, progress and error rows land with the first page that uploads (B5, the RFQ form).</p>
      </div>
    </Block>
  );
}

function Chips() {
  return (
    <Block title="Chips, tabs, segmented" note="A chip is a 14px glyph plus words, 24 tall, radius 4, 13/500. Normal states stay neutral; “not on file” is dashed. 02 Components · 3.">
      <div className="flex flex-wrap items-center gap-3">
        <CertChip state="valid">Valid until 12 May 2027</CertChip>
        <CertChip state="expiring">Expires in 5 days · 8 Oct 2026</CertChip>
        <CertChip state="expired">Expired 29 Sep 2026</CertChip>
        <CertChip state="none">No expiry date published</CertChip>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <FactChip state="stale">Last checked 18 May 2026</FactChip>
        <FactChip state="disagree">Sources disagree</FactChip>
        <FactChip state="changed">Source page changed</FactChip>
        <FactChip state="notOnFile">Workforce not published</FactChip>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <TypeChip>Factory</TypeChip>
        <TypeChip>Buying house</TypeChip>
        <TypeChip published={false}>Type not published</TypeChip>
        <Count label="16 saved suppliers">16</Count>
        <FilterChip removeHref="#" removeLabel="Remove Certificate: GOTS">Certificate: GOTS</FilterChip>
        <span data-force="hover">
          <FilterChip removeHref="#" removeLabel="Remove Location: Gazipur">Location: Gazipur</FilterChip>
        </span>
        <StandingFilter action={<a href="#" className={linkClass}>Show them</a>}>Hiding sanctioned suppliers</StandingFilter>
      </div>
      <Tabs defaultValue="overview" className="max-w-[1000px]">
        <TabsList>
          <Tab value="overview">Overview</Tab>
          <span data-force="hover" className="contents"><Tab value="products" count={12}>Products</Tab></span>
          <Tab value="certs" count={4}>Certificates</Tab>
          <span data-force="focus-visible" className="contents"><Tab value="safety">Safety</Tab></span>
          <Tab value="sites" count={3}>Sites</Tab>
          <Tab value="sources" count={11}>Sources</Tab>
          <Tab value="orders" count={0} disabled>Orders</Tab>
        </TabsList>
      </Tabs>
      <nav aria-label="Record sections" className="flex max-w-[420px] gap-1 border-b border-line">
        <TabLink href="#" current>Overview</TabLink>
        <TabLink href="#" count={12}>Products</TabLink>
        <TabLink href="#" count={4}>Certificates</TabLink>
      </nav>
      <div className="flex flex-wrap items-center gap-6">
        <Segmented name="view" label="View" defaultValue="table" options={[{ value: "table", label: "Table" }, { value: "cards", label: "Cards" }]} />
        <span data-force="hover"><Segmented name="view2" label="View" defaultValue="table" options={[{ value: "table", label: "Table" }, { value: "cards", label: "Cards" }]} /></span>
        <Segmented name="rows" label="Row height" defaultValue="compact" options={[{ value: "compact", label: "Compact" }, { value: "comfortable", label: "Comfortable" }]} />
        <Segmented name="view3" label="View" disabled options={[{ value: "table", label: "Table" }, { value: "cards", label: "Cards" }]} />
      </div>
    </Block>
  );
}

type Row = { name: string; type: string | null; where: string | null; workers: string | null; sources: number; cert: ReactNode; selected?: boolean };

const ROWS: Row[] = [
  { name: "Aboni Knitwear Ltd.", type: "Factory", where: "Dhaka", workers: "3,166", sources: 11, selected: true, cert: <><CertChip state="expired" className="border-0 bg-transparent px-0">WRAP expired 29 Sep 2026</CertChip><span className="text-sm text-ink-3"> · 3 more certificates</span></> },
  { name: "SQ Celsius Limited", type: "Factory", where: "Dhaka", workers: "3,690", sources: 6, cert: <CertChip state="expired" className="border-0 bg-transparent px-0">WRAP expired 19 Sep 2026</CertChip> },
  { name: "Plummy Fashions Ltd", type: "Factory", where: "Narayanganj", workers: "800", sources: 4, cert: <Unpublished>None found</Unpublished> },
  { name: LONG_NAME, type: "Factory", where: "Narayanganj", workers: "1,634", sources: 1, cert: <Unpublished>None found</Unpublished> },
  { name: "A.R. Fashion", type: "Buying house", where: null, workers: null, sources: 1, cert: <Unpublished>None found</Unpublished> },
];

function Tables() {
  return (
    <Block title="Table" note="Head 36, rows 40, 56 when a name wraps. The head sticks while the body scrolls. Numbers sit right with their column head. 02 Components · 4.">
      <TableFrame>
        <TableScroll className="max-h-[420px]">
          <Table>
            <thead>
              <tr>
                <SelectCell header mixed label="Select all 25 suppliers on this page" />
                <Th className="w-[400px]">Supplier</Th>
                <Th className="w-[120px]">Type</Th>
                <Th className="w-[140px]">Location</Th>
                <Th align="right" sort="none" href="#" className="w-[110px]" data-force="hover">Workers</Th>
                <Th align="right" sort="desc" href="#" className="w-[90px]">Sources</Th>
                <Th>Certificates</Th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <Tr key={r.name} selected={r.selected} data-force={r.name === "SQ Celsius Limited" ? "hover" : undefined}>
                  <SelectCell label={`Select ${r.name}`} defaultChecked={r.selected} />
                  <Td><a href="#" className={rowLinkClass}>{r.name}</a></Td>
                  <Td>{r.type ?? <Unpublished />}</Td>
                  <Td>{r.where ?? <Unpublished />}</Td>
                  <Td align="right" className="text-ink">{r.workers ?? <Unpublished />}</Td>
                  <Td align="right" className="text-ink">{r.sources}</Td>
                  <Td>{r.cert}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableScroll>
        <Pagination noun="suppliers" from={1} to={25} total={4645} page={1} pages={186} nextHref="#" perPage={<Select aria-label="Per page" defaultValue="25" options={[{ value: "25", label: "25 per page" }]} className="w-36" />} />
      </TableFrame>
      <BulkBar
        summary="2 suppliers selected"
        selectAll={<a href="#" className="font-medium underline decoration-1 [text-underline-position:from-font]">Select all 4,645</a>}
        clear={<button type="button" aria-label="Clear selection" className={bulkCloseClass}><X size={16} aria-hidden /></button>}
      >
        <button type="button" className={bulkActionClass()}>Save</button>
        <button type="button" className={bulkActionClass()}>Download CSV</button>
        <button type="button" className={bulkActionClass(true)}>Send RFQ to 2 suppliers</button>
      </BulkBar>
      <div className="flex flex-wrap items-center gap-6">
        <Button iconRight={CaretDown} className="border-brand bg-brand-tint hover:bg-brand-tint">Certificate: GOTS</Button>
        <Button iconRight={CaretDown}>Sort: most sources</Button>
        <Button icon={Plus}>Add filter</Button>
        <p className="text-xs text-ink-3">The button shows its value. The filter panel&apos;s action reads “Show {"{n}"} suppliers”, with the real count.</p>
      </div>
      <div className="flex flex-wrap items-start gap-8">
        <TableFrame className="w-[464px]">
          <Table><thead><tr><Th>Supplier</Th><Th>Location</Th></tr></thead></Table>
          <Empty variant="table" title="No suppliers match these filters." action={<Button>Clear all filters</Button>}>Remove a filter to widen the search.</Empty>
        </TableFrame>
        <TableFrame className="w-[440px]">
          <Table><thead><tr><Th>Supplier</Th><Th>Location</Th></tr></thead></Table>
          <SkeletonRows rows={4} />
        </TableFrame>
        <div className="space-y-1.5">
          <Button>Show 25 more suppliers</Button>
          <p className="text-xs text-ink-3">Showing 25 of 4,645</p>
        </div>
      </div>
    </Block>
  );
}

function Overlays() {
  return (
    <Block title="Overlays" note="Dialogs only for decisions that cannot be undone. Everything else is a toast with Undo. 02 Components · 5. The open boxes are drawn through their panels; the buttons below open the live ones.">
      <div className="flex flex-wrap items-start gap-10">
        <div className="rounded-md bg-scrim p-10">
          <DialogPanel
            title="Cancel this RFQ?"
            description="Suppliers who have not quoted see it as cancelled. You can't undo this."
            footer={
              <>
                <Button>Keep RFQ</Button>
                <Button kind="danger">Cancel RFQ</Button>
              </>
            }
          >
            Men&apos;s heavyweight French terry hoodies, 420gsm · 10,000 pieces · ship by 15 Oct 2026
          </DialogPanel>
        </div>
        <DialogPanel
          kind="form"
          title="Save search"
          close={<IconButton icon={X} label="Close" kind="quiet" />}
          footer={
            <>
              <Button>Cancel</Button>
              <Button kind="primary">Save search</Button>
            </>
          }
        >
          <Field label="Name" className="w-80">{(a) => <Input {...a} defaultValue="knit · GOTS" />}</Field>
          <Checkbox defaultChecked>Email me when new suppliers match</Checkbox>
        </DialogPanel>
      </div>
      <div className="flex flex-wrap items-start gap-10">
        <div className="flex w-[420px] flex-col gap-4">
          <Toast action={<button type="button" className={toastActionClass}>Undo</button>}>Removed Aboni Knitwear Ltd. from saved</Toast>
          <Toast tone="brand">RFQ sent to 2 suppliers</Toast>
          <div className="flex items-start gap-8">
            <span className={cn(tooltipClass, "static")}>More actions</span>
            <span className={cn(tooltipClass, "static w-60")}>Bangladesh Garment Manufacturers and Exporters Association</span>
          </div>
        </div>
        <div className={cn(popoverClass, "static")}>
          <p className="text-base font-semibold text-ink">BGMEA</p>
          <p className="text-xs text-ink-3">Bangladesh Garment Manufacturers and Exporters Association · industry body</p>
          <dl className="my-2.5 flex flex-col gap-1.5 border-y border-cert-valid-edge py-2.5 text-sm">
            <div className="flex justify-between"><dt className="text-ink-3">Reg. no.</dt><dd className="font-mono text-ink">3498</dd></div>
            <div className="flex justify-between"><dt className="text-ink-3">Checked</dt><dd className="text-ink">24 Jul 2026</dd></div>
          </dl>
          <a href="#" className={cn(linkClass, "text-base")}>Open the BGMEA record</a>
        </div>
        <div className={cn(menuClass, "static w-[220px]")}>
          <div className={menuItemClass}>Open</div>
          <div className={menuItemClass} data-highlighted="">Save</div>
          <div className={cn(menuItemClass, "text-disabled")} data-disabled="">Message <span className="text-xs">after an RFQ</span></div>
          <div className="my-1 h-px bg-line" />
          <div className={menuItemClass}>Copy link</div>
        </div>
      </div>
      <LiveOverlays />
    </Block>
  );
}

function Feedback() {
  return (
    <Block title="Empty, error, skeleton" note="The empty state says what is missing and offers one next step; it never apologises. An error replaces only what failed. 02 Components · 6.">
      <div className="flex flex-wrap items-start gap-8">
        <Empty icon={BookmarkSimple} title="No saved suppliers yet." action={<Button kind="primary">Search suppliers</Button>}>Save suppliers to check them here.</Empty>
        <Empty icon={ChatCircleText} title="Contact details are locked." action={<Button kind="primary">Send RFQ</Button>}>Send an RFQ and the supplier replies here.</Empty>
      </div>
      <div className="flex flex-wrap items-start gap-8">
        <div className="flex w-[400px] flex-col gap-4">
          <InlineError retry={<Button>Try again</Button>}>We couldn&apos;t load the sites.</InlineError>
          <ErrorPanel title="We couldn't load suppliers." retry={<Button kind="primary">Try again</Button>}>Your filters are kept. Try again in a moment.</ErrorPanel>
        </div>
        <PaneSkeleton className="w-[420px]" />
        <RowSkeleton className="w-[396px]" />
      </div>
    </Block>
  );
}

function Phone() {
  const tabs = [
    { href: "#", label: "Messages", icon: ChatCircleText, current: true },
    { href: "#", label: "Quotes", icon: Receipt },
    { href: "#", label: "Alerts", icon: Bell, isNew: true },
    { href: "#", label: "Saved", icon: BookmarkSimple },
    { href: "#", label: "Search", icon: MagnifyingGlass },
  ];
  return (
    <Block title="Phone" note="Glance and act. Five tabs, one sticky action above them, sheets instead of dialogs. Every target 44 or more, 16px in fields. 02 Components · 7.">
      <div className="flex flex-wrap items-start gap-10">
        <div className="w-[390px] space-y-2"><TabBar items={tabs} /><p className="text-xs text-ink-3">Tab bar · 390</p></div>
        <div className="w-80 space-y-2"><TabBar items={tabs} /><p className="text-xs text-ink-3">Tab bar · 320</p></div>
      </div>
      <div className="flex flex-wrap items-start gap-10">
        <div className="w-[390px] space-y-2">
          <ActionBar>
            <IconButton icon={BookmarkSimple} label="Save Aboni Knitwear Ltd." size={48} />
            <Button kind="primary" size="touch" className="flex-1">Send RFQ</Button>
          </ActionBar>
          <p className="text-xs text-ink-3">Sticky action bar · 390</p>
        </div>
        <div className="w-80 space-y-2">
          <ActionBar>
            <IconButton icon={BookmarkSimple} label="Save Aboni Knitwear Ltd." size={48} />
            <Button kind="primary" size="touch" className="flex-1">Send RFQ</Button>
          </ActionBar>
          <p className="text-xs text-ink-3">Sticky action bar · 320</p>
        </div>
        <div className="w-[390px] space-y-2">
          <RefusedBar>You can&apos;t send this supplier an RFQ.</RefusedBar>
          <p className="text-xs text-ink-3">Refused (sanctioned, sample state). The button is replaced, not greyed.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-10">
        <div className="flex h-[420px] w-[390px] flex-col justify-end overflow-clip rounded-lg bg-scrim">
          <SheetPanel kind="sheet" title="Filters" close={<IconButton icon={X} label="Close" kind="quiet" size={44} />} footer={<><Button size="touch">Clear all</Button><Button kind="primary" size="touch" className="flex-1">Show 4,645 suppliers</Button></>}>
            <div className="flex min-h-14 items-center justify-between border-b border-line"><div><p className="text-md text-ink">Certificates</p><p className="text-sm font-medium text-brand">GOTS</p></div></div>
            <div className="flex min-h-14 items-center justify-between"><div><p className="text-md text-ink">Location</p><p className="text-sm text-ink-3">Any</p></div></div>
          </SheetPanel>
        </div>
        <div className="flex h-[300px] w-[390px] flex-col justify-end overflow-clip rounded-lg bg-scrim">
          <SheetPanel kind="confirm" title="Cancel this RFQ?" description="Suppliers who have not quoted see it as cancelled. You can't undo this." footer={<><Button kind="danger" size="touch">Cancel RFQ</Button><Button size="touch">Keep RFQ</Button></>} />
        </div>
        <div className="flex w-[358px] flex-col gap-3">
          <Field label="Quantity">{(a) => <Input {...a} size="touch" defaultValue="10,000 pieces" />}</Field>
          <Field label="Ship by">{(a) => <Input {...a} size="touch" defaultValue="15 Oct 2026" icon={CalendarBlank} iconSide="end" />}</Field>
          <Checkbox size="touch" defaultChecked>GOTS</Checkbox>
          <Checkbox size="touch">OEKO-TEX Standard 100</Checkbox>
          <Radio size="touch" name="sortp" defaultChecked>Most sources</Radio>
          <Switch size="touch" defaultChecked hint="Certificate expiry, RSC safety updates and sanctions changes.">Saved suppliers</Switch>
        </div>
      </div>
    </Block>
  );
}

export function V4Kit() {
  return (
    <div className="space-y-10">
      <Buttons />
      <Inputs />
      <Chips />
      <Tables />
      <Overlays />
      <Feedback />
      <Phone />
    </div>
  );
}
