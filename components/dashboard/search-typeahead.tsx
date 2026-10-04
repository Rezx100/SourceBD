"use client";

// The app's search field, with suggestions as the buyer types — in the topbar
// on every page, and as the large field on the search landing (`/app`).
//
// Rebuilt 28 Sep 2026 after the founder's walkthrough ("the search is
// everything for this website"): the list opened on companies found by their
// product lists, so "shirt" led with a firm whose name has nothing to do with
// shirts. It now reads the way a buyer thinks, top to bottom:
//
//   Search "shirt"                          ← the words typed, always first
//   PRODUCT CATEGORIES  Men's knit shirts · HS 6105 …
//   PRODUCTS AS FILED   Polo shirts …
//   CERTIFICATES / PLACES
//   SUPPLIERS           Basic Shirts Ltd. (a NAME match only)
//
// With the field empty and focused it offers the buyer's recent searches. The
// matching lives in `lib/search-suggest.ts`, on the server; the order of the
// groups and where each row leads live here, as pure exported helpers,
// because the suite is `node --test` over `renderToStaticMarkup` with no DOM.
//
// The field is the same `<input name="q" data-search="topbar">` on the server,
// so the GET form, the keyboard shortcut and a no-script browser still work.
// Enter with no row highlighted submits the form: a plain search for the
// words typed.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { formatCount } from "@/lib/dashboard/facts";
import {
  DEBOUNCE_MS,
  SUGGEST_PATH,
  fieldValue,
  highlightParts,
  stepIndex,
  suggestionHref,
  suggestionRows,
  type Suggestion,
} from "@/lib/search-suggest-ui";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./icons";
import { readRecentSearches } from "./record-recent-search";

// The pure half (the rows, the links, the arrow keys) lives in `lib/search-suggest-ui.ts`, shared
// with the v4 field; it is re-exported here so this kit and its tests are unchanged until B11.
export type { Suggestion };
export { DEBOUNCE_MS, SUGGEST_PATH, fieldValue, highlightParts, stepIndex, suggestionHref, suggestionRows };

const KIND: Record<Suggestion["type"], { icon: IconName; hint: string; group: string | null }> = {
  query: { icon: "search", hint: "Search", group: null },
  recent: { icon: "history", hint: "Recent", group: "Recent searches" },
  heading: { icon: "tag", hint: "Category", group: "Product categories" },
  product: { icon: "tag", hint: "Product", group: "Products as filed" },
  cert: { icon: "seal", hint: "Certificate", group: "Certificates" },
  location: { icon: "pin", hint: "Place", group: "Places" },
  company: { icon: "building", hint: "Supplier", group: "Suppliers" },
};

/** What a row says at its right edge. */
export function suggestionHint(s: Suggestion): string {
  if (s.type === "company") return s.sublabel ?? KIND.company.hint;
  if (s.type === "heading") return `HS ${s.hs}`;
  if (s.type === "location" && s.param) return s.param[0] === "city" ? "City" : "District";
  if (s.type === "recent") return s.count === null ? "" : `${formatCount(s.count)} suppliers`;
  return KIND[s.type].hint;
}

