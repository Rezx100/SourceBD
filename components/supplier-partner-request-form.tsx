"use client";

// Supplier partner request form (Spec S5). Used on /supplier/partners
// alongside the list. Client-side typeahead via
// `/api/v1/supplier/relationships?action=search`, then POST `action=request`.
// All gating is re-enforced server-side by the SECURITY DEFINER RPC.

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button, Field, Input, Select, fieldBox, fieldEdge } from "@/components/kit";
import { cn } from "@/lib/utils";

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
      <p className="text-sm text-ink-3">
        Claim a company first to request partnerships.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex max-w-xl flex-col gap-4">
      <Field label="From your company">
        {(a) => (
          <Select
            id={a.id}
            aria-describedby={a["aria-describedby"]}
            value={mineId}
            onValueChange={setMineId}
            options={ownedSuppliers.map((s) => ({
              value: s.id,
              label: `${s.company_name} (${s.entity_type.replace(/_/g, " ")})`,
            }))}
          />
        )}
      </Field>

      <Field
        label={
          targetEntityType === "factory"
            ? "Find a partner factory"
            : "Find a partner buying house"
        }
      >
        {(a) => (
          <div className="flex flex-col gap-1">
            <Input
              {...a}
              type="text"
              autoComplete="off"
              value={picked ? picked.company_name : query}
              onChange={(e) => {
                setPicked(null);
                setQuery(e.target.value);
              }}
              placeholder="Company name or slug…"
            />
            {!picked && hits.length > 0 ? (
              <ul className="m-0 flex max-h-56 list-none flex-col overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-menu">
                {hits.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPicked(h);
                        setHits([]);
                        setQuery("");
                      }}
                      className="flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-1.5 text-left text-base outline-none hover:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
                    >
                      <span className="font-medium text-ink">
                        {h.company_name}
                      </span>
                      <span className="text-xs text-ink-3">
                        {h.entity_type.replace(/_/g, " ")} ·{" "}
                        {[h.city, h.district].filter(Boolean).join(", ") || "—"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </Field>

      <Field label="Note (optional)">
        {(a) => (
          <textarea
            {...a}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={MAX_NOTE}
            rows={3}
            className={cn(fieldBox, fieldEdge, "px-2.5 py-2 text-base")}
          />
        )}
      </Field>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {info ? (
        <p role="status" className="text-sm font-medium text-brand">
          {info}
        </p>
      ) : null}

      <div>
        <Button type="submit" kind="primary" disabled={!picked} loading={pending} loadingLabel="Sending…">
          Send request
        </Button>
      </div>
    </form>
  );
}
