"use client";

// Hero buyer-dashboard demo — /home-demo only.
//
// The approved static dashboard window (hero-product-window.tsx) brought to
// life with ONE looping "Find matches" workflow. This is NOT a redesign:
// every dashboard element keeps its exact approved markup/classes, and the
// Find-matches page is a hero-scaled replica of the REAL /app/match Smart
// Match wizard (app/(app)/app/match/* + PageHeader + StepBar + proto-card
// steps + DiscoverResultCard results with "Matched on:" pills). Nothing is
// invented — every surface, control, and state mirrors the production UI.
//
// Story (~22.6s loop):
//   idle → cursor glides to "Find matches" → hover → click → SPA content
//   crossfade (sidebar + top chrome stay fixed) → Smart Match wizard →
//   click "What are you making?" → type "Knit shirts" (~130–150ms/key,
//   word pause) → select Factory → Next: requirements → select OEKO-TEX →
//   select BGMEA → Next: review → criteria pills → Find matches →
//   "Matching…" → results stagger in (real DiscoverResultCard layout) →
//   follow the first supplier via the card's bell (the real SaveButton
//   affordance; flips on press RELEASE, sidebar count 10→11 odometer) →
//   click the brand mark → dashboard returns, Saved-suppliers tile ticks
//   10→11 → 1.5s dwell → seamless loop.
//
// Animation language is IDENTICAL to the RFQ/buyer-workflow bento
// (buyer-workflow-bento.tsx): same event-mark master clock (React renders
// only at event boundaries, never per frame), same cursor SVG, same
// CURSOR_EASE glide (0.7s), same press scale/click ripple, same
// state-flips-on-release rule, same reduced-motion behavior (settled
// static dashboard). All transitions are transform/opacity/color only —
// plus native smooth pane scrolling where a real user would scroll.
//
// Loop seam: after the first pass the cursor rests on the brand mark it
// just clicked (no teleport). The bumped counts (11) persist into the next
// loop and reset invisibly — the stat tile while the match page covers it,
// the sidebar badge mid-typing while the eye is locked on the input.
//
// Mobile (< md) is the REAL product mobile shell, not a scaled desktop:
// the production bottom tab bar pattern (Discover · Match · Saved ·
// Messages · RFQs) replaces the sidebar, the wizard stacks, and the pane
// auto-scrolls each upcoming control into view exactly as a thumb would.
// The same cursor convention is kept on mobile — matching the existing
// buyer-workflow demo, which uses the cursor on mobile stacks too.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BellRinging,
  BookmarkSimple,
  CalendarBlank,
  Certificate,
  ChatCircleText,
  CheckCircle,
  Clock,
  FileText,
  GearSix,
  Lifebuoy,
  MagnifyingGlass,
  MapPin,
  Package,
  ShieldCheck,
  SidebarSimple,
  SignOut,
  Sparkle,
  Star,
  WarningCircle,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

import { ENTITY_TYPES } from "@/components/discover/filter-rail";
import { BrandMark } from "@/components/marketing/logo";
import { ProductIcon } from "@/components/supplier/product-icon";
import { UserAvatar } from "@/components/shell/user-avatar";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Section } from "@/components/ui/page-kit";
import { formatCompanyName } from "@/lib/format-company-name";
import { formatCardLocation } from "@/lib/format-location";
import { dedupProducts } from "@/lib/product-icons";
import { publicRoleLabel } from "@/lib/shell/role-label";
import { sourceLogo } from "@/lib/source-logos";
import { cn } from "@/lib/utils";

/* ─── Master clock (same engine as buyer-workflow-bento) ───────── */

const LOOP_MS = 22_600;

/**
 * Every state change in the loop, in ms from loop start. `*Scroll` marks
 * fire ~300–400ms before their glide so the pane's smooth scroll settles
 * before the cursor measures its landing point.
 */
const T = {
  // Idle 0–0.8s (ambient pulses only), then the cursor departs.
  cursorIn: 800,
  // Glide lands on "Find matches" → hover 250ms → click → release.
  navHover: 1500,
  navClick: 1750,
  navRelease: 1900, // nav flips active; content crossfade starts (300ms)
  matchIn: 2200, // wizard page settled (header + step bar + Step 1)
  // Step 1 · Product — click the "What are you making?" input.
  s1Scroll: 2300,
  s1FieldGlide: 2700,
  s1FieldHover: 3400,
  s1FieldClick: 3550,
  s1FieldRelease: 3680, // focus ring + caret
  // "Knit shirts" — human cadence (130–150ms/key, pause after the word).
  k1: 3950,
  k2: 4085,
  k3: 4220,
  k4: 4360,
  k5: 4790, // space — word pause before it
  k6: 4930,
  k7: 5065,
  k8: 5200,
  k9: 5340,
  k10: 5475,
  k11: 5610,
  // Select "Factory", then Next: requirements.
  s1ChipScroll: 5900,
  s1ChipGlide: 6300,
  s1ChipHover: 7000,
  s1ChipClick: 7250,
  s1ChipRelease: 7400,
  s1NextScroll: 7600,
  s1NextGlide: 8000,
  s1NextHover: 8700,
  s1NextClick: 8950,
  s1NextRelease: 9100, // Step 2 swaps in
  // Step 2 · Must-haves — OEKO-TEX cert, BGMEA membership, Next: review.
  s2CertScroll: 9400,
  s2CertGlide: 9800,
  s2CertHover: 10500,
  s2CertClick: 10750,
  s2CertRelease: 10900,
  s2RegGlide: 11100,
  s2RegHover: 11800,
  s2RegClick: 12050,
  s2RegRelease: 12200,
  s2NextScroll: 12400,
  s2NextGlide: 12800,
  s2NextHover: 13500,
  s2NextClick: 13750,
  s2NextRelease: 13900, // Step 3 swaps in
  // Step 3 · Review & match — criteria pills, then Find matches.
  s3GoScroll: 14400,
  s3GoGlide: 14700,
  s3GoHover: 15400,
  s3GoClick: 15650,
  s3GoRelease: 15800, // button flips to "Matching…" on RELEASE
  // Results stagger in (100ms apart, 8px rise + fade), pane scrolls down
  // to them exactly as a reader would.
  results1: 16500,
  results2: 16600,
  results3: 16700,
  resultsScroll: 16750,
  // Follow the first match via the card's bell (the real SaveButton).
  bellScroll: 17000,
  bellGlide: 17300,
  bellHover: 18000,
  bellClick: 18250,
  bellRelease: 18400, // bell fills on RELEASE
  badgeBump: 18550, // sidebar Saved suppliers 10 → 11 odometer
  // Dwell on the confirmation, then back home via the brand mark.
  homeGlide: 19400,
  homeHover: 20100,
  homeClick: 20350,
  homeRelease: 20500, // crossfade back (300ms)
  dashIn: 20800,
  tileBump: 21100, // Saved-suppliers stat tile ticks 10 → 11
  // 21.1s → 22.6s: final dwell (≥1.2s) before the seamless wrap.
} as const;

const EVENT_TIMES = [...new Set(Object.values(T))].sort((a, b) => a - b);

/**
 * Returns the timestamp of the last event that has fired. While the clock
 * runs, the pre-first-event idle window reports 0 (a "loop is live" mark
 * distinct from -1 = clock off/reduced), so state that persists across
 * the loop seam — the bumped saved counts, the parked cursor — survives
 * the wrap instead of snapping back during the idle dwell. State only
 * updates when an event boundary is crossed, so the demo re-renders ~55
 * times per 22.6s loop, never per frame. Reduced motion pins the mark at
 * -1 — the settled idle dashboard (today's approved static hero).
 */
function useDemoClock(active: boolean, reduce: boolean) {
  const [mark, setMark] = useState<number>(-1);

  useEffect(() => {
    if (reduce || !active) {
      setMark(-1);
      return;
    }
    let raf = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - started) % LOOP_MS;
      let current = 0;
      for (const t of EVENT_TIMES) {
        if (elapsed >= t) current = t;
        else break;
      }
      setMark((prev) => (prev === current ? prev : current));
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [active, reduce]);

  return mark;
}

/* ─── Fixture (shapes match buyer_dashboard + DiscoverRow) ─────── */

const BUYER_NAME = "Rezan Ferdous";
const BUYER_AVATAR = "/marketing/buyer-avatar.jpg";

type SavedCard = {
  id: string;
  slug: string;
  company_name: string;
  entity_type: string;
  city: string | null;
  district: string | null;
  source_tags: string[];
  completeness_pct: number;
  t13_source_count: number;
  employees_total: number | null;
  established_date: string | null;
  principal_products: string[];
};

type Alert = {
  supplier_id: string;
  supplier_slug: string;
  company_name: string;
  cert_kind: string;
  expires_on: string;
};

type ActivityKind = "saved" | "cert_added" | "cert_expired" | "rsc_updated";

type ActivityEvent = {
  kind: ActivityKind;
  supplier_id: string;
  supplier_slug: string;
  company_name: string;
  event_at_label: string;
  detail: string | null;
};

