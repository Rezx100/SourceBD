"use client";

// The site's top navigation (Paper `30 Marketing · Global · Navigation`): the wordmark, Product, Solutions and
// Resources (each opens a panel under the bar), Pricing, Sign in, Book a demo, Start free. The panels open on
// click, hover or the keyboard and close on Escape, an outside press or a navigation; every item is a real link
// and the bar works with no script as a row of links (the panels are a convenience). Under 1024 the bar is the
// wordmark, Start free and a Menu button that opens every link in a sheet.
//
// The bar sticks to the top of the window. On the home page (`over`), after mercury.com's and the founder's recording
// of 22 Oct 2026 13:17 and his review of 14:18, it starts as glass over the studio photograph, with no ground and no
// line under it, and once the page scrolls it takes the ground of the section under it: the night set while a dark
// section (the opening's scene, the brands, Buy with confidence) is under the bar, the paper's white over the rest,
// each fading into the other in a moment. Never a white bar over the dark scene. Phones keep the solid bar; everywhere
// else it has its ground from the first paint.

import { CaretDown, List } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink, Sheet } from "@/components/kit";
import { cn } from "@/lib/utils";
import { HomeIcon } from "./sections/icons";
import { Wordmark, measure, ring } from "./sections/ui";
import { PRODUCT, RESOURCES, SOLUTIONS, type NavItem } from "./map";

type Menu = "product" | "solutions" | "resources";
const MENUS: { key: Menu; label: string }[] = [
  { key: "product", label: "Product" },
  { key: "solutions", label: "Solutions" },
  { key: "resources", label: "Resources" },
];


/** One list per menu, drawn by the desktop panel and the phone sheet alike, so the two cannot send a visitor to different places. */
export const MENU_ITEMS: Record<Menu, readonly NavItem[]> = { product: PRODUCT, solutions: SOLUTIONS, resources: RESOURCES };

function Item({ item }: { item: NavItem }) {
  return (
    <Link href={item.href} prefetch={false} className={cn("flex flex-col gap-0.5 rounded-lg p-3 hover:bg-sunken", ring)}>
      <span className="flex items-center gap-2.5 text-md font-medium text-ink">
        {item.icon ? <HomeIcon name={item.icon} size={20} className="text-ink" /> : null}
        {item.title}
      </span>
      {item.body ? <span className="text-base text-ink-3">{item.body}</span> : null}
    </Link>
  );
}

function Panel({ menu }: { menu: Menu }) {
  return (
    <div className={cn(measure, "flex gap-1 pb-8 pt-6")}>
      {MENU_ITEMS[menu].map((i) => (
        <Item key={i.href} item={i} />
      ))}
    </div>
  );
}

