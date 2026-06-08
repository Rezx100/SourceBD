"use client";

// Spec S1 — supplier claim search + initiate form.
//
// Two-step flow:
//   1. Search the directory (GET /api/v1/claims?view=search&q=…).
//   2. Pick a supplier, type a proof email + optional note, submit
//      (POST /api/v1/claims action=initiate).
//
// When `prebound` is passed (deep-link from a Claim CTA on a profile),
// the search step is skipped and the supplier card is pre-selected.

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";

type SearchHit = {
  id: string;
  slug: string;
  company_name: string;
  entity_type: string;
  city: string | null;
  district: string | null;
  website_host: string | null;
};

type Prebound = { id: string; slug: string; company_name: string } | null;

export interface ClaimSearchFormProps {
  prebound: Prebound;
}

export function ClaimSearchForm({ prebound }: ClaimSearchFormProps) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<{
    id: string;
    company_name: string;
  } | null>(prebound ? { id: prebound.id, company_name: prebound.company_name } : null);
  const [proofEmail, setProofEmail] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, startSubmitting] = useTransition();

  // Debounced search.
  useEffect(() => {
    if (selected) return;
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/v1/claims?view=search&q=${encodeURIComponent(term)}`,
          { signal: ctl.signal },
        );
        if (!res.ok) {
          setResults([]);
          return;
        }
        const json = (await res.json()) as {
          search?: { results?: SearchHit[] };
        };
        setResults(json.search?.results ?? []);
      } catch {
        // ignored
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [q, selected]);

  function clearSelection() {
    setSelected(null);
    setProofEmail("");
    setNote("");
    setError(null);
    setInfo(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    setInfo(null);
    startSubmitting(async () => {
      try {
        const res = await fetch("/api/v1/claims", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "initiate",
            supplier_id: selected.id,
            proof_email: proofEmail.trim(),
            note: note.trim() || null,
          }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          claim_id?: string;
          method?: "domain_email" | "manual_review";
          email_sent?: boolean;
          dev_verification_url?: string;
          error?: string;
          detail?: string;
        };
        if (!res.ok || !json.ok) {
          setError(json.detail ?? json.error ?? `Failed (${res.status})`);
          return;
        }
        const parts = [
          json.method === "domain_email"
            ? "Domain matches — clicking the verification link will activate your claim immediately."
            : "Verify your email, then an admin will review the claim.",
        ];
        if (json.email_sent === false && json.dev_verification_url) {
          parts.push(`Dev link: ${json.dev_verification_url}`);
        } else if (json.email_sent) {
          parts.push(`Check ${proofEmail.trim()} for the confirmation email.`);
        }
        setInfo(parts.join(" "));
        if (json.claim_id) {
          router.push(`/supplier/claim/${json.claim_id}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <div className="space-y-4">
      {selected ? (
        <div className="flex items-center justify-between rounded-input border border-hairline bg-bg-l0 px-3 py-2">
          <div>
            <p className="text-sm font-semibold text-ink-primary">
              {selected.company_name}
            </p>
            <p className="text-[11px] text-ink-tertiary">Selected</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
            Change
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <label
            htmlFor="claim-search"
            className="text-xs font-medium text-ink-secondary"
          >
            Search company name
          </label>
          <input
            id="claim-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. Square Apparels"
            className="w-full rounded-input border border-hairline bg-bg-l0 px-3 py-2 text-sm outline-none focus:border-accent-indigo"
            autoComplete="off"
          />
          {searching ? (
            <p className="text-[11px] text-ink-tertiary">Searching…</p>
          ) : null}
          {results.length > 0 ? (
            <ul className="max-h-64 divide-y divide-hairline overflow-auto rounded-input border border-hairline">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left hover:bg-surface-l1"
                    onClick={() =>
                      setSelected({ id: r.id, company_name: r.company_name })
                    }
                  >
                    <p className="text-sm font-medium text-ink-primary">
                      {r.company_name}
                    </p>
                    <p className="text-[11px] text-ink-tertiary">
                      {[r.city, r.district].filter(Boolean).join(", ") || "—"}
                      {r.website_host ? ` · ${r.website_host}` : ""}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {q.trim().length >= 2 && !searching && results.length === 0 ? (
            <p className="text-[11px] text-ink-tertiary">
              No unclaimed matches. Companies that are already claimed or
              unpublished are hidden.
            </p>
          ) : null}
        </div>
      )}

      {selected ? (
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <label
              htmlFor="claim-email"
              className="text-xs font-medium text-ink-secondary"
            >
              Proof email (must be at your company)
            </label>
            <input
              id="claim-email"
              type="email"
              required
              value={proofEmail}
              onChange={(e) => setProofEmail(e.target.value)}
              placeholder="you@yourcompany.com"
              className="w-full rounded-input border border-hairline bg-bg-l0 px-3 py-2 text-sm outline-none focus:border-accent-indigo"
              autoComplete="email"
            />
            <p className="text-[11px] text-ink-tertiary">
              If this domain matches the company&apos;s published website, your
              claim is approved automatically.
            </p>
          </div>
          <div className="space-y-1">
            <label
              htmlFor="claim-note"
              className="text-xs font-medium text-ink-secondary"
            >
              Note to admin (optional)
            </label>
            <textarea
              id="claim-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={2000}
              className="w-full rounded-input border border-hairline bg-bg-l0 px-3 py-2 text-sm outline-none focus:border-accent-indigo"
            />
          </div>
          {error ? <p className="text-xs text-sem-red">{error}</p> : null}
          {info ? <p className="text-xs text-sem-green">{info}</p> : null}
          <div className="h-16 md:hidden" aria-hidden />
          <StickyActionBar className="bottom-[calc(56px+env(safe-area-inset-bottom,0px))]">
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Sending…" : "Send verification email"}
            </Button>
          </StickyActionBar>
        </form>
      ) : null}
    </div>
  );
}