const SAVED: SavedCard[] = [
  {
    id: "fixture-crown",
    slug: "crown-knitwear-ltd",
    company_name: "Crown Knitwear Ltd",
    entity_type: "factory",
    city: null,
    district: "Mymensingh",
    source_tags: ["BGMEA", "RSC", "OEKO_TEX", "EPB"],
    completeness_pct: 78,
    t13_source_count: 4,
    employees_total: 1200,
    established_date: "2008-01-01",
    principal_products: ["Knit Shirt", "Polo Shirt", "T-Shirt"],
  },
  {
    id: "fixture-tm",
    slug: "tm-jeans-ltd",
    company_name: "Tm Jeans Ltd",
    entity_type: "factory",
    city: null,
    district: "Gazipur",
    source_tags: ["BGMEA", "WRAP", "RSC"],
    completeness_pct: 71,
    t13_source_count: 3,
    employees_total: 850,
    established_date: "2012-01-01",
    principal_products: ["Denim", "Jeans"],
  },
];

const ALERTS: Alert[] = [
  {
    supplier_id: "fixture-sm",
    supplier_slug: "s-m-knitwears-limited",
    company_name: "S M KNITWEARS LIMITED",
    cert_kind: "wrap",
    expires_on: "2026-07-21",
  },
  {
    supplier_id: "fixture-prime",
    supplier_slug: "prime-cap-bd-ltd",
    company_name: "PRIME CAP (BD) LTD.",
    cert_kind: "wrap",
    expires_on: "2026-07-23",
  },
  {
    supplier_id: "fixture-iris",
    supplier_slug: "iris-fabrics-ltd",
    company_name: "IRIS FABRICS LTD",
    cert_kind: "wrap",
    expires_on: "2026-07-25",
  },
];

const ACTIVITY: ActivityEvent[] = [
  {
    kind: "saved",
    supplier_id: "fixture-crown",
    supplier_slug: "crown-knitwear-ltd",
    company_name: "Crown Knitwear Ltd",
    event_at_label: "1d ago",
    detail: null,
  },
  {
    kind: "cert_expired",
    supplier_id: "fixture-vintage",
    supplier_slug: "vintage-denim-apparels-ltd",
    company_name: "Vintage Denim Apparels Ltd.",
    event_at_label: "11d ago",
    detail: "wrap",
  },
  {
    kind: "rsc_updated",
    supplier_id: "fixture-square",
    supplier_slug: "square-textiles-ltd",
    company_name: "Square Textiles Ltd.",
    event_at_label: "27d ago",
    detail: "100",
  },
];

// Illustrative fixture values — a lived-in workspace, consistent with the
// unread dot in the sidebar.
const STATS = {
  saved_count: 10,
  active_rfqs: 2,
  active_orders: 1,
  alerts: ALERTS.length,
  unread_messages: 2,
};

// The typed wizard brief and its marks.
const TYPED_QUERY = "knit shirts";
const TYPE_MARKS = [
  T.k1,
  T.k2,
  T.k3,
  T.k4,
  T.k5,
  T.k6,
  T.k7,
  T.k8,
  T.k9,
  T.k10,
  T.k11,
] as const;

// Wizard option sets — locked copies of the real /app/match allow-lists
// (smart-match-wizard.tsx).
const WIZARD_ENTITY_TYPES = ["Factory", "Buying house"] as const;
const WIZARD_CERTS = ["WRAP", "OEKO-TEX", "GOTS", "SA8000"] as const;
const WIZARD_REGISTRIES = [
  "BGMEA",
  "BKMEA",
  "BTMA",
  "BGAPMEA",
  "EPB (gov)",
  "RSC remediation",
] as const;

const REVIEW_CRITERIA = [
  "Product: knit shirts",
  "Type: Factory",
  "Cert: OEKO-TEX",
  "Registry: BGMEA",
] as const;

// Real production numbers for this exact brief (knit shirts · Factory ·
// OEKO-TEX · BGMEA): 405 matches, first page of 24.
const MATCH_TOTAL = 405;
const MATCH_PAGE = 24;

// Match results — same DiscoverRow shape the real ResultsPanel renders.
// Row 1 is the REAL top result for this brief (production screenshot,
// 23 Jul); reason pills use the real match_reasons grammar ("Makes …",
// "Certified: …", "BGMEA-verified - #…"). Crown Knitwear appears
// already-following, consistent with the dashboard's saved list. Only the
// first page's top rows render — the header + Load more carry the 405.
type MatchRow = {
  name: string;
  entity: string;
  location: string;
  tags: string[];
  sources: number;
  employees: number;
  est: string;
  products: string[];
  /** "+N more categories" overflow, as on the real card. */
  extraProducts?: number;
  reasons: string[];
  following: boolean;
};

const MATCHES: MatchRow[] = [
  {
    name: "Apparel Promoters Ltd",
    entity: "Factory",
    location: "Chittagong",
    tags: ["BGMEA", "OEKO_TEX", "EPB", "RSC", "WRAP", "GOTS"],
    sources: 6,
    employees: 2000,
    est: "2000",
    products: ["Denim Jacket", "Jeans", "Knit Shirts"],
    extraProducts: 11,
    reasons: [
      "Certified: OEKO-TEX",
      "BGMEA-verified - #3110",
      "Makes Knit Shirts",
    ],
    following: false,
  },
  {
    name: "Crown Knitwear Ltd",
    entity: "Factory",
    location: "Mymensingh",
    tags: ["BGMEA", "RSC", "OEKO_TEX", "EPB"],
    sources: 4,
    employees: 1200,
    est: "2008",
    products: ["Knit Shirt", "Polo Shirt", "T-Shirt"],
    reasons: [
      "Certified: OEKO-TEX",
      "BGMEA-verified - #2418",
      "Makes Knit Shirts",
    ],
    following: true,
  },
  {
    name: "Tex Town Ltd.",
    entity: "Factory",
    location: "Dhaka",
    tags: ["BKMEA", "GOTS", "OEKO_TEX", "EPB"],
    sources: 4,
    employees: 2100,
    est: "2005",
    products: ["Knit", "Sweater"],
    reasons: ["Certified: OEKO-TEX", "Makes Knit Shirts"],
    following: false,
  },
  {
    name: "S M Knitwears Limited",
    entity: "Factory",
    location: "Gazipur",
    tags: ["BGMEA", "WRAP", "OEKO_TEX"],
    sources: 3,
    employees: 950,
    est: "2011",
    products: ["Knitwear", "T-Shirt"],
    reasons: [
      "Certified: OEKO-TEX",
      "BGMEA-verified - #1580",
      "Makes Knit Shirts",
    ],
    following: true,
  },
];

/* ─── Sidebar slots (locked copy of BUYER_SECTIONS) ────────────── */

type Slot = {
  label: string;
  href: string;
  Icon: Icon;
  badge?: { text: string; kind: "neutral" | "alert" | "dot" };
};

const SIDEBAR_SECTIONS: { label: string; slots: Slot[] }[] = [
  {
    label: "Discover",
    slots: [
      {
        label: "Search suppliers",
        href: "/app/discover",
        Icon: MagnifyingGlass,
      },
      { label: "Find matches", href: "/app/match", Icon: Sparkle },
      {
        label: "Saved suppliers",
        href: "/app/saved",
        Icon: BookmarkSimple,
        badge: { text: String(STATS.saved_count), kind: "neutral" },
      },
    ],
  },
  {
    label: "Activity",
    slots: [
      {
        label: "Messages",
        href: "/app/messages",
        Icon: ChatCircleText,
        badge: { text: "", kind: "dot" },
      },
      { label: "RFQs", href: "/app/rfqs", Icon: FileText },
      { label: "Orders", href: "/app/orders", Icon: Package },
    ],
  },
  {
    label: "Compliance",
    slots: [
      {
        label: "Compliance",
        href: "/app/compliance",
        Icon: ShieldCheck,
        badge: { text: String(STATS.alerts), kind: "alert" },
      },
    ],
  },
  {
    label: "Account",
    slots: [
      { label: "Settings", href: "/app/settings", Icon: GearSix },
      { label: "Help & support", href: "/app/help", Icon: Lifebuoy },
    ],
  },
];

// Mobile bottom tab bar — first five slots of the flattened buyer IA with
// the production short labels (components/shell/bottom-tab-bar.tsx).
const MOBILE_TABS: { key: string; label: string; Icon: Icon }[] = [
  { key: "discover", label: "Discover", Icon: MagnifyingGlass },
  { key: "match", label: "Match", Icon: Sparkle },
  { key: "saved", label: "Saved", Icon: BookmarkSimple },
  { key: "messages", label: "Messages", Icon: ChatCircleText },
  { key: "rfqs", label: "RFQs", Icon: FileText },
];

/* ─── Shared primitives ────────────────────────────────────────── */

const CURSOR_EASE = [0.3, 0.1, 0.25, 1] as const;

/** Tiny always-breathing status dot — same idiom as the workflow bento. */
function AmbientDot({
  className,
  reduce,
}: {
  className?: string;
  reduce: boolean;
}) {
  return (
    <motion.span
      className={cn("block rounded-full bg-brand-forest", className)}
      animate={reduce ? undefined : { opacity: [0.7, 1, 0.7] }}
      transition={
        reduce
          ? undefined
          : { duration: 3, repeat: Infinity, ease: "easeInOut" }
      }
      aria-hidden
    />
  );
}

/**
 * 10 → 11 odometer roll for the sidebar badge. `animate` is false during
 * the invisible loop reset so the return trip is an instant snap, never a
 * visible downward roll.
 */
