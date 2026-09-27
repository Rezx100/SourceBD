"use client";

// The topbar search field, with suggestions as the buyer types.
//
// The field is the kit topbar's `<input name="q" data-search="topbar">`,
// rendered the same on the server so the GET form, ⌘K (`search-shortcut.tsx`)
// and a no-script browser all still work. With script, each keystroke
// (debounced) asks `/api/discover/suggest` — records by name, products,
// places and certificates, from the live database — and lists them under the
// field as a combobox. Choosing a record opens its page; choosing a term runs
// that filter on the search; Enter with nothing chosen submits the form as
// before.
//
// The helpers are exported and pure, because the suite is `node --test` over
// `renderToStaticMarkup` with no DOM: what a suggestion links to and how the
// arrow keys move are the parts that can be wrong, and they can be tested
// without a browser.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./icons";

export type Suggestion =
  | { type: "company"; label: string; sublabel: string | null; slug: string }
  | {
      type: "product" | "location" | "cert";
      label: string;
      value: string;
      /** The search parameter this term sets, when it is not the free-text `q`. */
      param?: [key: string, value: string];
    };

export const SUGGEST_PATH = "/api/discover/suggest";
export const DEBOUNCE_MS = 130;

const KIND: Record<Suggestion["type"], { icon: IconName; hint: string }> = {
  company: { icon: "building", hint: "Supplier" },
  product: { icon: "tag", hint: "Product" },
  location: { icon: "pin", hint: "Place" },
  cert: { icon: "seal", hint: "Certificate" },
};

/** Where choosing a suggestion goes: a record's own page, or the search with that one filter set. */
export function suggestionHref(s: Suggestion): string {
  if (s.type === "company") return `/app/suppliers/${encodeURIComponent(s.slug)}`;
  const [key, value] = s.param ?? ["q", s.value];
  return `/app/discover?${new URLSearchParams({ [key]: value }).toString()}`;
}

/** The next active row for an arrow key: wraps at both ends; -1 (nothing) steps to the first or last. */
export function stepIndex(current: number, delta: 1 | -1, count: number): number {
  if (count === 0) return -1;
  if (current < 0) return delta === 1 ? 0 : count - 1;
  return (current + delta + count) % count;
}

/** What a place or certificate row says under its label. */
export function suggestionHint(s: Suggestion): string {
  if (s.type === "company") return s.sublabel ?? KIND.company.hint;
  if (s.type === "location" && s.param) return s.param[0] === "city" ? "City" : "District";
  return KIND[s.type].hint;
}

export function SearchTypeahead({ defaultValue }: { defaultValue: string }) {
  const listId = useId();
  // The shell is drawn once by the layout and does not know the page's
  // query, so the field reads it from the URL: on the results page it shows
  // the search the results are for, and a navigation that changes `q` —
  // choosing a suggestion, a saved search, a new page — resets it to what the
  // URL says rather than leaving the half-typed word behind. Off the results
  // page it starts empty. `defaultValue` is for a render with no router (the
  // gallery, the tests).
  const pathname = usePathname();
  const params = useSearchParams();
  const urlQuery = pathname === "/app/discover" ? (params?.get("q") ?? "") : "";
  const [value, setValue] = useState(urlQuery || defaultValue);
  useEffect(() => {
    setValue(urlQuery);
  }, [urlQuery]);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrap = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const q = value.trim();
    if (q.length === 0) {
      abort.current?.abort();
      setItems([]);
      setActive(-1);
      return;
    }
    const timer = setTimeout(() => {
      const mine = ++seq.current;
      abort.current?.abort();
      const ctl = new AbortController();
      abort.current = ctl;
      fetch(`${SUGGEST_PATH}?q=${encodeURIComponent(q)}`, { signal: ctl.signal, headers: { accept: "application/json" } })
        .then((r) => (r.ok ? r.json() : { suggestions: [] }))
        .then((data: { suggestions?: Suggestion[] }) => {
          if (mine !== seq.current) return;
          setItems(Array.isArray(data.suggestions) ? data.suggestions : []);
          setActive(-1);
          setOpen(true);
        })
        .catch(() => {
          /* aborted, or the network: the plain form still submits */
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value]);

  // Outside click closes the list; the field keeps its text.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const shown = open && value.trim().length > 0 && items.length > 0;

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (items.length === 0) return;
      e.preventDefault();
      setOpen(true);
      setActive((i) => stepIndex(i, e.key === "ArrowDown" ? 1 : -1, items.length));
    } else if (e.key === "Enter") {
      // Enter on a highlighted row follows that row's link — a `next/link`,
      // so the page's state survives, the same as clicking it. With nothing
      // highlighted the form submits: a plain search for the words typed.
      if (active >= 0 && shown) {
        e.preventDefault();
        document.getElementById(`${listId}-${active}`)?.click();
        setOpen(false);
      }
    } else if (e.key === "Escape" && shown) {
      e.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <div ref={wrap} className="contents">
      <input
        type="search"
        name="q"
        // What `SEARCH_FIELD_SELECTOR` looks for. Naming the field beats
        // inferring it from `form[role="search"]`, which /app/products also
        // renders.
        data-search="topbar"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => items.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search suppliers, HS codes, certificates"
        aria-label="Search suppliers, HS codes, certificates"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={listId}
        aria-activedescendant={shown && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        // No `outline-none`: Tailwind emits it as a transparent 2px outline in
        // @layer utilities, which lands after the global `:focus-visible` ring
        // in @layer base at equal specificity and wins — leaving a keyboard
        // user with no indicator at all on the primary search field.
        // `min-w-0`: a flex item defaults to `min-width: auto`, and an input's
        // intrinsic floor is its `size` attribute (~20 characters), so at
        // 320px it refused to shrink and pushed itself and the ⌘K badge out
        // over the buttons beside it.
        className="min-w-0 grow bg-transparent text-ink-strong placeholder:text-ink-subtle"
      />
      {/* The list hangs under the field, on its own surface with the overlay
          shadow, and rises in. Each row is a real `next/link` (client
          navigation, so the search and any selection survive; not prefetched,
          because the search route is rate-limited): the keyboard reaches it
          through the field, and a pointer's `mousedown` is swallowed so the
          field never blurs (and closes the list) before the click lands. */}
      <ul
        id={listId}
        role="listbox"
        aria-label="Suggestions"
        hidden={!shown}
        className={cn(
          "absolute left-0 right-0 top-full z-overlay mt-1.5 m-0 max-h-[24rem] list-none overflow-y-auto rounded-md border border-line bg-surface p-1 text-ink shadow-md animate-rise motion-reduce:animate-none",
        )}
      >
        {items.map((s, i) => (
          <li key={`${s.type}-${s.label}-${i}`} role="presentation" onMouseEnter={() => setActive(i)}>
            <Link
              id={`${listId}-${i}`}
              href={suggestionHref(s)}
              prefetch={false}
              role="option"
              aria-selected={i === active}
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-2.5 rounded-sm px-2.5 py-1.5 transition-colors duration-fast",
                i === active && "bg-brand-tint text-brand-ink",
              )}
            >
              <span className={cn("inline-flex text-ink-muted", i === active && "text-brand-ink")}>
                <Icon name={KIND[s.type].icon} />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-strong">{s.label}</span>
              <span className={cn("shrink-0 text-xs text-ink-subtle", i === active && "text-brand-ink")}>{suggestionHint(s)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
