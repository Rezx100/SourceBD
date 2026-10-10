"use client";

// The site's top navigation (Paper `30 Marketing · Global · Navigation`): the wordmark, Product, Solutions and
// Resources (each opens a panel under the bar), Pricing, Sign in, Book a demo, Start free. The panels open on
// click, hover or the keyboard and close on Escape, an outside press or a navigation; every item is a real link
// and the bar works with no script as a row of links (the panels are a convenience). Under 1024 the bar is the
// wordmark, Start free and a Menu button that opens every link in a sheet.

import { CaretDown, List } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink, Sheet } from "@/components/kit";
import { cn } from "@/lib/utils";
import { HomeIcon } from "./home/icons";
import { PRODUCT, PRODUCT_GROUPS, RESOURCES, SOLUTIONS, type NavItem } from "./map";

type Menu = "product" | "solutions" | "resources";
const MENUS: { key: Menu; label: string }[] = [
  { key: "product", label: "Product" },
  { key: "solutions", label: "Solutions" },
  { key: "resources", label: "Resources" },
];

const ring = "outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

function Item({ item }: { item: NavItem }) {
  return (
    <Link href={item.href} prefetch={false} className={cn("flex flex-col gap-0.5 rounded-lg p-3 hover:bg-brand-wash", ring)}>
      <span className="text-md font-medium text-ink">{item.title}</span>
      {item.body ? <span className="text-base text-ink-3">{item.body}</span> : null}
    </Link>
  );
}

function Panel({ menu }: { menu: Menu }) {
  if (menu === "product") {
    return (
      <div className="mx-auto flex max-w-[1440px] gap-10 px-10 pb-8 pt-7">
        {PRODUCT_GROUPS.map((g) => (
          <div key={g.title} className="flex w-[200px] flex-col gap-3.5">
            <p className="flex items-center gap-2.5 text-[15px] font-medium leading-[18px] text-ink-strong">
              <HomeIcon name={g.icon} className="text-ink-strong" />
              {g.title}
            </p>
            <ul className="flex flex-col gap-0.5">
              {g.items.map((i) => (
                <li key={i.href}>
                  <Link href={i.href} prefetch={false} className={cn("flex min-h-8 items-center rounded-md px-2 py-[7px] text-[14px] leading-[18px] text-ink-strong hover:bg-sunken", ring)}>
                    {i.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }
  const items = menu === "solutions" ? SOLUTIONS : RESOURCES;
  return (
    <div className="mx-auto flex max-w-[1440px] gap-1 px-10 pb-8 pt-6">
      {items.map((i) => (
        <Item key={i.href} item={i} />
      ))}
    </div>
  );
}

export function SiteNav() {
  const [open, setOpen] = useState<Menu | null>(null);
  const [sheet, setSheet] = useState(false);
  const path = usePathname();
  const bar = useRef<HTMLElement>(null);
  const triggers = useRef<Partial<Record<Menu, HTMLButtonElement | null>>>({});

  // A navigation closes whatever is open.
  useEffect(() => {
    setOpen(null);
    setSheet(false);
  }, [path]);

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
    <header className="relative z-raised border-b border-line bg-surface font-sans">
      <nav ref={bar} aria-label="Main" className="relative" onMouseLeave={() => setOpen(null)}>
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-6 lg:px-10">
          <div className="flex items-center gap-12">
            <Link href="/" className={cn("flex items-center text-lg font-semibold tracking-tight text-brand-ink max-sm:min-h-11", ring)}>
              SourceBD
            </Link>
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
            {[{ title: "Product", items: PRODUCT }, { title: "Solutions", items: SOLUTIONS }, { title: "Resources", items: RESOURCES }].map((g) => (
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