function RollingCount({
  bumped,
  animate,
  from,
  to,
}: {
  bumped: boolean;
  animate: boolean;
  from: string;
  to: string;
}) {
  return (
    // 1.5em rows match the badge's inherited line-height, so swapping the
    // static "10" for the roller never changes the badge's box.
    <span className="inline-flex h-[1.5em] flex-col overflow-hidden align-bottom leading-[1.5em]">
      <span
        className={cn(
          "flex flex-col",
          animate &&
            "transition-transform duration-300 [transition-timing-function:cubic-bezier(0.3,0.1,0.25,1)]",
          bumped && "-translate-y-1/2",
        )}
      >
        <span className="h-[1.5em] tabular-nums">{from}</span>
        <span className="h-[1.5em] tabular-nums">{to}</span>
      </span>
    </span>
  );
}

function FollowIconStatic() {
  return (
    <span
      aria-hidden
      className="flex size-6 shrink-0 items-center justify-center rounded-full border border-brand-forest/30 bg-brand-forest-soft text-brand-forest"
    >
      <BellRinging size={12} weight="fill" />
    </span>
  );
}

function CompactMark({ tag }: { tag: string }) {
  const logo = sourceLogo(tag);
  const label = tag === "OEKO_TEX" ? "OEKO-TEX" : tag;
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="flex size-[22px] shrink-0 items-center justify-center rounded-[5px] border border-[rgba(15,15,20,0.065)] bg-[#fafaf9] font-mono text-[9px] font-bold text-[#4a4a55]"
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-full w-full rounded-[4px] object-contain p-0.5" />
      ) : (
        label.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase()
      )}
    </span>
  );
}

/** Hero-scaled company monogram tile — same idiom as CompanyAvatar. */
function MonogramTile({ name, verified }: { name: string; verified: boolean }) {
  const mono =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?";
  return (
    <span className="relative inline-flex size-10 shrink-0">
      <span
        className="flex size-10 items-center justify-center rounded-lg border border-neutral-200/60 bg-neutral-100 font-display text-[14px] font-bold tracking-[-0.02em] text-neutral-900 shadow-[0_1px_4px_rgba(15,15,20,0.07)]"
        style={{ borderColor: "rgba(15,15,20,0.06)" }}
      >
        {mono}
      </span>
      {verified ? (
        <span className="absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full border-2 border-white bg-brand-forest">
          <span className="text-[7px] font-bold leading-none text-white">✓</span>
        </span>
      ) : null}
    </span>
  );
}

/** Hero-only compact saved-supplier preview — same fields as DiscoverResultCard,
 *  denser type/spacing so it fits the middle-layer frame. */