export function SearchTypeahead({
  defaultValue,
  variant = "topbar",
  autoFocus = false,
}: {
  defaultValue: string;
  /** `hero`: the search landing's large field. */
  variant?: "topbar" | "hero";
  autoFocus?: boolean;
}) {
  const listId = useId();
  const pathname = usePathname();
  const params = useSearchParams();
  const urlValue = fieldValue(pathname, params?.get("q") ?? null, defaultValue);
  const [value, setValue] = useState(urlValue);
  useEffect(() => {
    setValue(urlValue);
  }, [urlValue]);
  const [fetched, setFetched] = useState<Suggestion[]>([]);
  const [recent, setRecent] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const seq = useRef(0);
  // The landing focuses its field on load; that focus is the page's, not the
  // buyer's, and must not open the list over the page before they act.
  const quietFocus = useRef(autoFocus);

  useEffect(() => {
    const q = value.trim();
    setActive(-1);
    if (q.length === 0) {
      abort.current?.abort();
      setFetched([]);
      return;
    }
    const timer = setTimeout(() => {
      const mine = ++seq.current;
      abort.current?.abort();
      const ctl = new AbortController();
      abort.current = ctl;
      fetch(`${SUGGEST_PATH}?scope=app&q=${encodeURIComponent(q)}`, { signal: ctl.signal, headers: { accept: "application/json" } })
        .then((r) => (r.ok ? r.json() : { suggestions: [] }))
        .then((data: { suggestions?: Suggestion[] }) => {
          if (mine !== seq.current) return;
          setFetched(Array.isArray(data.suggestions) ? data.suggestions : []);
        })
        .catch(() => {
          /* aborted, or the network: the plain form still submits */
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value]);

  // A press outside closes the list; the field keeps its text. `pointerdown`,
  // not `mousedown`: iOS sends no mouse events for a tap on plain content, so
  // "Recent searches" stayed open over the page (founder's video, 30 Sep 2026).
  useEffect(() => {
    function onDown(e: PointerEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const rows = suggestionRows(value, fetched, recent);
  const shown = open && rows.length > 0;
  const hero = variant === "hero";
  const at = { pathname, search: params?.toString() ?? "" };

  function choose(i: number) {
    const row = rows[i];
    if (!row) return;
    setOpen(false);
    if (row.type === "query") {
      // The same thing Enter does: the form's own submit, so the filters the
      // results page carries as hidden fields ride along.
      input.current?.form?.requestSubmit();
      return;
    }
    document.getElementById(`${listId}-${i}`)?.click();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (rows.length === 0) return;
      e.preventDefault();
      setOpen(true);
      setActive((i) => stepIndex(i, e.key === "ArrowDown" ? 1 : -1, rows.length));
    } else if (e.key === "Enter") {
      // Enter on a highlighted row follows that row. With nothing highlighted
      // the form submits: a plain search for the words typed.
      if (active >= 0 && shown) {
        e.preventDefault();
        choose(active);
      } else {
        setOpen(false);
      }
    } else if (e.key === "Escape" && shown) {
      e.preventDefault();
      setOpen(false);
      setActive(-1);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  function onFocus() {
    setRecent(readRecentSearches().map((r) => ({ type: "recent", label: r.label, href: r.href, count: r.count })));
    if (quietFocus.current) {
      quietFocus.current = false;
      return;
    }
    setOpen(true);
  }

  const q = value.trim();
  let lastGroup: string | null = null;

  return (
    <div ref={wrap} className="contents">
      <input
        ref={input}
        type="search"
        name="q"
        // What `SEARCH_FIELD_SELECTOR` looks for: the app's one search field
        // on the page (the topbar's, or the landing's own on `/app`, where the
        // topbar's steps aside).
        data-search="topbar"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={onFocus}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={hero ? "Search a product, HS code, certificate, place or supplier" : "Search suppliers, HS codes, certificates"}
        aria-label="Search suppliers, HS codes, certificates"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={listId}
        aria-activedescendant={shown && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        autoFocus={autoFocus}
        // The field around this input is the focus indicator (its outline
        // steps up to brand with a soft ring), so the input draws none of its
        // own: the global ring here was a green box inside the green field.
        // `min-w-0`: a flex item's floor is its `size` (~20 characters), which
        // at 320px pushed the shortcut hint out over the buttons beside it.
        className={cn(
          "min-w-0 grow bg-transparent text-ink-strong placeholder:text-ink-subtle focus-visible:outline-none",
          hero && "text-lg",
        )}
      />
      {/* The list hangs under the field on its own surface with the overlay
          shadow. Each row that leads somewhere is a real `next/link` (client
          navigation, so the search and any selection survive; not prefetched,
          because the search route is rate-limited); the typed-words row
          submits the form. A pointer's `mousedown` is swallowed so the field
          never blurs before the click lands. */}
      <div
        id={listId}
        role="listbox"
        aria-label="Suggestions"
        hidden={!shown}
        className={cn(
          "absolute left-0 right-0 top-full z-overlay m-0 max-h-[min(28rem,70vh)] overflow-y-auto rounded-md border border-line bg-surface p-1.5 text-ink shadow-md animate-rise motion-reduce:animate-none",
          hero ? "mt-2" : "mt-1.5",
        )}
      >
        {rows.map((s, i) => {
          const group = KIND[s.type].group;
          const header = group !== lastGroup && group !== null ? group : null;
          lastGroup = group;
          const on = i === active;
          const body: ReactNode = (
            <>
              <span className={cn("inline-flex shrink-0 text-ink-subtle", on && "text-brand-ink")}>
                <Icon name={KIND[s.type].icon} />
              </span>
              {/* One line, cut at the end with the whole label in its title: a
                  company's name here follows the One-Line Name Rule. */}
              <span data-name="" title={s.label} className="min-w-0 flex-1 truncate text-ink">
                {s.type === "query" ? (
                  <>
                    <span className="text-ink-muted">Search </span>
                    <span className="font-semibold text-ink-strong">“{s.label}”</span>
                  </>
                ) : (
                  highlightParts(s.label, q).map((p, k) =>
                    p.hit ? (
                      <span key={k} className="font-semibold text-ink-strong">
                        {p.text}
                      </span>
                    ) : (
                      <Fragment key={k}>{p.text}</Fragment>
                    ),
                  )
                )}
              </span>
              {s.type === "query" ? (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-subtle">
                  <Icon name="enter" small /> Enter
                </span>
              ) : (
                <span className={cn("shrink-0 text-xs", s.type === "heading" ? "font-mono text-ink-muted" : "text-ink-subtle", on && "text-brand-ink")}>
                  {suggestionHint(s)}
                </span>
              )}
            </>
          );
          const rowClass = cn(
            "flex min-h-9 cursor-pointer items-center gap-3 rounded-sm px-2.5 py-1.5 text-sm transition-colors duration-fast",
            hero && "min-h-10 text-base",
            on && "bg-surface-sunken",
          );
          return (
            <Fragment key={`${s.type}-${s.label}-${i}`}>
              {header ? (
                <div role="presentation" className="px-2.5 pb-1 pt-2.5 font-mono text-eyebrow uppercase text-ink-subtle">
                  {header}
                </div>
              ) : null}
              {s.type === "query" ? (
                <div
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={on}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(i)}
                  className={rowClass}
                >
                  {body}
                </div>
              ) : (
                <Link
                  id={`${listId}-${i}`}
                  href={suggestionHref(s, at)}
                  prefetch={false}
                  scroll={false}
                  role="option"
                  aria-selected={on}
                  tabIndex={-1}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setOpen(false)}
                  className={rowClass}
                >
                  {body}
                </Link>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
