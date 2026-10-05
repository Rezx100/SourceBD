"use client";

// The v4 search field's suggestions (Paper `02 Components` · Inputs, "Select, combobox, date": the
// supplier combobox). The page draws the box around the field (the topbar's 480, or the phone's 48
// tall one); this is the input and the list that hangs under that box. It is a combobox over a
// listbox: arrows move the active row (`aria-activedescendant`, the focus stays in the field),
// Enter follows it, Escape closes the list and nothing else.
//
// Which rows, and in what order, is `lib/search-suggest.ts` on the server (`/api/discover/suggest`,
// words typed, HS categories, products as filed, certificates, places, then suppliers by name).
// Where a row leads and what it says is `lib/search-suggest-ui.ts`. A supplier opens its record
// beside the results (`?record=`), a real `next/link` so the search and the selection survive; the
// "Search" row is the form's own submit, so the filters a results page carries as hidden fields
// ride along. With no script the field is still a GET form. Empty and focused, it lists the
// buyer's recent searches. A supplier row says its name and place; there is no contact detail and
// no score in a suggestion.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { readRecentSearches } from "./record-recent-search";
import {
  DEBOUNCE_MS,
  SUGGEST_PATH,
  fieldValue,
  highlightParts,
  rowWords,
  stepIndex,
  suggestionHref,
  suggestionRows,
  type Suggestion,
} from "@/lib/search-suggest-ui";
import { cn } from "@/lib/utils";

export function SearchCombobox({
  variant,
  placeholder,
  ariaLabel = "Search",
  defaultValue = "",
  inputClassName,
  shortcutTarget = false,
}: {
  /** `topbar`: the desktop field, 14px. `phone`: the page's 48-tall field at 16px, rows 44 tall. */
  variant: "topbar" | "phone";
  placeholder: string;
  ariaLabel?: string;
  /** What the field starts with off the results page; on `/app/discover` it follows the URL's `q`. */
  defaultValue?: string;
  inputClassName?: string;
  /** Marks the field Ctrl K focuses (`data-search="topbar"`): the one field the desktop frame draws. */
  shortcutTarget?: boolean;
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
          /* aborted, or the network: the form still submits a plain search */
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value]);

  // A press outside closes the list and the field keeps its text. `pointerdown`, not `mousedown`:
  // iOS sends no mouse events for a tap on plain content.
  useEffect(() => {
    function onDown(e: PointerEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const rows = suggestionRows(value, fetched, recent);
  const shown = open && rows.length > 0;
  const phone = variant === "phone";
  const at = { pathname, search: params?.toString() ?? "" };
  const q = value.trim();

  function choose(i: number) {
    const row = rows[i];
    if (!row) return;
    setOpen(false);
    if (row.type === "query") {
      input.current?.form?.requestSubmit();
      return;
    }
    document.getElementById(`${listId}-${i}`)?.click();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (rows.length === 0) return;
      e.preventDefault();
      setOpen(true);
      setActive((i) => stepIndex(i, e.key === "ArrowDown" ? 1 : -1, rows.length));
    } else if (e.key === "Enter") {
      // On a highlighted row, follow it. With nothing highlighted the form submits: a plain search.
      if (active >= 0 && shown) {
        e.preventDefault();
        choose(active);
      } else {
        setOpen(false);
      }
    } else if (e.key === "Escape" && shown) {
      // Closes the list only: not a pane behind it, not a dialog around it.
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      setActive(-1);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  function onFocus() {
    setRecent(readRecentSearches().map((r) => ({ type: "recent", label: r.label, href: r.href, count: r.count })));
    setOpen(true);
  }

  return (
    <div ref={wrap} className="contents">
      <input
        ref={input}
        type="search"
        name="q"
        data-search={shortcutTarget ? "topbar" : undefined}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={onFocus}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-expanded={shown}
        aria-controls={listId}
        aria-activedescendant={shown && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        className={cn(
          "min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-3 [&::-webkit-search-cancel-button]:hidden",
          phone ? "text-md" : "text-base",
          inputClassName,
        )}
      />
      <span role="status" className="sr-only">
        {shown ? `${rows.length} ${rows.length === 1 ? "suggestion" : "suggestions"}` : ""}
      </span>
      {/* Hangs under the field on its own surface (Paper: 4 padding, radius lg, the menu shadow,
          6 below the field, as wide as the field's outer edge: the topbar's border is on the form
          itself, so its list reaches one pixel past the form's padding box). z-toast: above a
          filter panel laid over the results (z-overlay). */}
      <div
        className={cn(
          "absolute z-toast mt-1.5 flex-col rounded-lg border border-line bg-surface p-1 shadow-menu",
          phone ? "inset-x-0 top-full" : "-inset-x-px top-[calc(100%+1px)]",
          shown ? "flex" : "hidden",
        )}
      >
        <div id={listId} role="listbox" aria-label="Suggestions" className="flex max-h-[min(28rem,60dvh)] flex-col overflow-y-auto">
          {rows.map((s, i) => {
            const words = rowWords(s);
            const on = i === active;
            const body = (
              <>
                {/* A name wraps; it is never cut (Paper: "Names wrap; they are never cut"). */}
                <span className="text-base font-medium text-ink [overflow-wrap:anywhere]">
                  {s.type === "query"
                    ? words.name
                    : highlightParts(words.name, q).map((p, k) =>
                        p.hit ? (
                          <span key={k} className="font-semibold">
                            {p.text}
                          </span>
                        ) : (
                          <Fragment key={k}>{p.text}</Fragment>
                        ),
                      )}
                </span>
                <span className="text-xs text-ink-3">{words.sub}</span>
              </>
            );
            const rowClass = cn(
              "flex cursor-pointer flex-col gap-0.5 rounded-sm px-2 py-1.5 text-left",
              phone && "min-h-touch justify-center",
              on && "bg-brand-wash",
            );
            return s.type === "query" ? (
              <div
                key={`${s.type}-${i}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={on}
                onMouseMove={() => (on ? null : setActive(i))}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(i)}
                className={rowClass}
              >
                {body}
              </div>
            ) : (
              <Link
                key={`${s.type}-${s.label}-${i}`}
                id={`${listId}-${i}`}
                href={suggestionHref(s, at)}
                prefetch={false}
                scroll={false}
                role="option"
                aria-selected={on}
                tabIndex={-1}
                onMouseMove={() => (on ? null : setActive(i))}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setOpen(false)}
                className={rowClass}
              >
                {body}
              </Link>
            );
          })}
        </div>
        <div className="border-t border-line px-2 pb-1 pt-2 text-xs text-ink-3 max-md:hidden">Enter to open · arrows to move · Esc to close</div>
      </div>
    </div>
  );
}