export function SiteNav({ over = false }: { /** The home page: the bar floats clear over the opening until the page scrolls. */ over?: boolean }) {
  const [open, setOpen] = useState<Menu | null>(null);
  const [sheet, setSheet] = useState(false);
  // What is under the bar: the page's top (the bar is glass over the studio), a dark section (the night set) or paper.
  const [under, setUnder] = useState<"top" | "night" | "paper">(over ? "top" : "paper");
  const path = usePathname();
  const head = useRef<HTMLElement>(null);
  const bar = useRef<HTMLElement>(null);
  const triggers = useRef<Partial<Record<Menu, HTMLButtonElement | null>>>({});

  // A navigation closes whatever is open.
  useEffect(() => {
    setOpen(null);
    setSheet(false);
  }, [path]);

  // Over the opening: glass while the page sits at its top; once it has scrolled a little, the ground of the section
  // whose bounds hold the bar's lower edge (night for a dark one, from 1024 up; phones keep the solid bar).
  useEffect(() => {
    if (!over) return;
    const wide = matchMedia("(min-width: 1024px)");
    let raf = 0;
    const read = () => {
      raf = 0;
      let next: "top" | "night" | "paper" = scrollY < 16 && wide.matches ? "top" : "paper";
      if (next === "paper" && wide.matches) {
        const edge = head.current?.offsetHeight ?? 0;
        for (const s of document.querySelectorAll('main [data-tone="dark"]')) {
          const r = s.getBoundingClientRect();
          if (r.top <= edge && r.bottom > edge) {
            next = "night";
            break;
          }
        }
      }
      setUnder(next);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    wide.addEventListener("change", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
      wide.removeEventListener("change", onScroll);
    };
  }, [over]);

  // A menu open over the photograph needs the ground too, so its panel reads.
  const clear = under === "top" && !open;
  const night = under === "night";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        triggers.current[open]?.focus();
        setOpen(null);
      }
    };
    const onPress = (e: MouseEvent) => {
      if (bar.current && !bar.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPress);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPress);
    };
  }, [open]);

  return (
    <header
      ref={head}
      data-ground={night ? "night" : undefined}
      className={cn(
        "sticky top-0 z-raised border-b font-sans backdrop-blur-md transition-[background-color,border-color,color] duration-slow motion-reduce:transition-none [&_a]:transition-colors [&_button]:transition-colors",
        clear ? "border-transparent bg-transparent" : "border-line bg-surface/90 supports-[backdrop-filter]:bg-surface/80",
      )}
    >
      <nav ref={bar} aria-label="Main" className="relative" onMouseLeave={() => setOpen(null)}>
        <div className={cn(measure, "flex h-[72px] items-center justify-between")}>
          <div className="flex items-center gap-12">
            <Wordmark className="flex items-center max-sm:min-h-11" />
            <ul className="flex items-center gap-1 max-lg:hidden">
              {MENUS.map((m) => (
                <li key={m.key}>
                  <button
                    type="button"
                    ref={(el) => {
                      triggers.current[m.key] = el;
                    }}
                    aria-expanded={open === m.key}
                    aria-controls={`site-menu-${m.key}`}
                    onClick={() => setOpen(open === m.key ? null : m.key)}
                    // Hover opens for a mouse only: on touch the tap would open it and the same tap's click would close it.
                    onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(m.key)}
                    className={cn("flex h-10 items-center gap-1.5 rounded-sm px-3 text-md font-medium text-ink hover:bg-sunken", ring, open === m.key && "bg-sunken")}
                  >
                    {m.label}
                    <CaretDown size={16} className={cn("text-ink-3 transition-transform duration-fast motion-reduce:transition-none", open === m.key && "rotate-180")} aria-hidden />
                  </button>
                </li>
              ))}
              <li>
                <Link href="/pricing" prefetch={false} className={cn("flex h-10 items-center rounded-sm px-3 text-md font-medium text-ink hover:bg-sunken", ring)} onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(null)}>
                  Pricing
                </Link>
              </li>
            </ul>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" prefetch={false} className={cn("flex h-10 items-center rounded-sm px-3 text-md font-medium text-ink hover:bg-sunken max-lg:hidden", ring)}>
              Sign in
            </Link>
            <ButtonLink href="/contact" prefetch={false} kind="secondary" size="lg" className="max-lg:hidden">
              Book a demo
            </ButtonLink>
            <ButtonLink href="/signup" prefetch={false} kind="primary" size="lg" className="max-sm:h-11">
              Start free
            </ButtonLink>
            <Button kind="quiet" size="lg" icon={List} className="max-sm:h-11 max-sm:min-w-11 lg:hidden" aria-label="Menu" onClick={() => setSheet(true)}>
              <span className="max-sm:sr-only">Menu</span>
            </Button>
          </div>
        </div>
        {MENUS.map((m) =>
          open === m.key ? (
            <div key={m.key} id={`site-menu-${m.key}`} className="absolute inset-x-0 top-full border-b border-line bg-surface shadow-dialog max-lg:hidden">
              <Panel menu={m.key} />
            </div>
          ) : null,
        )}
      </nav>
      {sheet ? (
        <Sheet open onOpenChange={(o) => !o && setSheet(false)} title="Menu">
          <div className="flex flex-col gap-5 pb-2">
            {MENUS.map((m) => ({ title: m.label, items: MENU_ITEMS[m.key] })).map((g) => (
              <div key={g.title} className="flex flex-col">
                <p className="pb-1 font-mono text-xs text-ink-3">{g.title}</p>
                {g.items.map((i) => (
                  <Link key={i.href} href={i.href} prefetch={false} className={cn("flex min-h-12 items-center border-b border-line text-md text-ink", ring)}>
                    {i.title}
                  </Link>
                ))}
              </div>
            ))}
            <div className="flex flex-col">
              {[{ label: "Pricing", href: "/pricing" }, { label: "Sign in", href: "/login" }, { label: "Book a demo", href: "/contact" }].map((l) => (
                <Link key={l.href} href={l.href} prefetch={false} className={cn("flex min-h-12 items-center border-b border-line text-md font-medium text-ink", ring)}>
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </Sheet>
      ) : null}
    </header>
  );
}
