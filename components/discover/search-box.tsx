// Live Discover search box (client island).
//
// Google-style typeahead: every keystroke (debounced ~130ms) queries
// `/api/discover/suggest`, which fuzzy-matches company names, products,
// locations and certifications from the live database. Results render in
// a keyboard-navigable dropdown.
//
// Progressive enhancement: the element is a real GET <form> targeting
// `basePath` with an `q` input, so it still works with JS disabled. With
// JS, selecting a company jumps straight to its profile; selecting a term
// (or pressing Enter) runs a keyword search.

"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Buildings,
  MagnifyingGlass,
  MapPin,
  Package,
  SealCheck,
} from "@phosphor-icons/react/dist/ssr";

import { Button, fieldBox, fieldEdge } from "@/components/kit";
import { cn } from "@/lib/utils";

type Suggestion =
  | { type: "company"; label: string; sublabel: string | null; slug: string }
  | { type: "product" | "location" | "cert"; label: string; value: string };

type Props = {
  basePath: string;
  /** Profile route base for company jumps, e.g. "/suppliers" or "/app/suppliers". */
  profileBase: string;
  q: string;
  sort: string;
};

const DEBOUNCE_MS = 130;

const TYPE_ICON = {
  company: Buildings,
  product: Package,
  location: MapPin,
  cert: SealCheck,
} as const;

const TYPE_HINT = {
  company: null,
  product: "Product",
  location: "Location",
  cert: "Certification",
} as const;

export function DiscoverSearchBox({ basePath, profileBase, q, sort }: Props) {
  const router = useRouter();
  const listId = useId();

  const [value, setValue] = useState(q);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);

  const goToSearch = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      if (!trimmed) return;
      setOpen(false);
      const params = new URLSearchParams({ q: trimmed });
      if (sort && sort !== "default") params.set("sort", sort);
      router.push(`${basePath}?${params.toString()}`);
    },
    [basePath, router, sort],
  );

  const selectSuggestion = useCallback(
    (s: Suggestion) => {
      if (s.type === "company") {
        setOpen(false);
        router.push(`${profileBase}/${s.slug}`);
        return;
      }
      setValue(s.label);
      goToSearch(s.value);
    },
    [goToSearch, profileBase, router],
  );

  // Debounced suggestion fetch. Aborts the in-flight request on every new
  // keystroke and discards out-of-order responses via a sequence guard.
  useEffect(() => {
    const term = value.trim();

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (term.length === 0) {
      abortRef.current?.abort();
      setSuggestions([]);
      setLoading(false);
      setActiveIndex(-1);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(() => {
      const seq = ++requestSeq.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      fetch(`/api/discover/suggest?q=${encodeURIComponent(term)}`, {
        signal: controller.signal,
        headers: { accept: "application/json" },
      })
        .then((r) => (r.ok ? r.json() : { suggestions: [] }))
        .then((data: { suggestions?: Suggestion[] }) => {
          if (seq !== requestSeq.current) return;
          const next = Array.isArray(data.suggestions) ? data.suggestions : [];
          setSuggestions(next);
          setActiveIndex(-1);
          setOpen(true);
          setLoading(false);
        })
        .catch((err) => {
          if ((err as Error)?.name === "AbortError") return;
          if (seq !== requestSeq.current) return;
          setSuggestions([]);
          setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  // Close on outside click.
  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const hasDropdown = open && value.trim().length > 0;
  const showEmpty = hasDropdown && !loading && suggestions.length === 0;

  const activeDescendant = useMemo(
    () => (activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined),
    [activeIndex, listId],
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      if (suggestions.length === 0) return;
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      if (suggestions.length === 0) return;
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        e.preventDefault();
        selectSuggestion(suggestions[activeIndex]);
      }
      // else: let the form submit naturally (keyword search).
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <form
      method="get"
      action={basePath}
      role="search"
      aria-label="Search suppliers"
      onSubmit={(e) => {
        // Intercept so we can normalise + keep client routing; the plain
        // form is the no-JS fallback.
        if (value.trim()) {
          e.preventDefault();
          goToSearch(value);
        }
      }}
      className="flex w-full max-w-[560px] gap-2 max-sm:flex-col"
    >
      {sort && sort !== "default" ? (
        <input type="hidden" name="sort" value={sort} />
      ) : null}

      <label htmlFor="discover-hero-q" className="sr-only">
        Search suppliers
      </label>

      <div ref={containerRef} className="relative flex-1">
        <div className="relative">
          <MagnifyingGlass
            aria-hidden
            size={20}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
          />
          <input
            id="discover-hero-q"
            type="search"
            name="q"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => {
              if (value.trim() && suggestions.length > 0) setOpen(true);
            }}
            onKeyDown={onKeyDown}
            placeholder="Supplier, product or certificate"
            inputMode="search"
            autoComplete="off"
            role="combobox"
            aria-expanded={hasDropdown}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeDescendant}
            className={cn(fieldBox, fieldEdge, "h-12 pl-10 pr-9 text-md max-sm:h-input-touch")}
          />
          {loading ? (
            <span
              aria-hidden
              className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-line border-t-brand motion-reduce:animate-none"
            />
          ) : null}
        </div>

        {hasDropdown ? (
          <div className="absolute inset-x-0 top-full z-toast mt-1.5 rounded-lg border border-line bg-surface p-1 shadow-menu">
            {showEmpty ? (
              <p className="px-2 py-2 text-left text-base text-ink-2">
                No matches. Press Enter to search &ldquo;{value.trim()}&rdquo; anyway.
              </p>
            ) : (
              <ul id={listId} role="listbox" aria-label="Search suggestions" className="max-h-[min(28rem,60dvh)] overflow-y-auto">
                {suggestions.map((s, i) => {
                  const Icon = TYPE_ICON[s.type];
                  const hint = TYPE_HINT[s.type];
                  const isActive = i === activeIndex;
                  return (
                    <li
                      key={`${s.type}-${s.type === "company" ? s.slug : s.label}-${i}`}
                      id={`${listId}-opt-${i}`}
                      role="option"
                      aria-selected={isActive}
                    >
                      <button
                        type="button"
                        onMouseEnter={() => setActiveIndex(i)}
                        onClick={() => selectSuggestion(s)}
                        className={cn("flex min-h-11 w-full items-center gap-3 rounded-sm px-2 py-1.5 text-left", isActive && "bg-brand-wash")}
                      >
                        <Icon aria-hidden size={18} className="shrink-0 text-ink-3" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-base font-medium text-ink [overflow-wrap:anywhere]">{s.label}</span>
                          {s.type === "company" && s.sublabel ? (
                            <span className="block text-xs text-ink-3">{s.sublabel}</span>
                          ) : null}
                        </span>
                        {hint ? <span className="shrink-0 text-xs text-ink-3">{hint}</span> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      <Button type="submit" kind="primary" size="lg" className="h-12 px-6 max-sm:h-input-touch">
        Search
      </Button>
    </form>
  );
}
