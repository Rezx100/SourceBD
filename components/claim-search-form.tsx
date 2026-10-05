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

import { Button, Field, InlineError, Input, fieldBox, fieldEdge, ringInset } from "@/components/kit";
import { cn } from "@/lib/utils";

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
    <div className="flex flex-col gap-4">
      {selected ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-subtle px-3 py-2">
          <div>
            <p className="text-base font-medium text-ink">
              {selected.company_name}
            </p>
            <p className="text-sm text-ink-3">Selected</p>
          </div>
          <Button type="button" kind="quiet" onClick={clearSelection}>
            Change
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Field label="Search company name">
            {(a) => (
              <Input
                {...a}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="e.g. Square Apparels"
                autoComplete="off"
              />
            )}
          </Field>
          {searching ? (
            <p role="status" className="text-sm text-ink-3">Searching…</p>
          ) : null}
          {results.length > 0 ? (
            <ul className="max-h-64 divide-y divide-line overflow-auto rounded-md border border-line">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className={cn("block w-full px-3 py-2 text-left hover:bg-subtle", ringInset)}
                    onClick={() =>
                      setSelected({ id: r.id, company_name: r.company_name })
                    }
                  >
                    <p className="text-base font-medium text-ink">
                      {r.company_name}
                    </p>
                    <p className="text-sm text-ink-3">
                      {[r.city, r.district].filter(Boolean).join(", ") || "—"}
                      {r.website_host ? ` · ${r.website_host}` : ""}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {q.trim().length >= 2 && !searching && results.length === 0 ? (
            <p className="text-sm text-ink-3">
              No unclaimed matches. Companies that are already claimed or
              unpublished are hidden.
            </p>
          ) : null}
        </div>
      )}

      {selected ? (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field
            label="Proof email (must be at your company)"
            help="If this domain matches the company's published website, your claim is approved automatically."
          >
            {(a) => (
              <Input
                {...a}
                type="email"
                required
                value={proofEmail}
                onChange={(e) => setProofEmail(e.target.value)}
                placeholder="you@yourcompany.com"
                autoComplete="email"
              />
            )}
          </Field>
          <Field label="Note to admin (optional)">
            {(a) => (
              <textarea
                {...a}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={2000}
                className={cn(fieldBox, fieldEdge, "px-2.5 py-1.5 text-base")}
              />
            )}
          </Field>
          {error ? <InlineError>{error}</InlineError> : null}
          {info ? <p role="status" className="text-sm text-ink-2">{info}</p> : null}
          <div>
            <Button type="submit" kind="primary" loading={submitting} loadingLabel="Sending…">
              Send verification email
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
