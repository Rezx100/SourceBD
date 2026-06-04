"use client";

// Supplier partner request form (Spec S5). Used on /supplier/partners
// alongside the list. Client-side typeahead via
// `/api/v1/supplier/relationships?action=search`, then POST `action=request`.
// All gating is re-enforced server-side by the SECURITY DEFINER RPC.

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type OwnedSupplier = {
  id: string;
  slug: string;
  company_name: string;
  entity_type: "buying_house" | "factory";
};

type SearchHit = {
  id: string;
  slug: string;
  company_name: string;
  entity_type: "buying_house" | "factory";
  city: string | null;
  district: string | null;
};

const MAX_NOTE = 1000;

export function SupplierPartnerRequestForm({
  ownedSuppliers,
}: {
  ownedSuppliers: OwnedSupplier[];
}) {
  const router = useRouter();
  const [mineId, setMineId] = useState<string>(ownedSuppliers[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [picked, setPicked] = useState<SearchHit | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const debounce = useRef<number | null>(null);

  const mine = ownedSuppliers.find((s) => s.id === mineId) ?? null;
  const targetEntityType: "buying_house" | "factory" | null = mine
    ? mine.entity_type === "buying_house"
      ? "factory"
      : "buying_house"
    : null;

  useEffect(() => {
    setPicked(null);
    setHits([]);
    setQuery("");
  }, [mineId]);

  useEffect(() => {
    if (debounce.current) {
      window.clearTimeout(debounce.current);
    }
    if (!targetEntityType || query.trim().length < 2) {
      setHits([]);
      return;
    }
    debounce.current = window.setTimeout(async () => {
      const params = new URLSearchParams({
        action: "search",
        q: query.trim(),
        entity_type: targetEntityType,
      });
      try {
        const res = await fetch(`/api/v1/supplier/relationships?${params}`);
        if (!res.ok) {
          setHits([]);
          return;
        }
        const json = (await res.json()) as { results?: SearchHit[] };
        setHits(json.results ?? []);
      } catch {
        setHits([]);
      }
    }, 200);
    return () => {
      if (debounce.current) {
        window.clearTimeout(debounce.current);
      }
    };
  }, [query, targetEntityType]);

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!mine || !picked || !targetEntityType) {
      setError("Pick one of your companies and a counterparty.");
      return;
    }
    const buyingHouseId =
      mine.entity_type === "buying_house" ? mine.id : picked.id;
    const factoryId =
      mine.entity_type === "factory" ? mine.id : picked.id;
    startTransition(async () => {
      const res = await fetch("/api/v1/supplier/relationships", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "request",
          buying_house_id: buyingHouseId,
          factory_id: factoryId,
          note: note.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
        setError(j.detail ?? j.error ?? "Request failed.");
        return;
      }
      setInfo("Request sent.");
      setQuery("");
      setPicked(null);
      setHits([]);
      setNote("");
      router.refresh();
    });
  }

  if (ownedSuppliers.length === 0) {
    return (
      <p className="text-sm text-ink-tertiary">
        Claim a company first to request partnerships.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="rel-mine"
          className="text-[11px] text-ink-tertiary"
        >
          From your company
        </label>
        <select
          id="rel-mine"
          value={mineId}
          onChange={(e) => setMineId(e.target.value)}
          className="rounded-input border border-hairline bg-surface-l1 px-3 py-2 text-sm text-ink-primary"
        >
          {ownedSuppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.company_name} ({s.entity_type.replace(/_/g, " ")})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="rel-q"
          className="text-[11px] text-ink-tertiary"
        >
          {targetEntityType === "factory"
            ? "Find a partner factory"
            : "Find a partner buying house"}
        </label>
        <input
          id="rel-q"
          type="text"
          autoComplete="off"
          value={picked ? picked.company_name : query}
          onChange={(e) => {
            setPicked(null);
            setQuery(e.target.value);
          }}
          placeholder="Company name or slug…"
          className="rounded-input border border-hairline bg-surface-l1 px-3 py-2 text-sm text-ink-primary"
        />
        {!picked && hits.length > 0 ? (
          <ul className="m-0 mt-1 flex max-h-56 list-none flex-col overflow-y-auto rounded-input border border-hairline bg-surface-l1 p-0 shadow-l1">
            {hits.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPicked(h);
                    setHits([]);
                    setQuery("");
                  }}
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-brand-forest-tint"
                >
                  <span className="font-semibold text-ink-primary">
                    {h.company_name}
                  </span>
                  <span className="text-[11px] text-ink-tertiary">
                    {h.entity_type.replace(/_/g, " ")} ·{" "}
                    {[h.city, h.district].filter(Boolean).join(", ") || "—"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="rel-note"
          className="text-[11px] text-ink-tertiary"
        >
          Note (optional)
        </label>
        <textarea
          id="rel-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={MAX_NOTE}
          rows={3}
          className="rounded-input border border-hairline bg-surface-l1 px-3 py-2 text-sm text-ink-primary"
        />
      </div>

      {error ? <p className="text-sm text-sem-red">{error}</p> : null}
      {info ? <p className="text-sm text-sem-green">{info}</p> : null}

      <div>
        <Button type="submit" variant="primary" disabled={pending || !picked}>
          {pending ? "Sending…" : "Send request"}
        </Button>
      </div>
    </form>
  );
}
