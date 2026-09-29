"use client";

// The account corner (founder's video, 29 Sep 2026): one menu, in the rail's
// foot and on the topbar's avatar, with the buyer's photo, their name,
// Settings, Subscription and Sign out. It was a plain link to Settings that
// printed the whole email address, with initials where the photo belonged.
//
// A native <details>, like `Menu`: it opens without script. The shell is drawn
// once and outlives every navigation, so the menu closes itself when the path
// changes, on Escape, and on a click outside it.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./icons";
import { SbIcon } from "./sb-icons";
import { Caption, Label } from "./type";

export type AccountModel = { initial: string | null; name: string | null; email: string | null; avatarUrl?: string | null };

/** The name the rail prints: the profile's name, else the email's name part ("zahir" of zahir@…). */
export function accountName(account: AccountModel): string {
  return account.name ?? account.email?.split("@")[0] ?? "Your account";
}

export function Avatar({ account, size = "sm" }: { account: AccountModel | null; size?: "sm" | "rail" | "md" }) {
  const box = size === "md" ? "size-9" : size === "rail" ? "size-8" : "size-7";
  if (account?.avatarUrl) {
    // A Supabase Storage URL the buyer uploaded; next/image would need the
    // bucket's host configured for one 28px picture.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={account.avatarUrl} alt="" className={cn(box, "shrink-0 rounded-full object-cover")} />;
  }
  return (
    <span
      aria-hidden
      className={cn(
        box,
        "grid shrink-0 place-items-center rounded-full text-xs font-medium",
        account?.initial ? "bg-tier-2 text-tier-2-on" : "border border-line-strong bg-surface",
      )}
    >
      {account?.initial ?? ""}
    </span>
  );
}

/** Whether an event outside React closes an open menu: Escape, or a press that lands outside it. */
export function menuShouldClose(e: { key?: string; target?: unknown }, menu: { open: boolean; contains: (n: never) => boolean }): boolean {
  if (!menu.open) return false;
  return e.key !== undefined ? e.key === "Escape" : !menu.contains(e.target as never);
}

const ITEM ="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink transition-colors duration-fast hover:bg-surface-sunken";

export function AccountMenu({ account, place, plan }: { account: AccountModel; place: "rail" | "topbar"; /** The rail's second line: "Free plan · Public beta". */ plan?: string | null }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);
  useEffect(() => {
    const close = (e: Event) => {
      const el = ref.current;
      if (el && menuShouldClose({ key: e instanceof KeyboardEvent ? e.key : undefined, target: e.target }, el)) {
        el.open = false;
        if (e instanceof KeyboardEvent) el.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  const name = accountName(account);
  const rail = place === "rail";
  return (
    <details ref={ref} className="group/acct relative">
      <summary
        aria-label={`Account, ${name}${rail && plan ? `, ${plan}` : ""}`}
        // The collapsed rail shows the photo alone; its tooltip gives the name and the plan.
        title={rail ? [name, plan].filter(Boolean).join(" · ") : undefined}
        className={cn(
          "flex cursor-pointer list-none items-center rounded-sm transition-colors duration-fast [&::-webkit-details-marker]:hidden",
          rail
            ? // The nav rows' left edge and hover; open, the slate the current page wears.
              "h-12 gap-2.5 px-2 hover:bg-surface-sunken group-open/acct:bg-accent-tint md:group-data-[rail=collapsed]/shell:justify-center md:group-data-[rail=collapsed]/shell:px-0"
            : "rounded-full",
        )}
      >
        <Avatar account={account} size={rail ? "rail" : "sm"} />
        {rail ? (
          <>
            <span className="flex min-w-0 flex-1 flex-col md:group-data-[rail=collapsed]/shell:sr-only">
              <span data-name="" className="truncate text-sm font-medium text-ink-strong">
                {name}
              </span>
              {plan ? <span className="truncate text-xs text-ink-subtle">{plan}</span> : null}
            </span>
            <SbIcon name="up-down" className="text-ink-subtle md:group-data-[rail=collapsed]/shell:hidden" />
          </>
        ) : null}
      </summary>
      <div
        role="menu"
        aria-label="Account"
        // A chosen item closes the menu even when it goes nowhere new
        // (Settings, while on Settings): the path effect above never runs.
        onClick={(e) => {
          if ((e.target as Element).closest('[role="menuitem"]') && ref.current) ref.current.open = false;
        }}
        className={cn(
          "absolute z-overlay w-64 max-w-[calc(100vw-2rem)] rounded-md border border-line bg-surface py-1 shadow-md",
          rail ? "bottom-full left-0 mb-1" : "right-0 top-full mt-2",
        )}
      >
        <div className="flex items-center gap-3 border-b border-line-subtle px-3 pb-3 pt-2">
          <Avatar account={account} size="md" />
          <span className="flex min-w-0 flex-col">
            <Label className="text-ink-strong [overflow-wrap:anywhere]">{name}</Label>
            {account.email && account.email !== name ? <Caption className="[overflow-wrap:anywhere]">{account.email}</Caption> : null}
          </span>
        </div>
        <div className="flex flex-col py-1">
          <Link role="menuitem" href="/app/settings" prefetch={false} className={ITEM}>
            <Icon name="gear" className="text-ink-subtle" />
            Settings
          </Link>
          <Link role="menuitem" href="/app/settings/subscription" prefetch={false} className={ITEM}>
            <Icon name="card" className="text-ink-subtle" />
            Subscription
          </Link>
        </div>
        <form action="/auth/sign-out" method="post" className="border-t border-line-subtle pt-1">
          <button type="submit" role="menuitem" className={ITEM}>
            <Icon name="sign-out" className="text-ink-subtle" />
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
