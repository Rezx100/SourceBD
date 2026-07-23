"use client";

// Four-frame buyer walkthrough: dashboard → discover → results → profile.
// App shell stays fixed; scroll, cursor, and typed search are the only motion.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Bell,
  BookmarkSimple,
  CalendarBlank,
  ChatCircleText,
  Check,
  Clock,
  CursorClick,
  Factory,
  FileText,
  GearSix,
  Lock,
  MagnifyingGlass,
  MapPin,
  Package,
  ShieldCheck,
  SignOut,
  Sparkle,
  Star,
  UsersThree,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";

import { CompanyAvatar } from "@/components/supplier/company-avatar";
import { BrandMarkLink } from "@/components/marketing/logo";
import { sourceLogo } from "@/lib/source-logos";
import { cn } from "@/lib/utils";

const FRAMES = ["dashboard", "discover", "results", "profile"] as const;
type Frame = (typeof FRAMES)[number];

const FRAME_MS: Record<Frame, number> = {
  dashboard: 5200,
  discover: 4800,
  results: 6200,
  profile: 5400,
};

const QUERY = "Gazipur knitwear";
const MOAT = "10,148";
const BUYER = "Rezan Ferdous";
const BUYER_AVATAR_SRC = "/marketing/buyer-avatar.jpg";

// ─── Scroll helper (single eased animation per target — no stacked transforms) ─

function animateScrollTo(el: HTMLElement, to: number, duration = 720) {
  const from = el.scrollTop;
  if (Math.abs(from - to) < 1) {
    el.scrollTop = to;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - (1 - t) ** 3;
      el.scrollTop = from + (to - from) * eased;
      if (t < 1) raf = requestAnimationFrame(step);
      else resolve();
    };
    raf = requestAnimationFrame(step);
  });
}

// ─── Buyer photo (cropped from real app screenshot) ───────────────────────────

function DemoBuyerAvatar({
  variant = "sidebar",
  size = "md",
  className,
}: {
  variant?: "sidebar" | "topbar";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dim = { sm: 32, md: 40, lg: 48 }[size];
  const crop =
    variant === "sidebar"
      ? { scale: 9.5, x: -0.36, y: -0.48 }
      : { scale: 11, x: -9.15, y: -0.32 };

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-full border border-neutral-200 bg-white shadow-sm",
        className,
      )}
      style={{ width: dim, height: dim }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BUYER_AVATAR_SRC}
        alt=""
        className="absolute max-w-none select-none"
        style={{
          width: dim * crop.scale,
          height: dim * crop.scale,
          left: dim * crop.x,
          top: dim * crop.y,
        }}
      />
    </span>
  );
}

// ─── Shared data ─────────────────────────────────────────────────

function MarkTile({ tag, size = 22 }: { tag: string; size?: number }) {
  const logo = sourceLogo(tag);
  const label = tag === "OEKO_TEX" ? "OEKO-TEX" : tag.toUpperCase();
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[5px] border border-[rgba(15,15,20,0.065)] bg-[#fafaf9] font-mono text-[9px] font-bold text-[#4a4a55]"
      style={{ width: size, height: size }}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-full w-full rounded-[4px] object-contain p-0.5" />
      ) : (
        label.replace(/[^A-Za-z0-9]/g, "").slice(0, 3)
      )}
    </span>
  );
}

type ResultRow = {
  name: string;
  location: string;
  employees: number;
  est: number | null;
  marks: string[];
  sources: number;
  products: string[];
  highlight?: boolean;
};

const RESULT_ROWS: ResultRow[] = [
  { name: "Ajami Fashions Limited", location: "Gazipur", employees: 2400, est: 2012, marks: ["BGMEA", "OEKO_TEX"], sources: 4, products: ["Knit", "T-Shirt"] },
  { name: "Arbelia Fashion Limited", location: "Gazipur", employees: 400, est: 2015, marks: ["BGMEA", "WRAP"], sources: 3, products: ["Knit", "Polo"] },
  { name: "Artex Fashion Limited", location: "Gazipur", employees: 1200, est: 2010, marks: ["BGMEA", "GOTS"], sources: 5, products: ["Knit", "Fleece"] },
  { name: "Atria Knitwear Ltd.", location: "Gazipur", employees: 850, est: 2014, marks: ["BKMEA", "RSC"], sources: 4, products: ["Knit"] },
  { name: "Bengal Knitcraft Ltd.", location: "Gazipur", employees: 620, est: 2016, marks: ["BGMEA"], sources: 3, products: ["Knit", "Sweater"] },
  { name: "Crown Knitwear Ltd", location: "Mymensingh", employees: 1800, est: 2008, marks: ["BGMEA", "OEKO_TEX", "RSC"], sources: 4, products: ["Knit"] },
  { name: "DBL Group", location: "Gazipur", employees: 45000, est: 1991, marks: ["BGMEA", "OEKO_TEX", "RSC"], sources: 5, products: ["Knit", "Woven"] },
  {
    name: "Quattro Fashion Limited",
    location: "Gazipur",
    employees: 2650,
    est: 2018,
    marks: ["BGMEA", "GOTS", "OEKO_TEX", "WRAP"],
    sources: 6,
    products: ["Knit", "Denim"],
    highlight: true,
  },
];

