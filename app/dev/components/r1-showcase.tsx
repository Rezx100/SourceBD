"use client";

// Spec R1 — `/dev/components` showcase additions.
//
// Co-located client component (sibling to `page.tsx`; sibling .tsx files
// are NOT route segments in App Router — only `page.tsx`/`route.ts`/
// `layout.tsx` are). So adding this file does not add a route.
//
// Each section renders a primitive at a simulated XS / SM / MD / LG / XL
// width via fixed-width wrappers so reviewers can eyeball every
// breakpoint without resizing the browser. The "live" container query
// host (`r1-cq-host`) inside ResponsiveTable + FilterRailResponsive will
// also respond to those wrapper widths.

import * as React from "react";
import { Eye, ShieldCheck } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { FormGrid } from "@/components/ui/form-grid";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { Sheet } from "@/components/ui/sheet";
import { MobileDrawer } from "@/components/ui/mobile-drawer";
import { Wizard } from "@/components/ui/wizard";
import { MasterDetail } from "@/components/ui/master-detail";
import { ResponsiveTable, type Column } from "@/components/ui/responsive-table";
import { SidebarRail } from "@/components/shell/sidebar-rail";
import { BottomTabBar } from "@/components/shell/bottom-tab-bar";
import { FilterRailResponsive } from "@/components/discover/filter-rail-responsive";

// ────────────────────────────────────────────────────────────────────
// Breakpoint preview frame — a fixed-width wrapper that simulates a
// device class so reviewers can see every primitive at every size on a
// single page without resizing the browser. The wrapper sets max-width
// + overflow-x clip so any responsive bug shows up as a horizontal
// scroll bar inside the frame (a §2.1 fail).
// ────────────────────────────────────────────────────────────────────
const BREAKPOINTS = [
  { label: "XS · 360", width: 360 },
  { label: "SM · 480", width: 480 },
  { label: "MD · 768", width: 768 },
  { label: "LG · 1024", width: 1024 },
  { label: "XL · 1280", width: 1280 },
] as const;

function BreakpointFrame({
  width,
  label,
  children,
}: {
  width: number;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-tertiary">
        {label}px
      </p>
      <div
        // We constrain the *outer* container; the children get
        // `width: 100%` so their internal responsive rules behave as if
        // the viewport were `width` wide. Overflow-x-clip surfaces any
        // horizontal-scroll bug inside the frame.
        className="overflow-x-clip rounded-card border border-hairline bg-bg-l0 p-3"
        style={{ width: `${width}px`, maxWidth: "100%" }}
      >
        {children}
      </div>
    </div>
  );
}

// Sample row type for the ResponsiveTable showcase.
type SampleRow = {
  id: string;
  slug: string;
  company: string;
  entity: string;
  city: string;
  sources: number;
  sanctioned: boolean;
};
const SAMPLE_ROWS: SampleRow[] = [
  { id: "1", slug: "ananta-apparels", company: "Ananta Apparels Ltd", entity: "factory", city: "Dhaka", sources: 5, sanctioned: false },
  { id: "2", slug: "cotton-club-bd", company: "Cotton Club BD Ltd", entity: "factory", city: "Gazipur", sources: 7, sanctioned: false },
  { id: "3", slug: "ha-meem-denim", company: "Ha-Meem Denim Ltd", entity: "factory", city: "Narayanganj", sources: 4, sanctioned: false },
];
const SAMPLE_COLS: Column<SampleRow>[] = [
  { key: "company", label: "Company", render: (r) => <span className="font-medium">{r.company}</span> },
  { key: "entity", label: "Entity", render: (r) => r.entity },
  { key: "city", label: "City", render: (r) => r.city },
  { key: "sources", label: "Sources", numeric: true, render: (r) => r.sources },
  { key: "slug", label: "Slug", render: (r) => <span className="font-mono text-[12px]">{r.slug}</span> },
];

// Sample steps for the Wizard showcase.
const WIZ_STEPS = [
  { id: "product", label: "Product", hint: "Category + specs" },
  { id: "req", label: "Requirements", hint: "MOQ, lead time, certs" },
  { id: "review", label: "Review & match", hint: "Evidence + ranking" },
];