function CompactSavedCard({ c }: { c: SavedCard }) {
  const name = formatCompanyName(c.company_name);
  const location = formatCardLocation(null, c.city, c.district);
  const entityLabel =
    ENTITY_TYPES.find((o) => o.value === c.entity_type)?.label ??
    c.entity_type.replace(/_/g, " ");
  const marks = c.source_tags.slice(0, 3);
  const extraMarks = Math.max(0, c.source_tags.length - marks.length);
  const products = dedupProducts(c.principal_products).slice(0, 3);

  return (
    <article className="overflow-hidden rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-left shadow-sm">
      <div className="flex items-start gap-2.5">
        <MonogramTile name={name} verified={c.t13_source_count > 0} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-display text-[14px] font-black leading-tight tracking-[-0.02em] text-neutral-900">
              {name}
            </h3>
            <FollowIconStatic />
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[12px] font-medium text-neutral-600">
            <span className="inline-flex items-center rounded-pill bg-neutral-100 px-1.5 py-0.5 text-[12px] font-semibold text-neutral-600">
              {entityLabel}
            </span>
            {location ? (
              <>
                <MapPin
                  size={12}
                  weight="fill"
                  aria-hidden
                  className="shrink-0 text-neutral-400"
                />
                <span className="truncate">{location}</span>
              </>
            ) : null}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-neutral-600">
            {marks.map((tag) => (
              <CompactMark key={tag} tag={tag} />
            ))}
            {extraMarks > 0 ? (
              <span className="text-neutral-500">+{extraMarks}</span>
            ) : null}
            <span className="font-medium text-neutral-700">
              Verified by {c.t13_source_count} sources
            </span>
          </div>
          {products.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] font-medium leading-snug text-neutral-700">
              {products.map((product) => (
                <span key={product} className="inline-flex items-center gap-1">
                  <ProductIcon
                    product={product}
                    className="product-icon preview-product-icon !h-3.5 !w-3.5 shrink-0 text-neutral-400"
                  />
                  {product}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function prettyCert(k: string): string {
  switch (k) {
    case "wrap":
      return "WRAP";
    case "oeko_tex":
      return "OEKO-TEX";
    case "gots":
      return "GOTS";
    case "sa8000":
      return "SA8000";
    default:
      return k.toUpperCase();
  }
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function activityLabel(ev: ActivityEvent): string {
  if (ev.kind === "saved") return "added to your saved list";
  if (ev.kind === "cert_added")
    return `${prettyCert(ev.detail ?? "")} certification recorded`;
  if (ev.kind === "cert_expired")
    return `${prettyCert(ev.detail ?? "")} certification expired`;
  if (ev.kind === "rsc_updated") {
    const p = ev.detail ? Number.parseFloat(ev.detail) : NaN;
    return Number.isFinite(p)
      ? `RSC remediation now at ${Math.round(p)}%`
      : "RSC remediation update";
  }
  return "Update";
}

function ActivityIcon({ kind }: { kind: ActivityKind }) {
  const sz = 16;
  if (kind === "saved")
    return <Star size={sz} weight="fill" className="text-sem-amber" aria-hidden />;
  if (kind === "cert_added")
    return <Certificate size={sz} weight="fill" className="text-sem-green" aria-hidden />;
  if (kind === "cert_expired")
    return <Clock size={sz} weight="fill" className="text-sem-red" aria-hidden />;
  return <ShieldCheck size={sz} weight="fill" className="text-brand-forest" aria-hidden />;
}

/* ─── Demo cursor — identical language to the workflow bento ───── */

type CursorTargets = {
  /** Sidebar "Find matches" row (desktop) / bottom "Match" tab (mobile). */
  nav: RefObject<HTMLDivElement | null>;
  navMobile: RefObject<HTMLLIElement | null>;
  field: RefObject<HTMLDivElement | null>;
  chip: RefObject<HTMLSpanElement | null>;
  next1: RefObject<HTMLSpanElement | null>;
  cert: RefObject<HTMLSpanElement | null>;
  reg: RefObject<HTMLSpanElement | null>;
  next2: RefObject<HTMLSpanElement | null>;
  go: RefObject<HTMLSpanElement | null>;
  /** Desktop rail bell / mobile header-row bell — responsive twins. */
  bell: RefObject<HTMLSpanElement | null>;
  bellMobile: RefObject<HTMLSpanElement | null>;
  /** Sidebar brand mark (desktop) / top-chrome brand mark (mobile). */
  home: RefObject<HTMLSpanElement | null>;
  homeMobile: RefObject<HTMLSpanElement | null>;
};

const CLICK_MARKS = [
  T.navClick,
  T.s1FieldClick,
  T.s1ChipClick,
  T.s1NextClick,
  T.s2CertClick,
  T.s2RegClick,
  T.s2NextClick,
  T.s3GoClick,
  T.bellClick,
  T.homeClick,
] as const;

const PRESS_WINDOWS: readonly [number, number][] = [
  [T.navClick, T.navRelease],
  [T.s1FieldClick, T.s1FieldRelease],
  [T.s1ChipClick, T.s1ChipRelease],
  [T.s1NextClick, T.s1NextRelease],
  [T.s2CertClick, T.s2CertRelease],
  [T.s2RegClick, T.s2RegRelease],
  [T.s2NextClick, T.s2NextRelease],
  [T.s3GoClick, T.s3GoRelease],
  [T.bellClick, T.bellRelease],
  [T.homeClick, T.homeRelease],
];

function DemoCursor({
  mark,
  reduce,
  persist,
  frameRef,
  targets,
}: {
  mark: number;
  reduce: boolean;
  /** After the first full pass the cursor stays parked on the brand mark
   *  across the loop wrap — no teleport, no fade, a seamless seam. */
  persist: boolean;
  frameRef: RefObject<HTMLDivElement | null>;
  targets: CursorTargets;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const visible =
    !reduce && mark >= 0 && (persist || mark >= T.cursorIn);
  const pressed =
    !reduce && PRESS_WINDOWS.some(([a, b]) => mark >= a && mark < b);

  useEffect(() => {
    if (reduce) return;
    const frame = frameRef.current;
    if (!frame) return;
    const f = frame.getBoundingClientRect();
    const at = (
      el: Element | null,
      fx: number,
      fy: number,
    ): { x: number; y: number } | null => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      // Hidden responsive twin (display:none) measures 0×0 — skip it so
      // the visible layout's element wins on both desktop and mobile.
      if (r.width === 0 || r.height === 0) return null;
      return {
        x: r.left - f.left + r.width * fx,
        y: r.top - f.top + r.height * fy,
      };
    };
    const navPos = () =>
      at(targets.nav.current, 0.32, 0.5) ??
      at(targets.navMobile.current, 0.5, 0.42);
    const homePos = () =>
      at(targets.home.current, 0.55, 0.6) ??
      at(targets.homeMobile.current, 0.55, 0.6);

    let next: { x: number; y: number } | null = null;
    if (mark >= T.homeGlide) {
      next = homePos();
    } else if (mark >= T.bellGlide) {
      next =
        at(targets.bell.current, 0.5, 0.55) ??
        at(targets.bellMobile.current, 0.5, 0.55);
    } else if (mark >= T.s3GoGlide) {
      next = at(targets.go.current, 0.55, 0.55);
    } else if (mark >= T.s2NextGlide) {
      next = at(targets.next2.current, 0.55, 0.55);
    } else if (mark >= T.s2RegGlide) {
      next = at(targets.reg.current, 0.5, 0.55);
    } else if (mark >= T.s2CertGlide) {
      next = at(targets.cert.current, 0.5, 0.55);
    } else if (mark >= T.s1NextGlide) {
      next = at(targets.next1.current, 0.55, 0.55);
    } else if (mark >= T.s1ChipGlide) {
      next = at(targets.chip.current, 0.5, 0.55);
    } else if (mark >= T.s1FieldGlide) {
      next = at(targets.field.current, 0.18, 0.55);
    } else if (mark >= T.cursorIn) {
      next = navPos();
    } else {
      // Rest position between loops = the brand mark it just clicked.
      next = homePos();
    }
    if (next) {
      const committed = next;
      setPos((prev) =>
        prev && prev.x === committed.x && prev.y === committed.y
          ? prev
          : committed,
      );
    }
  }, [mark, reduce, frameRef, targets]);

  if (reduce || !pos) return null;

  const click = CLICK_MARKS.find((c) => mark >= c && mark < c + 560);

  return (
    <motion.span
      className="pointer-events-none absolute left-0 top-0 z-30"
      initial={false}
      animate={{
        x: pos.x,
        y: pos.y,
        opacity: visible ? 1 : 0,
        scale: pressed ? 0.88 : 1,
      }}
      transition={{
        // While hidden the cursor teleports; gliding only happens where
        // the viewer can see it.
        x: { duration: visible ? 0.7 : 0, ease: CURSOR_EASE },
        y: { duration: visible ? 0.7 : 0, ease: CURSOR_EASE },
        opacity: { duration: 0.2, ease: "linear" },
        scale: { duration: 0.12, ease: "linear" },
      }}
      aria-hidden
    >
      {click ? (
        <motion.span
          key={click}
          className="absolute left-[3px] top-[2px] size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-neutral-400"
          initial={{ scale: 0.3, opacity: 0.5 }}
          animate={{ scale: 1.15, opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      ) : null}
      <svg width="16" height="16" viewBox="0 0 24 24" className="drop-shadow-sm">
        <path
          d="M5.2 2.8 L19.4 11.6 L12.4 13.1 L8.9 19.8 Z"
          fill="#171717"
          stroke="#FFFFFF"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    </motion.span>
  );
}

/* ─── Sidebar — real buyer Sidebar UI (left column) ────────────── */

function Sidebar({
  activeNav,
  navHovering,
  savedBumped,
  badgeAnimate,
  reduce,
  matchRef,
  brandRef,
}: {
  activeNav: "messages" | "match";
  navHovering: boolean;
  savedBumped: boolean;
  badgeAnimate: boolean;
  reduce: boolean;
  matchRef: RefObject<HTMLDivElement | null>;
  brandRef: RefObject<HTMLSpanElement | null>;
}) {
  // Showcase: brand mark only at top (no wordmark); buyer + Sign out as one row.
  const profileSub = publicRoleLabel("buyer");

  return (
    <aside className="flex w-[240px] shrink-0 flex-col border-r border-neutral-200 bg-white pb-2.5">
      {/* Logo band — same h-14 as MainPanel's top chrome so both border-b
          hairlines form one continuous line across the border-r. */}
      <div className="mb-[10px] flex h-14 w-full shrink-0 items-center border-b border-neutral-200 pl-4 pr-3">
        <span ref={brandRef} className="inline-flex">
          <BrandMark className="h-6 w-6" glyphClassName="h-full w-full" title="SourceBD" />
        </span>
        <span
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          className="ml-auto inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-500"
        >
          <SidebarSimple size={14} weight="regular" aria-hidden />
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-hidden px-2 pt-3">
        {SIDEBAR_SECTIONS.map((section) => (
          <div key={section.label} className="flex flex-col gap-0.5">
            <p className="mb-1 px-2.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">
              {section.label}
            </p>
            {section.slots.map((slot) => {
              const { label, Icon: SlotIcon, badge } = slot;
              const isMatch = slot.href === "/app/match";
              const isMessages = slot.href === "/app/messages";
              const isSaved = slot.href === "/app/saved";
              const active =
                (isMessages && activeNav === "messages") ||
                (isMatch && activeNav === "match");
              // Hover mirrors the production sidebar hover state exactly
              // (components/shell/sidebar.tsx).
              const hovered = isMatch && navHovering && !active;
              return (
                <div
                  key={slot.href}
                  ref={isMatch ? matchRef : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-2.5 py-[8px] text-[14px] transition-colors duration-150 ease-smooth",
                    active
                      ? "bg-brand-forest-soft font-semibold text-brand-forest"
                      : "font-medium text-ink-secondary",
                    hovered && "bg-[rgba(15,15,20,0.045)] text-ink-primary",
                  )}
                >
                  <SlotIcon
                    size={18}
                    weight={active ? "fill" : "regular"}
                    aria-hidden
                    className={cn(
                      "shrink-0 transition-colors duration-150",
                      active
                        ? "text-brand-forest"
                        : hovered
                          ? "text-ink-secondary"
                          : "text-ink-tertiary",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {badge ? (
                    badge.kind === "dot" ? (
                      <AmbientDot className="size-2 shrink-0" reduce={reduce} />
                    ) : (
                      <span
                        className={cn(
                          "shrink-0 rounded-md px-1.5 py-0.5 text-[13px] font-semibold tabular-nums",
                          badge.kind === "alert"
                            ? "bg-sem-red-soft text-sem-red"
                            : "bg-[rgba(15,15,20,0.06)] text-ink-tertiary",
                        )}
                      >
                        {isSaved ? (
                          <RollingCount
                            bumped={savedBumped}
                            animate={badgeAnimate}
                            from="10"
                            to="11"
                          />
                        ) : (
                          badge.text
                        )}
                      </span>
                    )
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Account row — top hairline spans the full sidebar width */}
      <div className="mt-auto w-full border-t border-neutral-200 px-2 pt-3">
        <div className="flex items-center gap-2 rounded-lg border border-hairline bg-bg-l0 px-2 py-2">
          <UserAvatar
            avatarUrl={BUYER_AVATAR}
            displayName={BUYER_NAME}
            size="sm"
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-display text-[12px] font-bold tracking-[-0.01em] text-ink-primary">
              {BUYER_NAME}
            </span>
            <span className="truncate text-[10px] text-ink-tertiary">
              {profileSub}
            </span>
          </span>
          <span
            aria-label="Sign out"
            title="Sign out"
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-hairline bg-white px-2 py-1 text-[11px] font-semibold text-ink-secondary"
          >
            <SignOut size={13} aria-hidden />
            Sign out
          </span>
        </div>
      </div>
    </aside>
  );
}

/* ─── Mobile bottom tab bar (production pattern, hero-framed) ──── */

function MobileTabBar({
  activeNav,
  navHovering,
  matchTabRef,
}: {
  activeNav: "messages" | "match";
  navHovering: boolean;
  matchTabRef: RefObject<HTMLLIElement | null>;
}) {
  return (
    <nav
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white shadow-sm md:hidden"
    >
      <ul role="list" className="m-0 flex list-none items-stretch justify-around p-0">
        {MOBILE_TABS.map((tab) => {
          const active =
            (tab.key === "messages" && activeNav === "messages") ||
            (tab.key === "match" && activeNav === "match");
          const hovered = tab.key === "match" && navHovering && !active;
          return (
            <li
              key={tab.key}
              ref={tab.key === "match" ? matchTabRef : undefined}
              className="relative min-w-0 flex-1"
            >
              <span
                className={cn(
                  "flex h-[52px] flex-col items-center justify-center gap-1 px-0.5 transition-colors duration-150",
                  active
                    ? "text-brand-forest"
                    : hovered
                      ? "text-ink-primary"
                      : "text-ink-tertiary",
                )}
              >
                <tab.Icon size={20} weight={active ? "fill" : "regular"} aria-hidden />
                <span className="w-full truncate text-center font-display text-[11px] font-medium leading-none tracking-[-0.005em]">
                  {tab.label}
                </span>
                {active ? (
                  <span
                    aria-hidden
                    className="absolute left-1/2 top-0 h-[3px] w-8 -translate-x-1/2 rounded-pill bg-brand-forest"
                  />
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ─── Dashboard pane (the approved main body, verbatim) ────────── */

function StatTile({
  label,
  value,
  meta,
}: {
  label: string;
  value: number;
  meta: string;
}) {
  // Hero-scale compact tile — same structure as /app StatTile, denser type.
  // NumberTicker springs between values, so the Saved-suppliers tile can
  // tick 10 → 11 when the story returns to the dashboard.
  return (
    <div className="group flex h-full flex-col rounded-card border border-hairline bg-surface-l1 p-3 shadow-[0_1px_2px_rgba(15,15,20,0.05)] sm:p-3.5">
      <p className="text-[12px] font-medium leading-tight text-ink-tertiary">{label}</p>
      <NumberTicker
        value={value}
        className="mt-1.5 font-display text-[22px] font-extrabold leading-none tracking-[-0.02em] text-ink-primary"
      />
      <p className="mt-1.5 hidden text-[12px] leading-snug text-ink-tertiary sm:line-clamp-2">
        {meta}
      </p>
    </div>
  );
}

function DashboardPane({
  visible,
  savedTileValue,
}: {
  visible: boolean;
  savedTileValue: number;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 overflow-y-auto overscroll-contain px-3 pb-[68px] pt-4 transition-[opacity,transform] duration-300 ease-out [scrollbar-width:none] sm:px-5 sm:pt-5 md:pb-6 [&::-webkit-scrollbar]:hidden",
        visible ? "translate-y-0 opacity-100" : "translate-y-[6px] opacity-0",
      )}
    >
      <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
        {/* Compact page header — same content as PageHeader, hero-scaled */}
        <div className="border-b border-hairline pb-4">
          <p className="mb-1.5 inline-flex items-center gap-1.5 font-mono text-[12px] font-medium uppercase tracking-[0.12em] text-brand-forest">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-forest" />
            Buyer
          </p>
          <h2 className="font-display text-[22px] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink-primary">
            Dashboard
          </h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">
            Your sourcing activity at a glance.
          </p>
        </div>

        <section
          aria-label="Quick stats"
          className="grid grid-cols-2 gap-3 lg:grid-cols-5"
        >
          <StatTile
            label="Saved suppliers"
            value={savedTileValue}
            meta="Your shortlist for outreach"
          />
          <StatTile
            label="Active RFQs"
            value={STATS.active_rfqs}
            meta="Awaiting supplier quotes"
          />
          <StatTile
            label="Active orders"
            value={STATS.active_orders}
            meta="1 in production"
          />
          <StatTile
            label="Compliance alerts"
            value={STATS.alerts}
            meta="Certs expiring within 30 days"
          />
          <div className="hidden lg:contents">
            <StatTile
              label="Unread messages"
              value={STATS.unread_messages}
              meta="Crown Knitwear replied"
            />
          </div>
        </section>

        <Section
          title="Alerts"
          description="Certifications expiring in the next 30 days"
        >
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {ALERTS.map((a) => (
              <li
                key={`${a.supplier_id}-${a.cert_kind}-${a.expires_on}`}
                className="flex flex-wrap items-start gap-x-2 gap-y-1 rounded-card border border-sem-amber/30 bg-sem-amber-soft px-3 py-2 text-[12px] sm:flex-nowrap sm:items-center"
              >
                <WarningCircle
                  size={14}
                  weight="fill"
                  aria-hidden
                  className="shrink-0 text-sem-amber"
                />
                <span className="min-w-0 truncate font-semibold text-ink-primary">
                  {a.company_name}
                </span>
                <span className="w-full pl-6 text-ink-secondary sm:w-auto sm:pl-0">
                  · {prettyCert(a.cert_kind)} expires {fmtDate(a.expires_on)}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Saved suppliers">
          <ul className="grid grid-cols-1 gap-2">
            {SAVED.slice(0, 2).map((c) => (
              <li key={c.id}>
                <CompactSavedCard c={c} />
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Recent activity">
          <ul className="m-0 list-none divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-surface-l1 p-0">
            {ACTIVITY.map((ev, i) => (
              <li
                key={`${ev.supplier_id}-${ev.kind}-${i}`}
                className="flex items-center gap-2.5 px-3.5 py-2.5"
              >
                <ActivityIcon kind={ev.kind} />
                <p className="min-w-0 flex-1 overflow-hidden text-[12.5px]">
                  <span className="block truncate">
                    <span className="font-semibold text-ink-primary">
                      {ev.company_name}
                    </span>
                    <span className="text-ink-secondary">
                      {" "}
                      · {activityLabel(ev)}
                    </span>
                  </span>
                </p>
                <span className="shrink-0 font-mono text-[12px] text-ink-tertiary">
                  {ev.event_at_label}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}

/* ─── Smart Match wizard replica (real /app/match UI, hero-scaled) ── */

/** Hero-scaled replica of the wizard chip (CheckboxGroup button). */
function WizardChip({
  label,
  selected,
  hovered,
  chipRef,
}: {
  label: string;
  selected: boolean;
  hovered?: boolean;
  chipRef?: RefObject<HTMLSpanElement | null>;
}) {
  return (
    <span
      ref={chipRef}
      className={cn(
        "rounded-pill border px-2.5 py-1 text-[11.5px] font-medium transition-colors duration-150",
        selected
          ? "border-brand-forest bg-brand-forest-soft text-brand-forest"
          : hovered
            ? "border-brand-forest bg-surface-l1 text-ink-secondary"
            : "border-hairline-strong bg-surface-l1 text-ink-secondary",
      )}
    >
      {label}
    </span>
  );
}

/** Hero-scaled replica of the wizard Field (label + control + hint). */
function WizardField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <span className="block text-[11px] text-ink-tertiary">{label}</span>
      {children}
      {hint ? (
        <span className="block text-[11px] leading-snug text-ink-tertiary">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/** Hero-scaled primary/ghost buttons (components/ui/button in the wizard). */
function WizardButton({
  variant,
  hovered,
  pressed,
  children,
  btnRef,
}: {
  variant: "primary" | "ghost";
  hovered?: boolean;
  pressed?: boolean;
  children: ReactNode;
  btnRef?: RefObject<HTMLSpanElement | null>;
}) {
  return (
    <span
      ref={btnRef}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[11.5px] font-semibold transition-[background-color,color,transform] duration-150",
        variant === "primary"
          ? hovered
            ? "bg-brand-forest-mid text-white"
            : "bg-brand-forest text-white"
          : "text-ink-secondary",
        pressed && "translate-y-px",
      )}
    >
      {children}
    </span>
  );
}

/** Hero-scaled replica of the real StepBar (smart-match-wizard.tsx). */
function StepBar({ step }: { step: 1 | 2 | 3 }) {
  const labels = ["Product", "Requirements", "Review & match"] as const;
  return (
    <ol className="m-0 flex list-none items-center gap-1.5 p-0">
      {labels.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = step > n;
        const active = step === n;
        return (
          <li key={label} className="flex items-center gap-1.5">
            <span
              className={cn(
                "inline-flex h-5 min-w-[22px] items-center justify-center rounded-pill border px-1.5 text-[10.5px] transition-colors duration-200",
                done
                  ? "border-sem-green bg-sem-green-soft text-sem-green"
                  : active
                    ? "border-brand-forest bg-brand-forest-soft text-brand-forest"
                    : "border-hairline text-ink-tertiary",
              )}
            >
              {done ? <CheckCircle weight="fill" size={13} /> : n}
            </span>
            <span
              className={cn(
                "text-[10.5px] transition-colors duration-200",
                active ? "text-ink-primary" : "text-ink-tertiary",
              )}
            >
              {label}
            </span>
            {n < 3 ? <span aria-hidden className="mx-0.5 h-px w-4 bg-hairline" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

const WIZARD_INPUT_CLASS =
  "flex w-full items-center rounded-input border bg-surface-l1 px-2.5 py-1.5 text-[12px] transition-[border-color,box-shadow] duration-150";

/** Hero-scaled replica of the card's SaveButton (shape="icon") — the
 *  real follow-bell affordance; fills on press RELEASE. */
function FollowBell({
  saved,
  hovered,
  bellRef,
}: {
  saved: boolean;
  hovered?: boolean;
  bellRef?: RefObject<HTMLSpanElement | null>;
}) {
  return (
    <span
      ref={bellRef}
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors duration-150",
        saved
          ? "border-brand-forest/30 bg-brand-forest-soft text-brand-forest"
          : hovered
            ? "border-neutral-200 bg-neutral-50 text-neutral-700"
            : "text-neutral-500",
      )}
      style={!saved ? { borderColor: "rgba(15,15,20,0.08)" } : undefined}
    >
      {saved ? (
        <BellRinging size={13} weight="fill" aria-hidden />
      ) : (
        <Bell size={13} weight="regular" aria-hidden />
      )}
    </span>
  );
}

/** Hero-scaled replica of the shared DiscoverResultCard with the wizard's
 *  "Matched on:" footer pills. Same two-arrangement responsive layout:
 *  mobile stacks with a divided footer bar; sm+ adds the right rail. */
function MatchResultCard({
  m,
  shown,
  following,
  bellHovered,
  bellRef,
  bellMobileRef,
}: {
  m: MatchRow;
  shown: boolean;
  following: boolean;
  bellHovered?: boolean;
  bellRef?: RefObject<HTMLSpanElement | null>;
  bellMobileRef?: RefObject<HTMLSpanElement | null>;
}) {
  const marks = m.tags.slice(0, 3);
  const extraMarks = Math.max(0, m.tags.length - marks.length);
  return (
    <article
      className={cn(
        "overflow-hidden rounded-lg border border-neutral-200 bg-white px-3 pb-2.5 pt-3 text-left shadow-sm transition-[opacity,transform] duration-200 ease-out sm:p-3.5",
        shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
      )}
    >
      <div className="flex gap-3 sm:gap-4">
        {/* Left column: identity, trust row, products. */}
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <MonogramTile name={m.name} verified />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="truncate font-display text-[14px] font-black leading-tight tracking-[-0.02em] text-neutral-900">
                {m.name}
              </h3>
              <span className="shrink-0 sm:hidden">
                <FollowBell
                  saved={following}
                  hovered={bellHovered}
                  bellRef={bellMobileRef}
                />
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[12px] font-medium text-neutral-600">
              <span className="inline-flex items-center rounded-pill bg-neutral-100 px-1.5 py-0.5 text-[11px] font-semibold text-neutral-600">
                {m.entity}
              </span>
              <MapPin
                size={12}
                weight="fill"
                aria-hidden
                className="shrink-0 text-neutral-400"
              />
              <span className="truncate">{m.location}</span>
            </div>
            <div className="mt-2 hidden sm:block sm:space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-neutral-600">
                {marks.map((tag) => (
                  <CompactMark key={tag} tag={tag} />
                ))}
                {extraMarks > 0 ? (
                  <span className="text-neutral-500">+{extraMarks} more</span>
                ) : null}
                <span className="font-medium text-neutral-700">
                  Verified by {m.sources} sources
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] font-medium leading-snug text-neutral-700">
                {m.products.map((product) => (
                  <span key={product} className="inline-flex items-center gap-1">
                    <ProductIcon
                      product={product}
                      className="product-icon preview-product-icon !h-3.5 !w-3.5 shrink-0 text-neutral-400"
                    />
                    {product}
                  </span>
                ))}
                {m.extraProducts ? (
                  <span className="whitespace-nowrap font-semibold text-brand-forest underline decoration-brand-forest/30 underline-offset-2">
                    +{m.extraProducts} more categories
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Desktop-only right rail — bell, employees, est, CTA. The bell
            here is the cursor's target at sm+ (the mobile twin above is
            display:none there and vice versa; the cursor skips 0×0 rects). */}
        <div className="hidden w-[112px] shrink-0 flex-col items-end gap-2 pl-4 text-right sm:flex">
          <FollowBell saved={following} hovered={bellHovered} bellRef={bellRef} />
          <div className="mt-auto">
            <div className="flex items-baseline justify-end gap-1">
              <span className="font-display text-[15px] font-bold leading-none tabular-nums tracking-[-0.01em] text-neutral-800">
                {m.employees.toLocaleString()}
              </span>
              <span className="text-[11px] font-normal text-neutral-400">
                employees
              </span>
            </div>
            <div className="mt-0.5 text-[11px] font-medium text-neutral-500">
              Est. {m.est}
            </div>
            <span className="mt-1 flex items-center justify-end gap-1 text-[12px] font-semibold text-brand-forest">
              View profile
              <ArrowRight size={13} weight="bold" aria-hidden />
            </span>
          </div>
        </div>
      </div>

      {/* Mobile-only trust row + products at full card width. */}
      <div className="mt-2.5 sm:hidden">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11.5px] text-neutral-600">
          {marks.map((tag) => (
            <CompactMark key={tag} tag={tag} />
          ))}
          {extraMarks > 0 ? (
            <span className="text-neutral-500">+{extraMarks}</span>
          ) : null}
          <span className="font-medium text-neutral-700">
            Verified by {m.sources} sources
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] font-medium leading-snug text-neutral-700">
          {m.products.map((product) => (
            <span key={product} className="inline-flex items-center gap-1">
              <ProductIcon
                product={product}
                className="product-icon preview-product-icon !h-3.5 !w-3.5 shrink-0 text-neutral-400"
              />
              {product}
            </span>
          ))}
          {m.extraProducts ? (
            <span className="whitespace-nowrap font-semibold text-brand-forest underline decoration-brand-forest/30 underline-offset-2">
              +{m.extraProducts} more categories
            </span>
          ) : null}
        </div>
      </div>

      {/* "Matched on:" footer — the wizard's footerSlot pills. */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-[rgba(15,15,20,0.045)] pt-2.5">
        <span className="text-[10.5px] font-semibold text-ink-tertiary">
          Matched on:
        </span>
        {m.reasons.map((reason) => (
          <span
            key={reason}
            className="rounded-pill border border-hairline-strong bg-surface-l1 px-2 py-0.5 text-[10.5px] font-medium text-ink-primary"
          >
            {reason}
          </span>
        ))}
      </div>

      {/* Mobile-only footer bar. */}
      <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-[rgba(15,15,20,0.045)] pt-2.5 text-[11px] text-neutral-500 sm:hidden">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1">
            <CalendarBlank size={13} weight="duotone" aria-hidden className="text-neutral-400" />
            Est. {m.est}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="font-display text-[12px] font-bold tabular-nums text-neutral-700">
              {m.employees.toLocaleString()}
            </span>
            employees
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-1 font-semibold text-brand-forest">
          View profile
          <ArrowRight size={13} weight="bold" aria-hidden />
        </span>
      </div>
    </article>
  );
}

type MatchPaneState = {
  visible: boolean;
  wizardStep: 1 | 2 | 3;
  typed: string;
  fieldFocused: boolean;
  fieldHovered: boolean;
  entitySelected: boolean;
  chipS1Hovered: boolean;
  next1Hovered: boolean;
  next1Pressed: boolean;
  certSelected: boolean;
  certHovered: boolean;
  regSelected: boolean;
  regHovered: boolean;
  next2Hovered: boolean;
  next2Pressed: boolean;
  goHovered: boolean;
  goPressed: boolean;
  matching: boolean;
  resultsShown: [boolean, boolean, boolean];
  bellHovered: boolean;
  followed: boolean;
  reduce: boolean;
};

function MatchPane({
  s,
  refs,
}: {
  s: MatchPaneState;
  refs: {
    scroll: RefObject<HTMLDivElement | null>;
    field: RefObject<HTMLDivElement | null>;
    chip: RefObject<HTMLSpanElement | null>;
    next1: RefObject<HTMLSpanElement | null>;
    cert: RefObject<HTMLSpanElement | null>;
    reg: RefObject<HTMLSpanElement | null>;
    next2: RefObject<HTMLSpanElement | null>;
    go: RefObject<HTMLSpanElement | null>;
    bell: RefObject<HTMLSpanElement | null>;
    bellMobile: RefObject<HTMLSpanElement | null>;
    resultsHead: RefObject<HTMLDivElement | null>;
  };
}) {
  const anyResults = s.resultsShown[0];
  return (
    <div
      ref={refs.scroll}
      className={cn(
        "absolute inset-0 overflow-y-auto overscroll-contain px-3 pb-[68px] pt-4 transition-[opacity,transform] duration-300 ease-out [scrollbar-width:none] sm:px-5 sm:pt-5 md:pb-6 [&::-webkit-scrollbar]:hidden",
        s.visible ? "translate-y-0 opacity-100" : "translate-y-[6px] opacity-0",
      )}
    >
      <div className="mx-auto max-w-6xl space-y-4">
        {/* PageHeader replica — kicker, icon tile, title, description
            (app/(app)/app/match/page.tsx). */}
        <div className="border-b border-hairline pb-4">
          <p className="mb-1.5 inline-flex items-center gap-1.5 font-mono text-[12px] font-medium uppercase tracking-[0.12em] text-brand-forest">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-forest" />
            Find matches
          </p>
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand-forest-soft text-brand-forest"
            >
              <Sparkle size={15} weight="fill" />
            </span>
            <h2 className="min-w-0 font-display text-[22px] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink-primary">
              Tell us what you need
            </h2>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">
            Answer a few buyer-friendly questions and SourceBD will shortlist
            verified Bangladesh suppliers with verified evidence behind each
            match.
          </p>
        </div>

        <StepBar step={s.wizardStep} />

        {/* One step card at a time — same conditional swap as the real
            wizard, with a quiet 250ms rise-in on entry. */}
        {s.wizardStep === 1 ? (
          <motion.section
            key="step-1"
            initial={s.reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="space-y-4 rounded-card border border-hairline bg-surface-l1 p-4 shadow-[0_1px_2px_rgba(15,15,20,0.05)]"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-display text-[13.5px] font-bold tracking-[-0.01em] text-ink-primary">
                Step 1 — Product
              </h3>
              <span className="shrink-0 font-mono text-[10.5px] text-ink-tertiary">
                What are you sourcing?
              </span>
            </div>

            <WizardField
              label="What are you making?"
              hint="Use buyer-style intent, such as kids shirt, ladies trousers, denim jacket, or uniforms."
            >
              <div
                ref={refs.field}
                className={cn(
                  WIZARD_INPUT_CLASS,
                  s.fieldFocused
                    ? "border-brand-forest ring-2 ring-brand-forest/30"
                    : s.fieldHovered
                      ? "border-hairline-strong bg-white"
                      : "border-hairline-strong",
                )}
              >
                {s.typed ? (
                  <span className="truncate text-ink-primary">
                    {s.typed}
                    {s.fieldFocused && !s.reduce ? (
                      <span className="ml-px inline-block h-[1.1em] w-px animate-pulse bg-neutral-800 align-middle" />
                    ) : null}
                  </span>
                ) : (
                  <span className="truncate text-ink-tertiary">
                    {s.fieldFocused && !s.reduce ? (
                      <span className="mr-px inline-block h-[1.1em] w-px animate-pulse bg-neutral-800 align-middle" />
                    ) : null}
                    e.g. Shirts
                  </span>
                )}
              </div>
            </WizardField>

            <WizardField
              label="Who do you want to work with?"
              hint="Choose one if it matters. Leave both off to see all verified suppliers."
            >
              <div className="flex flex-wrap gap-1.5">
                {WIZARD_ENTITY_TYPES.map((label) => (
                  <WizardChip
                    key={label}
                    label={label}
                    selected={label === "Factory" && s.entitySelected}
                    hovered={label === "Factory" && s.chipS1Hovered}
                    chipRef={label === "Factory" ? refs.chip : undefined}
                  />
                ))}
              </div>
            </WizardField>

            <div className="flex items-center justify-end border-t border-hairline pt-3">
              <WizardButton
                variant="primary"
                hovered={s.next1Hovered}
                pressed={s.next1Pressed}
                btnRef={refs.next1}
              >
                Next: requirements
                <ArrowRight size={12} weight="bold" aria-hidden />
              </WizardButton>
            </div>
          </motion.section>
        ) : null}

        {s.wizardStep === 2 ? (
          <motion.section
            key="step-2"
            initial={s.reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="space-y-4 rounded-card border border-hairline bg-surface-l1 p-4 shadow-[0_1px_2px_rgba(15,15,20,0.05)]"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-display text-[13.5px] font-bold tracking-[-0.01em] text-ink-primary">
                Step 2 — Must-haves
              </h3>
              <span className="shrink-0 font-mono text-[10.5px] text-ink-tertiary">
                Choose the proof your buyer needs
              </span>
            </div>

            <WizardField
              label="Required certifications"
              hint="Pick the certificates your order or retailer requires."
            >
              <div className="flex flex-wrap gap-1.5">
                {WIZARD_CERTS.map((label) => (
                  <WizardChip
                    key={label}
                    label={label}
                    selected={label === "OEKO-TEX" && s.certSelected}
                    hovered={label === "OEKO-TEX" && s.certHovered}
                    chipRef={label === "OEKO-TEX" ? refs.cert : undefined}
                  />
                ))}
              </div>
            </WizardField>

            <WizardField
              label="Preferred memberships"
              hint="Use these if you need association, exporter, or RSC evidence."
            >
              <div className="flex flex-wrap gap-1.5">
                {WIZARD_REGISTRIES.map((label) => (
                  <WizardChip
                    key={label}
                    label={label}
                    selected={label === "BGMEA" && s.regSelected}
                    hovered={label === "BGMEA" && s.regHovered}
                    chipRef={label === "BGMEA" ? refs.reg : undefined}
                  />
                ))}
              </div>
            </WizardField>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <WizardField
                label="Preferred city"
                hint="Optional. Use this only if location matters."
              >
                <div className={cn(WIZARD_INPUT_CLASS, "border-hairline-strong")}>
                  <span className="truncate text-ink-tertiary">e.g. Gazipur</span>
                </div>
              </WizardField>
              <WizardField
                label="Preferred district"
                hint="Optional. Example: Dhaka, Gazipur, Chattogram."
              >
                <div className={cn(WIZARD_INPUT_CLASS, "border-hairline-strong")}>
                  <span className="truncate text-ink-tertiary">e.g. Dhaka</span>
                </div>
              </WizardField>
            </div>

            {/* Collapsed <details> replica — static, as the demo skips it. */}
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5">
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-primary">
                <span aria-hidden className="text-[9px] text-ink-tertiary">
                  ▶
                </span>
                Advanced requirements
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-hairline pt-3">
              <WizardButton variant="ghost">
                <ArrowLeft size={12} weight="bold" aria-hidden />
                Back
              </WizardButton>
              <WizardButton
                variant="primary"
                hovered={s.next2Hovered}
                pressed={s.next2Pressed}
                btnRef={refs.next2}
              >
                Next: review
                <ArrowRight size={12} weight="bold" aria-hidden />
              </WizardButton>
            </div>
          </motion.section>
        ) : null}

        {s.wizardStep === 3 ? (
          <motion.section
            key="step-3"
            initial={s.reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="space-y-4 rounded-card border border-hairline bg-surface-l1 p-4 shadow-[0_1px_2px_rgba(15,15,20,0.05)]"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-display text-[13.5px] font-bold tracking-[-0.01em] text-ink-primary">
                Step 3 — Review &amp; match
              </h3>
              <span className="shrink-0 font-mono text-[10.5px] text-ink-tertiary">
                {REVIEW_CRITERIA.length} criteria
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {REVIEW_CRITERIA.map((c) => (
                <span
                  key={c}
                  className="rounded-pill border border-hairline-strong bg-surface-l1 px-2.5 py-1 text-[11.5px] font-medium text-ink-primary"
                >
                  {c}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-hairline pt-3">
              <WizardButton variant="ghost">
                <ArrowLeft size={12} weight="bold" aria-hidden />
                Back
              </WizardButton>
              <WizardButton
                variant="primary"
                hovered={s.goHovered}
                pressed={s.goPressed}
                btnRef={refs.go}
              >
                <Sparkle size={12} weight="fill" aria-hidden />
                {s.matching ? "Matching…" : "Find matches"}
              </WizardButton>
            </div>
          </motion.section>
        ) : null}

        {/* Results — real ResultsPanel structure: header + count + sub +
            Start over, then DiscoverResultCard list with Matched-on pills. */}
        {anyResults ? (
          <section className="space-y-2.5">
            <div
              ref={refs.resultsHead}
              className="flex items-baseline justify-between gap-3"
            >
              <div className="min-w-0">
                <h3 className="font-display text-[15px] font-light tracking-tight text-ink-primary">
                  {MATCH_TOTAL} matches
                  <span className="ml-2 text-[10.5px] text-ink-tertiary">
                    against {REVIEW_CRITERIA.length} criteria
                  </span>
                </h3>
                <p className="mt-0.5 text-[11px] text-ink-tertiary">
                  Showing {MATCH_PAGE} of {MATCH_TOTAL}. Search intent uses
                  the same synonym and compound-product brain as Discover.
                </p>
              </div>
              <span className="shrink-0 rounded-pill border border-hairline-strong bg-surface-l1 px-2.5 py-1 text-[11px] font-semibold text-ink-primary">
                Start over
              </span>
            </div>
            <ul className="m-0 grid list-none grid-cols-1 gap-2.5 p-0">
              {MATCHES.map((m, i) => (
                <li key={m.name}>
                  <MatchResultCard
                    m={m}
                    // Top three stagger in 100ms apart; the rest of the
                    // page (below the fold) lands with the third.
                    shown={s.resultsShown[Math.min(i, 2)] ?? false}
                    following={i === 0 ? s.followed : m.following}
                    bellHovered={i === 0 && s.bellHovered}
                    bellRef={i === 0 ? refs.bell : undefined}
                    bellMobileRef={i === 0 ? refs.bellMobile : undefined}
                  />
                </li>
              ))}
            </ul>
            {/* Load-more replica — the real page paginates 24 at a time;
                the demo never clicks it, it just tells the truth about
                the 405-deep result set. */}
            <div
              className={cn(
                "flex justify-center pt-1 transition-opacity duration-200",
                s.resultsShown[2] ? "opacity-100" : "opacity-0",
              )}
            >
              <span className="rounded-md border border-hairline-strong bg-surface-l1 px-3 py-1.5 text-[11.5px] font-semibold text-ink-primary">
                Load more matches ({MATCH_PAGE}/{MATCH_TOTAL})
              </span>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

/* ─── Root — the animated app window ───────────────────────────── */

export function HeroDashboardDemo() {
  const prefersReduce = useReducedMotion() ?? false;
  // SSR renders with reduce=false (useReducedMotion is null on the server).
  // Gate on mount so the first client render matches the server HTML.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const reduce = mounted && prefersReduce;

  const frameRef = useRef<HTMLDivElement>(null);
  const inView = useInView(frameRef, { once: false, amount: 0.2 });
  const mark = useDemoClock(inView, reduce);

  // "Has fired this loop" / "has fired and the match pane hasn't been
  // torn down yet" — wizard internals reset at tileBump, while the match
  // pane is already hidden behind the dashboard crossfade.
  const on = useCallback((ts: number) => mark >= ts, [mark]);
  const live = useCallback(
    (ts: number) => mark >= ts && mark < T.tileBump,
    [mark],
  );

  // Persistent flags across the loop seam (refs never trigger renders —
  // the clock's own mark updates re-render for us).
  const hasSavedRef = useRef(false);
  const hasReturnedRef = useRef(false);
  useEffect(() => {
    if (mark >= T.bellRelease) hasSavedRef.current = true;
    if (mark >= T.homeRelease) hasReturnedRef.current = true;
  }, [mark]);

  /* Navigation state — Messages is the approved idle active item; Find
     matches owns it from nav release until the return-home release. */
  const matchOwnsNav = on(T.navRelease) && mark < T.homeRelease;
  const activeNav: "messages" | "match" = matchOwnsNav ? "match" : "messages";
  const navHovering = !reduce && mark >= T.navHover && mark < T.navClick;

  /* View visibility — sidebar + top chrome stay fixed; only the content
     area crossfades, like real SPA navigation. */
  const matchVisible = matchOwnsNav;

  /* Counts. The bumped 11 persists across the loop seam and resets
     invisibly: the stat tile while the match page covers it, the sidebar
     badge mid-typing while the eye is locked on the wizard input. */
  const savedBumped =
    !reduce &&
    (on(T.badgeBump) || (hasSavedRef.current && mark >= 0 && mark < T.k5));
  const badgeAnimate = on(T.badgeBump);
  const savedTileValue =
    !reduce &&
    (on(T.tileBump) ||
      (hasSavedRef.current && mark >= 0 && mark < T.s1FieldClick))
      ? STATS.saved_count + 1
      : STATS.saved_count;

  /* Wizard state ladder. */
  const wizardStep: 1 | 2 | 3 = !live(T.s1NextRelease)
    ? 1
    : !live(T.s2NextRelease)
      ? 2
      : 3;
  const typedCount = TYPE_MARKS.filter((t) => live(t)).length;
  const paneState: MatchPaneState = {
    visible: matchVisible,
    wizardStep,
    typed: TYPED_QUERY.slice(0, typedCount),
    fieldFocused: live(T.s1FieldRelease),
    fieldHovered: !reduce && mark >= T.s1FieldHover && mark < T.s1FieldClick,
    entitySelected: live(T.s1ChipRelease),
    chipS1Hovered: !reduce && mark >= T.s1ChipHover && mark < T.s1ChipClick,
    next1Hovered: !reduce && mark >= T.s1NextHover && mark < T.s1NextRelease,
    next1Pressed: !reduce && mark >= T.s1NextClick && mark < T.s1NextRelease,
    certSelected: live(T.s2CertRelease),
    certHovered: !reduce && mark >= T.s2CertHover && mark < T.s2CertClick,
    regSelected: live(T.s2RegRelease),
    regHovered: !reduce && mark >= T.s2RegHover && mark < T.s2RegClick,
    next2Hovered: !reduce && mark >= T.s2NextHover && mark < T.s2NextRelease,
    next2Pressed: !reduce && mark >= T.s2NextClick && mark < T.s2NextRelease,
    goHovered: !reduce && mark >= T.s3GoHover && mark < T.s3GoRelease,
    goPressed: !reduce && mark >= T.s3GoClick && mark < T.s3GoRelease,
    // "Matching…" holds from press RELEASE until the first result lands.
    matching: !reduce && mark >= T.s3GoRelease && mark < T.results1,
    resultsShown: [live(T.results1), live(T.results2), live(T.results3)],
    bellHovered: !reduce && mark >= T.bellHover && mark < T.bellClick,
    followed: live(T.bellRelease),
    reduce,
  };

  /* Cursor + scroll target refs. */
  const matchNavRef = useRef<HTMLDivElement>(null);
  const matchTabRef = useRef<HTMLLIElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLSpanElement>(null);
  const next1Ref = useRef<HTMLSpanElement>(null);
  const certRef = useRef<HTMLSpanElement>(null);
  const regRef = useRef<HTMLSpanElement>(null);
  const next2Ref = useRef<HTMLSpanElement>(null);
  const goRef = useRef<HTMLSpanElement>(null);
  const bellRef = useRef<HTMLSpanElement>(null);
  const bellMobileRef = useRef<HTMLSpanElement>(null);
  const brandRef = useRef<HTMLSpanElement>(null);
  const brandMobileRef = useRef<HTMLSpanElement>(null);
  const matchScrollRef = useRef<HTMLDivElement>(null);
  const resultsHeadRef = useRef<HTMLDivElement>(null);

  // Stable target bag so DemoCursor's effect doesn't thrash every render.
  const cursorTargets = useRef<CursorTargets>({
    nav: matchNavRef,
    navMobile: matchTabRef,
    field: fieldRef,
    chip: chipRef,
    next1: next1Ref,
    cert: certRef,
    reg: regRef,
    next2: next2Ref,
    go: goRef,
    bell: bellRef,
    bellMobile: bellMobileRef,
    home: brandRef,
    homeMobile: brandMobileRef,
  }).current;

  /* Pane scroll driver — before each glide, smooth-scroll the upcoming
     control into the pane's viewport exactly as a real user would (a
     no-op whenever it is already visible, which is the common desktop
     case). Only the pane scrolls; never the page. */
  useEffect(() => {
    const pane = matchScrollRef.current;
    if (!pane || reduce) return;
    // Below md the bottom tab bar overlays the pane's last ~52px, so a
    // control can sit "in" the pane rect yet be hidden behind the bar.
    const barInset = window.matchMedia("(min-width: 768px)").matches ? 0 : 60;
    const reveal = (...candidates: (HTMLElement | null)[]) => {
      // Responsive twins: the display:none copy measures 0×0 — skip it.
      const el = candidates.find(
        (c) => c && c.getBoundingClientRect().width > 0,
      );
      if (!el) return;
      const p = pane.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const margin = 16;
      if (
        r.top >= p.top + margin &&
        r.bottom <= p.bottom - margin - barInset
      ) {
        return;
      }
      const delta =
        r.top - p.top - (p.height - barInset - r.height) / 2;
      pane.scrollTo({ top: pane.scrollTop + delta, behavior: "smooth" });
    };
    switch (mark) {
      case T.s1Scroll:
        reveal(fieldRef.current);
        break;
      case T.s1ChipScroll:
        reveal(chipRef.current);
        break;
      case T.s1NextScroll:
        reveal(next1Ref.current);
        break;
      case T.s2CertScroll:
        reveal(certRef.current);
        break;
      case T.s2NextScroll:
        reveal(next2Ref.current);
        break;
      case T.s3GoScroll:
        reveal(goRef.current);
        break;
      case T.resultsScroll:
        reveal(resultsHeadRef.current);
        break;
      case T.bellScroll:
        reveal(bellRef.current, bellMobileRef.current);
        break;
      // Fresh navigation / hidden teardown: jump back to the top while
      // the pane is (or is about to become) invisible.
      case T.navRelease:
      case T.tileBump:
        pane.scrollTo({ top: 0 });
        break;
    }
  }, [mark, reduce]);

  return (
    <div
      ref={frameRef}
      aria-hidden
      className="relative w-full overflow-hidden rounded-[12px] border border-neutral-200 bg-white"
    >
      {/* Mobile: slightly shorter frame + inner scroll so alerts/saved cards
          remain reachable instead of hard-clipping under overflow:hidden. */}
      <div className="pointer-events-none flex h-[440px] xs:h-[480px] sm:h-[560px] md:h-[680px] lg:h-[720px]">
        {/* Sidebar — hidden below md; border-r separates it from the main */}
        <div className="hidden md:flex">
          <Sidebar
            activeNav={activeNav}
            navHovering={navHovering}
            savedBumped={savedBumped}
            badgeAnimate={badgeAnimate}
            reduce={reduce}
            matchRef={matchNavRef}
            brandRef={brandRef}
          />
        </div>

        {/* Dashboard main — flush against the sidebar hairline */}
        <div className="relative flex min-w-0 flex-1 overflow-hidden bg-bg-l0">
          <div className="relative flex min-w-0 flex-1 flex-col bg-bg-l0">
            {/* Top chrome — global search / moat / avatar. Brand mark shows
                below md, mirroring the production topbar (the sidebar owns
                it at md+). */}
            <div className="flex h-14 shrink-0 items-center gap-1.5 border-b border-neutral-200 bg-white px-2 shadow-sm sm:gap-2 sm:px-4">
              <span ref={brandMobileRef} className="inline-flex shrink-0 md:hidden">
                <BrandMark className="h-6 w-6" glyphClassName="h-full w-full" title="SourceBD" />
              </span>
              <span className="flex min-w-0 max-w-[240px] flex-1 items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-[12px] text-neutral-500">
                <MagnifyingGlass size={13} aria-hidden className="shrink-0" />
                <span className="truncate">Search suppliers…</span>
              </span>
              <div className="ml-auto flex min-w-0 items-center gap-1.5">
                <span
                  aria-label="Messages"
                  title="Messages"
                  className="relative hidden size-8 items-center justify-center rounded-lg text-ink-secondary sm:flex"
                >
                  <ChatCircleText size={16} aria-hidden />
                  <AmbientDot
                    className="absolute right-1.5 top-1.5 size-1.5"
                    reduce={reduce}
                  />
                </span>
                <span
                  aria-label="RFQs"
                  title="RFQs"
                  className="hidden size-8 items-center justify-center rounded-lg text-ink-secondary sm:flex"
                >
                  <FileText size={16} aria-hidden />
                </span>
                <span
                  aria-hidden
                  className="flex size-8 items-center justify-center rounded-lg text-ink-secondary"
                >
                  <Bell size={16} />
                </span>
                <UserAvatar
                  avatarUrl={BUYER_AVATAR}
                  displayName={BUYER_NAME}
                  size="sm"
                />
              </div>
            </div>

            {/* Content area — the only part that navigates. Both panes stay
                mounted (opacity/transform crossfade, no layout work). */}
            <div className="relative min-h-0 flex-1">
              <DashboardPane
                visible={!matchVisible}
                savedTileValue={savedTileValue}
              />
              <MatchPane
                s={paneState}
                refs={{
                  scroll: matchScrollRef,
                  field: fieldRef,
                  chip: chipRef,
                  next1: next1Ref,
                  cert: certRef,
                  reg: regRef,
                  next2: next2Ref,
                  go: goRef,
                  bell: bellRef,
                  bellMobile: bellMobileRef,
                  resultsHead: resultsHeadRef,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile bottom tab bar — the production phone nav pattern. */}
      <MobileTabBar
        activeNav={activeNav}
        navHovering={navHovering}
        matchTabRef={matchTabRef}
      />

      <DemoCursor
        mark={mark}
        reduce={reduce}
        persist={hasReturnedRef.current}
        frameRef={frameRef}
        targets={cursorTargets}
      />
    </div>
  );
}