const SAVED_ROWS = [
  { name: "Crown Knitwear Ltd", loc: "Mymensingh", sources: 4, marks: ["BGMEA", "RSC"] },
  { name: "Tm Jeans Ltd", loc: "Gazipur", sources: 3, marks: ["BGMEA", "WRAP"] },
  { name: "Tex Town Ltd.", loc: "Dhaka", sources: 4, marks: ["BKMEA", "GOTS"] },
];

const ACTIVITY = [
  { name: "Crown Knitwear Ltd", text: "added to your saved list", ago: "1d ago", kind: "saved" as const },
  { name: "Vintage Denim Apparels Ltd.", text: "WRAP certification expired", ago: "11d ago", kind: "expired" as const },
  { name: "Square Textiles Ltd.", text: "RSC remediation now at 100%", ago: "27d ago", kind: "rsc" as const },
];

// ─── Cursor ──────────────────────────────────────────────────────

function DemoCursor({ x, y, visible, reduce }: { x: number; y: number; visible: boolean; reduce: boolean }) {
  if (reduce || !visible) return null;
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute z-50 text-brand-forest drop-shadow-[0_2px_4px_rgba(31,77,58,0.4)]"
      animate={{ left: x, top: y }}
      transition={{ duration: 0.5, ease: [0.22, 0.03, 0.26, 1] }}
    >
      <CursorClick size={20} weight="fill" />
    </motion.span>
  );
}

// ─── App shell (matches real buyer chrome) ───────────────────────

type SidebarActive = "none" | "discover";