export function R1Showcase() {
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [centerOpen, setCenterOpen] = React.useState(false);
  const [step, setStep] = React.useState(0);

  return (
    <section className="space-y-16 border-t border-hairline pt-12">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-tertiary">
          Spec R1 — Responsive foundation
        </p>
        <h2 className="font-display text-2xl font-semibold tracking-tightish text-ink-primary">
          Responsive primitives showcase
        </h2>
        <p className="mt-2 text-ink-secondary">
          Each primitive is rendered inside fixed-width frames simulating
          XS / SM / MD / LG / XL viewports. Container-query consumers
          (ResponsiveTable, FilterRailResponsive) respond to the frame
          width, not the browser. Any horizontal scroll bar inside a
          frame is a §2.1 fail and must be fixed before R1 ships.
        </p>
      </header>

      {/* ── Safe-area utilities ───────────────────────────────────── */}
      <section>
        <h3 className="font-display text-base font-semibold text-ink-primary">
          Safe-area utilities
        </h3>
        <p className="mt-1 text-sm text-ink-secondary">
          Six CSS classes that read <code className="font-mono text-[12px]">env(safe-area-inset-*)</code> for notched
          phones. Used by every fixed/sticky chrome element (BottomTabBar,
          StickyActionBar, Sheet bottom variant, mobile FilterRail sheet).
        </p>
        <pre className="mt-3 overflow-x-auto rounded-input border border-hairline bg-bg-l0 p-3 font-mono text-[11px]">
{`.safe-pt   padding-top: env(safe-area-inset-top, 0)
.safe-pb   padding-bottom: env(safe-area-inset-bottom, 0)
.safe-pl   padding-left: env(safe-area-inset-left, 0)
.safe-pr   padding-right: env(safe-area-inset-right, 0)
.safe-px   px-inset-left + px-inset-right
.safe-py   py-inset-top + py-inset-bottom
.safe-bottom-0   bottom: max(0, env(safe-area-inset-bottom, 0))`}
        </pre>
      </section>

      {/* ── 16px input baseline ──────────────────────────────────── */}
      <section>
        <h3 className="font-display text-base font-semibold text-ink-primary">
          Mobile 16px input baseline
        </h3>
        <p className="mt-1 text-sm text-ink-secondary">
          At <code className="font-mono text-[12px]">@media (max-width: 767px)</code> every
          <code className="font-mono text-[12px]"> &lt;input&gt;/&lt;select&gt;/&lt;textarea&gt;</code> that hasn&apos;t
          opted into a larger Tailwind <code className="font-mono text-[12px]">text-*</code>
          utility is bumped to 16px to prevent iOS focus-zoom. The
          <code className="font-mono text-[12px]">:not(.text-base)…:not(.text-6xl)</code> exclusion
          ladder gives the rule specificity (0,3,1) so it beats a plain
          <code className="font-mono text-[12px]">.text-sm</code> (0,1,0) — but inputs that explicitly
          use <code className="font-mono text-[12px]">text-lg</code> or larger are simply not matched.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-xs text-ink-tertiary">
            text-sm (14px) → becomes 16px on phones
            <input
              type="text"
              defaultValue="bump me"
              className="rounded-input border border-hairline px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-tertiary">
            text-lg (18px) → stays 18px on phones
            <input
              type="text"
              defaultValue="don't shrink me"
              className="rounded-input border border-hairline px-2 py-1.5 text-lg"
            />
          </label>
        </div>
      </section>

      {/* ── Chip ─────────────────────────────────────────────────── */}
      <section>
        <h3 className="font-display text-base font-semibold text-ink-primary">
          Chip
        </h3>
        <div className="mt-3 flex flex-wrap items-start gap-6">
          {BREAKPOINTS.map((bp) => (
            <BreakpointFrame key={bp.width} width={bp.width} label={bp.label.split(" · ")[1]!}>
              <div className="flex flex-wrap gap-1.5">
                <Chip label="Dhaka" tone="brand" onRemoveHref="#x" />
                <Chip label="Knit composite" tone="brand" onRemoveHref="#x" />
                <Chip label="≥3 sources" tone="brand" onRemoveHref="#x" />
                <Chip label="Static" />
                <Chip label="Muted" tone="muted" />
              </div>
            </BreakpointFrame>
          ))}
        </div>
      </section>

      {/* ── FormGrid ─────────────────────────────────────────────── */}
      <section>
        <h3 className="font-display text-base font-semibold text-ink-primary">
          FormGrid
        </h3>
        <div className="mt-3 grid gap-6 lg:grid-cols-2">
          {BREAKPOINTS.map((bp) => (
            <BreakpointFrame key={bp.width} width={bp.width} label={bp.label.split(" · ")[1]!}>
              <FormGrid cols={3}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <label key={i} className="flex flex-col gap-1 text-xs text-ink-secondary">
                    Field {i + 1}
                    <input
                      type="text"
                      className="rounded-input border border-hairline px-2 py-1.5 text-sm"
                    />
                  </label>
                ))}
              </FormGrid>
            </BreakpointFrame>
          ))}
        </div>
      </section>

      {/* ── ResponsiveTable ──────────────────────────────────────── */}
      <section>
        <h3 className="font-display text-base font-semibold text-ink-primary">
          ResponsiveTable — stacked / priority / swipe
        </h3>
        <p className="mt-1 text-sm text-ink-secondary">
          Three modes via the <code className="font-mono text-[12px]">mode</code> prop.
          Stacked = default (desktop table, mobile cards). Priority keeps
          named columns visible + collapses the rest. Swipe is reserved
          for <code className="font-mono text-[12px]">/admin/suppliers/import</code> preview only.
        </p>

        <div className="mt-4 space-y-6">
          {(["stacked", "priority", "swipe"] as const).map((mode) => (
            <div key={mode}>
              <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-tertiary">
                mode = {mode}
              </p>
              <div className="flex flex-wrap items-start gap-6">
                {BREAKPOINTS.map((bp) => (
                  <BreakpointFrame
                    key={bp.width}
                    width={bp.width}
                    label={bp.label.split(" · ")[1]!}
                  >
                    {mode === "priority" ? (
                      <ResponsiveTable<SampleRow>
                        mode="priority"
                        priorityKeys={["company", "city"]}
                        columns={SAMPLE_COLS}
                        rows={SAMPLE_ROWS}
                        rowKey={(r) => r.id}
                      />
                    ) : mode === "swipe" ? (
                      <ResponsiveTable<SampleRow>
                        mode="swipe"
                        columns={SAMPLE_COLS}
                        rows={SAMPLE_ROWS}
                        rowKey={(r) => r.id}
                      />
                    ) : (
                      <ResponsiveTable<SampleRow>
                        columns={SAMPLE_COLS}
                        rows={SAMPLE_ROWS}
                        rowKey={(r) => r.id}
                      />
                    )}
                  </BreakpointFrame>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Sheet / MobileDrawer ─────────────────────────────────── */}
      <section>
        <h3 className="font-display text-base font-semibold text-ink-primary">
          Sheet · MobileDrawer
        </h3>
        <p className="mt-1 text-sm text-ink-secondary">
          Native <code className="font-mono text-[12px]">&lt;dialog&gt; + .showModal()</code> — focus
          containment + Esc + ::backdrop are native. We add backdrop-click
          dismiss, body scroll-lock, <code className="font-mono text-[12px]">inert</code> on background
          siblings, swipe-down close on the bottom variant, and safe-area
          inset padding. No Radix Dialog, no hand-rolled focus trap.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => setSheetOpen(true)}>
            Open bottom sheet
          </Button>
          <Button variant="outline" onClick={() => setCenterOpen(true)}>
            Open centred modal
          </Button>
          <Button variant="outline" onClick={() => setDrawerOpen(true)}>
            Open mobile drawer
          </Button>
        </div>
        <Sheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          side="bottom"
          label="Bottom sheet demo"
        >
          <p className="text-sm text-ink-secondary">
            Tap the backdrop, press Esc, swipe down on the drag handle,
            or use the × button to close. Background is <code className="font-mono text-[12px]">inert</code>.
          </p>
        </Sheet>
        <Sheet
          open={centerOpen}
          onClose={() => setCenterOpen(false)}
          side="center"
          label="Centered modal demo"
        >
          <p className="text-sm text-ink-secondary">
            Centered on <code className="font-mono text-[12px]">md+</code> · bottom-sheet on phones.
          </p>
        </Sheet>
        <MobileDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          side="left"
          label="Mobile drawer demo"
        >
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
            <li><a href="#" className="block rounded-input px-3 py-2 hover:bg-brand-forest-tint">Discover</a></li>
            <li><a href="#" className="block rounded-input px-3 py-2 hover:bg-brand-forest-tint">Saved</a></li>
            <li><a href="#" className="block rounded-input px-3 py-2 hover:bg-brand-forest-tint">RFQs</a></li>
            <li><a href="#" className="block rounded-input px-3 py-2 hover:bg-brand-forest-tint">Messages</a></li>
            <li><a href="#" className="block rounded-input px-3 py-2 hover:bg-brand-forest-tint">Compliance</a></li>
          </ul>
        </MobileDrawer>
      </section>

      {/* ── Wizard + StickyActionBar ─────────────────────────────── */}
      <section>
        <h3 className="font-display text-base font-semibold text-ink-primary">
          Wizard · StickyActionBar
        </h3>
        <div className="mt-3 flex flex-wrap items-start gap-6">
          {BREAKPOINTS.map((bp) => (
            <BreakpointFrame key={bp.width} width={bp.width} label={bp.label.split(" · ")[1]!}>
              <Wizard steps={WIZ_STEPS} current={step}>
                <div className="rounded-card border border-hairline bg-surface-l1 p-4">
                  <p className="font-display text-sm font-semibold text-ink-primary">
                    {WIZ_STEPS[step]?.label} content
                  </p>
                  <p className="mt-1 text-sm text-ink-secondary">
                    Step body goes here. Pair with StickyActionBar below.
                  </p>
                </div>
                <StickyActionBar>
                  <Button
                    variant="outline"
                    disabled={step === 0}
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                  >
                    Back
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() =>
                      setStep((s) => Math.min(WIZ_STEPS.length - 1, s + 1))
                    }
                  >
                    {step === WIZ_STEPS.length - 1 ? "Submit" : "Next"}
                  </Button>
                </StickyActionBar>
              </Wizard>
            </BreakpointFrame>
          ))}
        </div>
      </section>

      {/* ── MasterDetail ─────────────────────────────────────────── */}
      <section>
        <h3 className="font-display text-base font-semibold text-ink-primary">
          MasterDetail
        </h3>
        <div className="mt-3 grid gap-6 lg:grid-cols-2">
          {(["list", "detail"] as const).map((mode) => (
            <BreakpointFrame key={mode} width={1024} label={`${mode.toUpperCase()} mode at 1024`}>
              <MasterDetail
                mode={mode}
                list={
                  <div className="rounded-card border border-hairline bg-surface-l1 p-3">
                    <p className="font-display text-sm font-semibold text-ink-primary">
                      List pane
                    </p>
                    <p className="mt-1 text-xs text-ink-secondary">
                      Threads, RFQs, orders, claim queue — anything with a
                      list ↔ detail relationship.
                    </p>
                  </div>
                }
                detail={
                  <div className="rounded-card border border-hairline bg-surface-l1 p-3">
                    <p className="font-display text-sm font-semibold text-ink-primary">
                      Detail pane
                    </p>
                    <p className="mt-1 text-xs text-ink-secondary">
                      Renders side-by-side on <code className="font-mono text-[11px]">lg+</code>;
                      below <code className="font-mono text-[11px]">lg</code> only the active mode pane is visible.
                    </p>
                  </div>
                }
              />
            </BreakpointFrame>
          ))}
        </div>
      </section>

      {/* ── SidebarRail ──────────────────────────────────────────── */}
      <section>
        <h3 className="font-display text-base font-semibold text-ink-primary">
          SidebarRail (tablet icon-rail)
        </h3>
        <p className="mt-1 text-sm text-ink-secondary">
          Standalone variant; R2 will mount this at
          <code className="font-mono text-[12px]"> hidden md:flex lg:hidden</code> while leaving the
          existing full sidebar at <code className="font-mono text-[12px]">lg:flex</code>.
        </p>
        <div className="mt-3 flex flex-wrap items-start gap-6">
          {(["buyer", "supplier", "admin"] as const).map((v) => (
            <div key={v} className="flex flex-col gap-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-tertiary">
                variant = {v}
              </p>
              <div className="overflow-x-clip rounded-card border border-hairline bg-bg-l0 p-3" style={{ height: 520 }}>
                <SidebarRail variant={v} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── BottomTabBar ─────────────────────────────────────────── */}
      <section>
        <h3 className="font-display text-base font-semibold text-ink-primary">
          BottomTabBar (phone-only)
        </h3>
        <p className="mt-1 text-sm text-ink-secondary">
          Pure mock here — in production it&apos;s
          <code className="font-mono text-[12px]"> position: fixed; bottom: 0</code> with
          <code className="font-mono text-[12px]"> .safe-bottom-0</code>. R2 will wire it at
          <code className="font-mono text-[12px]"> md:hidden</code>.
        </p>
        <div className="mt-3 flex flex-wrap items-start gap-6">
          {(["buyer", "supplier", "admin"] as const).map((v) => (
            <BreakpointFrame key={v} width={360} label={`${v} · 360`}>
              {/* Wrap so the fixed positioning is contained within the
                 frame for visual demo purposes. */}
              <div className="relative h-[140px]">
                <BottomTabBar
                  variant={v}
                  className="!relative !left-auto !right-auto !bottom-auto"
                />
              </div>
            </BreakpointFrame>
          ))}
        </div>
      </section>

      {/* ── FilterRailResponsive ─────────────────────────────────── */}
      <section>
        <h3 className="font-display text-base font-semibold text-ink-primary">
          FilterRailResponsive (mobile Discover filter sheet)
        </h3>
        <p className="mt-1 text-sm text-ink-secondary">
          Renders nothing at <code className="font-mono text-[12px]">≥md</code>; below md
          surfaces a Filters trigger + applied-filter chip row. R3/R4
          swap this into the live Discover surfaces.
        </p>
        <div className="mt-3 flex flex-wrap items-start gap-6">
          <BreakpointFrame width={360} label="360">
            <FilterRailResponsive
              applied={[
                { key: "city:Dhaka", label: "Dhaka", removeHref: "#" },
                { key: "cert:OEKO_TEX", label: "OEKO-TEX", removeHref: "#" },
                { key: "min:3", label: "≥3 sources", removeHref: "#" },
              ]}
              resetHref="#"
              sheetBody={
                <FormGrid cols={1}>
                  <label className="flex flex-col gap-1 text-sm text-ink-secondary">
                    City
                    <input
                      type="text"
                      placeholder="Dhaka"
                      className="rounded-input border border-hairline px-2 py-2 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-ink-secondary">
                    Category
                    <select className="rounded-input border border-hairline px-2 py-2 text-sm">
                      <option>Any</option>
                      <option>Knit composite</option>
                      <option>Woven</option>
                    </select>
                  </label>
                </FormGrid>
              }
            />
          </BreakpointFrame>
          <BreakpointFrame width={768} label="768">
            <FilterRailResponsive
              applied={[]}
              resetHref="#"
              sheetBody={<p className="text-sm">Hidden at ≥md — desktop FilterRail renders inline above results.</p>}
            />
            <p className="mt-2 text-xs text-ink-tertiary">
              (No visible chrome — correct at ≥md.)
            </p>
          </BreakpointFrame>
        </div>
      </section>

      {/* ── Live-decoration footer ───────────────────────────────── */}
      <section className="rounded-card border border-hairline bg-surface-l1 p-4">
        <p className="font-display text-sm font-semibold text-ink-primary">
          R1 done when every primitive above ✓ at every breakpoint frame
        </p>
        <ul className="mt-2 list-inside list-disc text-sm text-ink-secondary">
          <li className="inline-flex items-center gap-2"><Eye size={14} aria-hidden /> No horizontal overflow in any frame.</li>
          <li className="inline-flex items-center gap-2"><ShieldCheck size={14} aria-hidden /> Every interactive element ≥ 44×44 px.</li>
        </ul>
      </section>
    </section>
  );
}