function DemoSidebar({ active }: { active: SidebarActive }) {
  const sections: {
    label: string;
    rows: { label: string; Icon: typeof MagnifyingGlass; navKey: SidebarActive | null; badge?: string; alert?: boolean; dot?: boolean }[];
  }[] = [
    {
      label: "Discover",
      rows: [
        { label: "Search suppliers", Icon: MagnifyingGlass, navKey: "discover", badge: MOAT },
        { label: "Find matches", Icon: Sparkle, navKey: null },
        { label: "Saved suppliers", Icon: BookmarkSimple, navKey: null, badge: "10" },
      ],
    },
    {
      label: "Activity",
      rows: [
        { label: "Messages", Icon: ChatCircleText, navKey: null, dot: true },
        { label: "RFQs", Icon: FileText, navKey: null },
        { label: "Orders", Icon: Package, navKey: null },
      ],
    },
    {
      label: "Compliance",
      rows: [{ label: "Compliance", Icon: ShieldCheck, navKey: null, badge: "3", alert: true }],
    },
    {
      label: "Account",
      rows: [{ label: "Settings", Icon: GearSix, navKey: null }],
    },
  ];

  return (
    <aside className="hidden w-[212px] shrink-0 flex-col border-r border-hairline bg-surface-l1 sm:flex md:w-[228px]">
      <div className="px-2 pt-3">
        <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
          <DemoBuyerAvatar variant="sidebar" size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[14px] font-bold tracking-[-0.01em] text-ink-primary">{BUYER}</p>
            <p className="truncate text-[11px] text-ink-tertiary">Buyer account</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-hidden px-2 pb-2 pt-1">
        {sections.map((sec) => (
          <div key={sec.label} className="mb-3">
            <p className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-tertiary">
              {sec.label}
            </p>
            {sec.rows.map(({ label, Icon, navKey, badge, alert, dot }) => {
              const isActive = navKey === "discover" && active === "discover";
              return (
                <div
                  key={label}
                  data-demo-nav={navKey ?? label}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] transition-colors",
                    isActive
                      ? "bg-brand-forest-soft font-semibold text-brand-forest"
                      : "font-medium text-ink-secondary",
                  )}
                >
                  <Icon
                    size={17}
                    weight={isActive ? "fill" : "regular"}
                    aria-hidden
                    className={cn("shrink-0", isActive ? "text-brand-forest" : "text-ink-tertiary")}
                  />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {dot ? <span className="size-2 shrink-0 rounded-full bg-brand-forest" aria-hidden /> : null}
                  {badge ? (
                    <span
                      className={cn(
                        "shrink-0 rounded-md px-1.5 py-0.5 text-[12px] font-semibold tabular-nums",
                        alert ? "bg-sem-red-soft text-sem-red" : "bg-[rgba(15,15,20,0.06)] text-ink-tertiary",
                      )}
                    >
                      {badge}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-auto border-t border-hairline px-2 py-2">
        <div className="flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium text-ink-secondary">
          <SignOut size={17} aria-hidden className="shrink-0 text-ink-tertiary" />
          Sign out
        </div>
      </div>
    </aside>
  );
}

function DemoTopbar({ title, query }: { title: string; query?: string }) {
  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-neutral-200 bg-white px-3 shadow-sm sm:h-12 sm:px-4">
      <BrandMarkLink href="/app" boxClassName="h-8 w-8 sm:h-9 sm:w-9" className="shrink-0" />
      <p className="hidden min-w-0 truncate font-display text-[15px] font-semibold tracking-[-0.01em] text-ink-primary sm:block">
        {title}
      </p>
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <div className="hidden min-w-[11rem] max-w-[14rem] items-center gap-2 rounded-lg border border-hairline-strong bg-bg-l0 px-2.5 py-1.5 md:flex">
          <MagnifyingGlass size={14} weight="bold" className="shrink-0 text-ink-tertiary" aria-hidden />
          <span className="truncate text-[12px] text-ink-primary">{query ?? "Search verified suppliers"}</span>
        </div>
        <span className="hidden items-center gap-1.5 rounded-lg border border-brand-forest/20 bg-brand-forest-soft px-2 py-1 lg:inline-flex">
          <span className="size-1.5 animate-pulse rounded-full bg-brand-forest" aria-hidden />
          <span className="font-display text-[13px] font-bold tabular-nums text-brand-forest">{MOAT}</span>
          <span className="text-[12px] font-medium text-brand-forest/80">verified</span>
        </span>
        <button type="button" aria-hidden className="hidden size-9 items-center justify-center rounded-lg text-ink-secondary sm:flex">
          <Bell size={18} />
        </button>
        <DemoBuyerAvatar variant="topbar" size="sm" />
      </div>
    </header>
  );
}

function BrowserChrome({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[0_10px_30px_-18px_rgba(15,15,20,0.18)] sm:rounded-2xl">
      <div className="flex items-end gap-2 border-b border-neutral-200 bg-neutral-100 pl-3 pr-4 pt-2 sm:pl-4">
        <div className="mb-2 flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-neutral-300" />
          <span className="size-2.5 rounded-full bg-neutral-300" />
          <span className="size-2.5 rounded-full bg-neutral-300" />
        </div>
        <div className="flex items-center gap-2 rounded-t-lg border border-b-0 border-neutral-200 bg-white px-3 py-1.5">
          <span className="size-2 rounded-full bg-brand-forest" />
          <span className="text-[11px] font-medium text-neutral-600 sm:text-[12px]">SourceBD</span>
        </div>
      </div>
      <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1 sm:px-3">
          <Lock size={11} weight="fill" className="shrink-0 text-brand-forest" aria-hidden />
          <span className="truncate font-mono text-[11px] text-neutral-500 sm:text-[12px]">{url}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

function ScrollPane({ children, scrollRef }: { children: ReactNode; scrollRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div
      ref={scrollRef}
      className="h-full overflow-x-hidden overflow-y-auto overscroll-none bg-bg-l0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {children}
    </div>
  );
}

// ─── Frames ──────────────────────────────────────────────────────

function DashboardFrame() {
  return (
    <div className="space-y-4 px-3 py-3 sm:space-y-5 sm:px-4 sm:py-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-forest">Buyer</p>
        <h2 className="font-display text-lg font-bold text-ink-primary sm:text-xl">Dashboard</h2>
        <p className="text-[12px] text-ink-secondary">Your sourcing activity at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5 lg:gap-3">
        {[
          { label: "Saved suppliers", val: "10", meta: "Your shortlist for outreach" },
          { label: "Active RFQs", val: "0", meta: "Compose your first RFQ from a supplier profile." },
          { label: "Active orders", val: "0", meta: "Accept an RFQ quote to seed an order." },
          { label: "Compliance alerts", val: "3", meta: "Certs expiring within 30 days" },
          { label: "Unread messages", val: "0", meta: "Open Messages from the sidebar" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-hairline bg-surface-l1 p-3 shadow-sm">
            <p className="text-[11px] font-medium text-ink-tertiary">{s.label}</p>
            <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-ink-primary">{s.val}</p>
            <p className="mt-1 text-[10px] leading-snug text-ink-tertiary">{s.meta}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="text-[13px] font-semibold text-ink-primary">Alerts</p>
        <p className="text-[11px] text-ink-secondary">Certifications expiring in the next 30 days</p>
        <ul className="mt-2 space-y-1.5">
          {[
            ["S M KNITWEARS LIMITED", "Jul 21, 2026"],
            ["PRIME CAP (BD) LTD.", "Jul 23, 2026"],
            ["IRIS FABRICS LTD", "Jul 25, 2026"],
          ].map(([co, dt]) => (
            <li key={co} className="flex items-center gap-2 rounded-lg border border-sem-amber/30 bg-sem-amber-soft px-2.5 py-2 text-[11px] sm:text-[12px]">
              <WarningCircle size={14} weight="fill" className="shrink-0 text-sem-amber" aria-hidden />
              <span className="font-semibold text-sem-amber">{co}</span>
              <span className="text-ink-secondary">· WRAP expires {dt}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-ink-primary">Saved suppliers</p>
          <span className="text-[11px] font-semibold text-brand-forest">View all →</span>
        </div>
        <ul className="mt-2 space-y-2">
          {SAVED_ROWS.map((c) => (
            <li key={c.name} className="rounded-lg border border-neutral-200 bg-white px-3 py-3 shadow-sm">
              <div className="flex items-start gap-3">
                <CompanyAvatar name={c.name} verified className="mt-0.5 scale-[0.85]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[14px] font-black text-neutral-900">{c.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[12px] text-neutral-600">
                    <span className="rounded-pill bg-neutral-100 px-1.5 py-0.5 text-[11px] font-semibold">Factory</span>
                    <MapPin size={12} weight="fill" className="text-neutral-400" aria-hidden />
                    {c.loc}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                    {c.marks.map((m) => (
                      <MarkTile key={m} tag={m} />
                    ))}
                    <span className="font-medium text-neutral-700">Verified by {c.sources} sources</span>
                  </div>
                </div>
                <span className="hidden shrink-0 items-center gap-0.5 text-[12px] font-semibold text-brand-forest sm:inline-flex">
                  View profile <ArrowRight size={14} weight="bold" aria-hidden />
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="pb-4">
        <p className="text-[13px] font-semibold text-ink-primary">Recent activity</p>
        <ul className="mt-2 divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-surface-l1">
          {ACTIVITY.map((a) => (
            <li key={a.name + a.ago} className="flex items-center gap-2.5 px-3 py-2.5 text-[12px]">
              {a.kind === "saved" ? <Star size={14} weight="fill" className="text-sem-amber" aria-hidden /> : null}
              {a.kind === "expired" ? <Clock size={14} weight="fill" className="text-sem-red" aria-hidden /> : null}
              {a.kind === "rsc" ? <ShieldCheck size={14} weight="fill" className="text-brand-forest" aria-hidden /> : null}
              <span className="min-w-0 flex-1 truncate">
                <span className="font-semibold text-ink-primary">{a.name}</span>
                <span className="text-ink-secondary"> · {a.text}</span>
              </span>
              <span className="shrink-0 font-mono text-[10px] text-ink-tertiary">{a.ago}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function DiscoverFrame({ typed, reduce }: { typed: string; reduce: boolean }) {
  const complete = typed.length >= QUERY.length;
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-8 text-center">
      <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-ink-primary sm:text-[1.75rem]">
        Find a verified factory
      </h2>
      <p className="mt-1.5 max-w-md text-[13px] text-ink-secondary">
        Search by certification, product, or district — every result is source-backed.
      </p>
      <div className="relative mt-5 w-full max-w-xl">
        <div
          data-demo-search-box
          className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 shadow-sm"
        >
          <MagnifyingGlass size={18} className="shrink-0 text-neutral-400" aria-hidden />
          <span className="flex-1 truncate text-left text-[13px] text-ink-primary sm:text-sm">
            {typed || <span className="text-ink-tertiary">e.g. OEKO-TEX, Gazipur knitwear</span>}
            {!reduce && !complete ? (
              <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-brand-forest align-middle" />
            ) : null}
          </span>
          <span
            data-demo-search-btn
            className="shrink-0 rounded-lg bg-brand-forest px-4 py-2 text-[13px] font-semibold text-white"
          >
            Search
          </span>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ row, lead }: { row: ResultRow; lead?: boolean }) {
  return (
    <article
      data-demo-result={row.highlight ? "quattro" : undefined}
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-white px-3 py-3 text-left shadow-sm transition-colors sm:px-4 sm:py-4",
        lead ? "border-brand-forest/30 bg-[#fafaf9]" : "border-neutral-200 hover:border-brand-forest/[0.22]",
      )}
    >
      <div className="flex gap-3 sm:gap-4">
        <CompanyAvatar name={row.name} verified className="mt-0.5 scale-[0.88]" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-[15px] font-black leading-tight tracking-[-0.02em] text-neutral-900 sm:text-[17px]">
            {row.name}
          </h3>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-neutral-600 sm:text-[12px]">
            <span className="inline-flex items-center rounded-pill bg-neutral-100 px-1.5 py-0.5 font-semibold">Factory</span>
            <MapPin size={12} weight="fill" className="text-neutral-400" aria-hidden />
            <span>{row.location}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-600">
            {row.marks.slice(0, 3).map((m) => (
              <MarkTile key={m} tag={m} />
            ))}
            <span className="font-medium text-neutral-700">Verified by {row.sources} sources</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {row.products.map((p) => (
              <span key={p} className="inline-flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600">
                {p}
              </span>
            ))}
          </div>
        </div>
        <div className="hidden shrink-0 flex-col items-end justify-between self-stretch sm:flex">
          <div className="text-right">
            <p className="font-display text-[14px] font-bold tabular-nums text-neutral-800">{row.employees.toLocaleString()}</p>
            <p className="text-[10px] text-neutral-400">employees</p>
            {row.est ? <p className="mt-1 text-[10px] text-neutral-400">Est. {row.est}</p> : null}
          </div>
          <span
            data-demo-view-profile={row.highlight ? "true" : undefined}
            className={cn(
              "inline-flex items-center gap-0.5 text-[12px] font-semibold",
              lead ? "rounded-lg bg-brand-forest px-2.5 py-1.5 text-white" : "text-brand-forest",
            )}
          >
            View profile
            <ArrowRight size={14} weight="bold" aria-hidden />
          </span>
        </div>
      </div>
    </article>
  );
}

function ResultsFrame() {
  return (
    <div className="px-3 py-3 sm:px-4 sm:py-4">
      <div className="mb-3">
        <h2 className="font-display text-lg font-semibold text-ink-primary">Find a verified factory</h2>
        <p className="text-[12px] text-ink-secondary">Search by certification, product, or district.</p>
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-sm">
          <MagnifyingGlass size={16} className="text-neutral-400" aria-hidden />
          <span className="flex-1 text-[13px] text-ink-primary">{QUERY}</span>
          <span className="rounded-lg bg-brand-forest px-3 py-1.5 text-[12px] font-semibold text-white">Search</span>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5 text-[10px] sm:text-[11px]">
        {["City · Gazipur", "Product · Knit", "Type · Knitted", "Sources · Any"].map((f) => (
          <span key={f} className="rounded-md border border-brand-forest/25 bg-brand-forest-soft px-2 py-0.5 font-medium text-brand-forest">
            {f}
          </span>
        ))}
      </div>

      <div className="mb-2 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-tertiary sm:text-[11px]">
          <span className="font-semibold text-brand-forest">523</span> verified matches
        </p>
        <span className="text-[11px] text-ink-tertiary">Best match ▾</span>
      </div>

      <div className="space-y-2 pb-6">
        {RESULT_ROWS.map((row) => (
          <ResultCard key={row.name} row={row} lead={row.highlight} />
        ))}
      </div>
    </div>
  );
}

function ProfileFrame() {
  return (
    <div className="px-3 py-3 sm:px-4 sm:py-4">
      <section className="relative overflow-hidden rounded-[14px] border border-neutral-200 bg-white px-3 py-3 shadow-sm before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-20 before:bg-gradient-to-b before:from-brand-forest/[0.035] before:to-transparent sm:rounded-[18px] sm:px-5 sm:py-4">
        <div className="relative flex items-center gap-3 sm:gap-4">
          <CompanyAvatar name="Quattro Fashion Limited" verified variant="profile" className="shrink-0 scale-[0.82] sm:scale-100" />
          <div className="min-w-0 flex-1">
            <h2 className="line-clamp-2 font-display text-[18px] font-extrabold leading-tight tracking-[-0.02em] text-neutral-900 sm:text-[22px]">
              Quattro Fashion Limited
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] sm:text-[12px]">
              <span className="inline-flex items-center gap-1 rounded-pill bg-neutral-100 px-2 py-0.5 font-semibold text-neutral-700">
                <Factory size={12} aria-hidden />
                Factory
              </span>
              <span className="inline-flex items-center gap-1 font-medium text-neutral-600">
                <MapPin size={12} weight="fill" className="text-neutral-400" aria-hidden />
                Gazipur
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-brand-forest">
                <ShieldCheck size={12} weight="fill" aria-hidden />
                Verified · 6 authorities · 27 Jun 2026
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 h-px bg-gradient-to-r from-neutral-200/0 via-neutral-200/70 to-neutral-200/0 sm:mt-4" />

        <div className="mt-3 flex flex-col gap-3 sm:mt-4 lg:flex-row lg:items-center lg:justify-between">
          <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-3 sm:gap-x-6 lg:flex lg:gap-8">
            {[
              { label: "Registered address", icon: MapPin, value: "Gazipur, Bangladesh" },
              { label: "Employees", icon: UsersThree, value: "2,650", bold: true },
              { label: "Established", icon: CalendarBlank, value: "Sept 2018", bold: true },
            ].map((item) => (
              <div key={item.label} className={cn("min-w-0", item.label === "Registered address" && "col-span-2 sm:col-span-1 lg:flex-[2]")}>
                <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-500">
                  <item.icon size={14} weight="duotone" className="text-brand-forest/80" aria-hidden />
                  {item.label}
                </dt>
                <dd className={cn("mt-0.5 text-neutral-900", item.bold ? "font-display text-[15px] font-bold tabular-nums" : "text-[12px] font-semibold text-neutral-700")}>
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-lg border border-neutral-200 px-3 py-1.5 text-[12px] font-semibold text-neutral-700">Follow</span>
            <span className="rounded-lg bg-brand-forest px-3 py-1.5 text-[12px] font-semibold text-white">Contact supplier</span>
          </div>
        </div>
      </section>

      <div className="mt-3 flex gap-3 overflow-x-auto border-b border-neutral-200 text-[11px] font-semibold sm:text-[12px]">
        {["Overview", "Compliance", "Capacity", "Contact", "Provenance 8"].map((t) => (
          <span
            key={t}
            className={cn(
              "shrink-0 pb-2",
              t === "Compliance" ? "border-b-2 border-brand-forest text-brand-forest" : "text-neutral-400",
            )}
          >
            {t}
          </span>
        ))}
      </div>

      <div className="mt-3 space-y-2.5 pb-6">
        {[
          {
            title: "Registries",
            sub: "4 verified records",
            rows: ["BGMEA member", "BKMEA member", "RMG Sustainability Council", "EPB exporter"].map((r) => [r, "Verified"]),
          },
          {
            title: "Certifications",
            sub: "3 active · 0 expiring",
            rows: [
              ["GOTS — Global Organic Textile Standard", "Valid · 2027"],
              ["OEKO-TEX STANDARD 100", "Valid · 2026"],
              ["WRAP", "Evergreen"],
            ],
          },
        ].map((block) => (
          <div key={block.title} className="rounded-lg border border-neutral-200 bg-white p-3">
            <p className="text-[12px] font-semibold text-ink-primary">
              {block.title} <span className="font-normal text-ink-secondary">{block.sub}</span>
            </p>
            <ul className="mt-1.5 space-y-1">
              {block.rows.map(([left, right]) => (
                <li key={left} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="min-w-0 truncate text-neutral-700">{left}</span>
                  <span className={cn("shrink-0 font-semibold", right === "Verified" ? "rounded bg-brand-forest-soft px-1.5 py-0.5 text-brand-forest" : "text-neutral-500")}>
                    {right}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <p className="text-[12px] font-semibold text-ink-primary">RSC Remediation</p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="font-display text-2xl font-bold text-brand-forest">100%</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200">
              <div className="h-full w-full rounded-full bg-brand-forest" />
            </div>
          </div>
          <p className="mt-1 text-[11px] text-ink-secondary">2,567 workers · Initial remediation completed</p>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <p className="text-[12px] font-semibold text-ink-primary">
            Sanctions screening <span className="font-normal text-ink-secondary">6 of 6 watchlists clear</span>
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {["UFLPA", "CBP WRO", "OFAC SDN", "EU Sanctions"].map((s) => (
              <span key={s} className="rounded bg-brand-forest-soft px-1.5 py-0.5 text-[10px] font-semibold text-brand-forest">
                {s} · Clear
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Stepper ─────────────────────────────────────────────────────

const STEPS = [
  { label: "Your workspace", hint: "buyer dashboard" },
  { label: "Search", hint: "by cert, product or district" },
  { label: "Vet the evidence", hint: "523 verified matches" },
  { label: "Open the profile", hint: "compliance on the record" },
];

function Stepper({ frameIndex, loop, reduce }: { frameIndex: number; loop: number; reduce: boolean }) {
  const frame = FRAMES[frameIndex]!;
  return (
    <div className="mt-6 sm:mt-8">
      <ol className="flex items-center">
        {STEPS.map((step, i) => {
          const isLast = i === STEPS.length - 1;
          return (
            <li key={step.label} className={cn("flex items-center", !isLast && "flex-1")}>
              <div
                className={cn(
                  "relative flex size-8 items-center justify-center rounded-full border text-[11px] font-bold sm:size-10 sm:text-[12px]",
                  i <= frameIndex ? "border-brand-forest bg-brand-forest text-white" : "border-neutral-200 bg-white text-neutral-400",
                )}
              >
                {i < frameIndex ? <Check size={16} weight="bold" aria-hidden /> : String(i + 1).padStart(2, "0")}
              </div>
              {!isLast ? (
                <div className="mx-1.5 h-[3px] flex-1 overflow-hidden rounded-full bg-neutral-200 sm:mx-2">
                  {i < frameIndex ? (
                    <div className="h-full w-full bg-brand-forest" />
                  ) : i === frameIndex && !reduce ? (
                    <motion.div
                      key={`rail-${i}-${loop}`}
                      className="h-full bg-brand-forest"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: FRAME_MS[frame] / 1000, ease: "linear" }}
                    />
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex">
        {STEPS.map((step, i) => (
          <div
            key={step.label}
            className={cn(
              "flex flex-1 flex-col",
              i === 0 ? "items-start text-left" : i === STEPS.length - 1 ? "items-end text-right" : "items-center text-center",
            )}
          >
            <span className={cn("text-[11px] font-semibold sm:text-[12px]", i === frameIndex ? "text-neutral-900" : i < frameIndex ? "text-brand-forest" : "text-neutral-400")}>
              {step.label}
            </span>
            <span className="mt-0.5 hidden text-[10px] text-neutral-400 sm:block">{step.hint}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Timeline ────────────────────────────────────────────────────

type CursorTarget = { x: number; y: number; visible: boolean };

function useDemoTimeline(
  frameIndex: number,
  loop: number,
  reduce: boolean,
  scrollRef: React.RefObject<HTMLDivElement | null>,
) {
  const [typed, setTyped] = useState("");
  const [cursor, setCursor] = useState<CursorTarget>({ x: 0, y: 0, visible: false });
  const animToken = useRef(0);

  const frame = FRAMES[frameIndex]!;

  const runScrollSequence = useCallback(
    async (targets: number[], token: number) => {
      const el = scrollRef.current;
      if (!el) return;
      for (const y of targets) {
        if (animToken.current !== token) return;
        await animateScrollTo(el, y);
      }
    },
    [scrollRef],
  );

  useEffect(() => {
    const token = ++animToken.current;
    const el = scrollRef.current;

    if (reduce) {
      if (el) {
        el.scrollTop = frame === "results" ? 380 : frame === "dashboard" ? 220 : frame === "profile" ? 120 : 0;
      }
      setTyped(QUERY);
      setCursor({ x: 0, y: 0, visible: false });
      return;
    }

    setTyped("");
    setCursor({ x: 0, y: 0, visible: false });
    if (el) el.scrollTop = 0;

    const timers: ReturnType<typeof setTimeout>[] = [];

    if (frame === "dashboard") {
      timers.push(setTimeout(() => void runScrollSequence([130, 260], token), 500));
      timers.push(setTimeout(() => setCursor({ x: 78, y: 152, visible: true }), 3600));
    }

    if (frame === "discover") {
      let i = 0;
      const typeId = setInterval(() => {
        i += 1;
        setTyped(QUERY.slice(0, i));
        if (i >= QUERY.length) clearInterval(typeId);
      }, 44);
      timers.push(setTimeout(() => setCursor({ x: 480, y: 268, visible: true }), 2400));
      return () => {
        clearInterval(typeId);
        timers.forEach(clearTimeout);
        animToken.current += 1;
      };
    }

    if (frame === "results") {
      timers.push(setTimeout(() => void runScrollSequence([90, 240, 400], token), 450));
      timers.push(setTimeout(() => setCursor({ x: 560, y: 318, visible: true }), 5000));
    }

    if (frame === "profile") {
      timers.push(setTimeout(() => void runScrollSequence([70, 140], token), 700));
    }

    return () => {
      timers.forEach(clearTimeout);
      animToken.current += 1;
    };
  }, [frame, loop, reduce, runScrollSequence, scrollRef]);

  return { typed, cursor };
}

function frameMeta(frame: Frame) {
  switch (frame) {
    case "dashboard":
      return { title: "Dashboard", url: "sourcebd.net/app", sidebar: "none" as SidebarActive, query: undefined };
    case "discover":
      return { title: "Search suppliers", url: "sourcebd.net/app/discover", sidebar: "discover" as SidebarActive, query: undefined };
    case "results":
      return { title: "Search suppliers", url: `sourcebd.net/app/discover?q=${encodeURIComponent(QUERY)}`, sidebar: "discover" as SidebarActive, query: QUERY };
    case "profile":
      return { title: "Company profile", url: "sourcebd.net/app/suppliers/quattro-fashion", sidebar: "discover" as SidebarActive, query: undefined };
  }
}

// ─── Root ────────────────────────────────────────────────────────

export function ProductDemo() {
  const reduce = useReducedMotion() ?? false;
  const [frameIndex, setFrameIndex] = useState(0);
  const [loop, setLoop] = useState(0);
  const frozen = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const frame = FRAMES[frameIndex]!;
  const meta = frameMeta(frame);
  const { typed, cursor } = useDemoTimeline(frameIndex, loop, reduce, scrollRef);

  useEffect(() => {
    if (reduce) {
      frozen.current = true;
      setFrameIndex(FRAMES.indexOf("profile"));
    }
  }, [reduce]);

  useEffect(() => {
    if (frozen.current) return;
    const id = setTimeout(() => {
      setFrameIndex((i) => {
        const next = (i + 1) % FRAMES.length;
        if (next === 0) setLoop((l) => l + 1);
        return next;
      });
    }, FRAME_MS[frame]);
    return () => clearTimeout(id);
  }, [frameIndex, frame]);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <BrowserChrome url={meta.url}>
        <div className="relative flex h-[400px] bg-bg-l0 sm:h-[520px] lg:h-[560px]">
          <DemoSidebar active={meta.sidebar} />
          <div className="relative flex min-w-0 flex-1 flex-col">
            <DemoTopbar title={meta.title} query={meta.query} />
            <div className="relative min-h-0 flex-1">
              {frame === "discover" ? (
                <div className="h-full overflow-hidden bg-bg-l0">
                  <DiscoverFrame typed={typed} reduce={reduce} />
                </div>
              ) : (
                <ScrollPane scrollRef={scrollRef}>
                  {frame === "dashboard" ? <DashboardFrame /> : null}
                  {frame === "results" ? <ResultsFrame /> : null}
                  {frame === "profile" ? <ProfileFrame /> : null}
                </ScrollPane>
              )}
              <DemoCursor x={cursor.x} y={cursor.y} visible={cursor.visible} reduce={reduce} />
            </div>
          </div>
        </div>
      </BrowserChrome>
      <Stepper frameIndex={frameIndex} loop={loop} reduce={reduce} />
    </div>
  );
}
