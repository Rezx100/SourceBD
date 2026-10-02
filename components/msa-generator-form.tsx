"use client";

// MSA generator form (client island) — Spec B9.
//
// Composes a draft UK Modern Slavery Act 2015 §54 transparency statement
// (`lib/msa-statement.ts`) from server-aggregated MsaInputs, the UFLPA
// tracker's counts and a small set of buyer-supplied fields (organisation
// name, reporting period, sign-off name + role). Whatever SourceBD cannot
// know stays a `[Confirm: …]` placeholder; the form counts them beside the
// buttons and in every copy or download. Copy-to-clipboard + download-as-.md
// only — no upload or server submission.

import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/dashboard/controls";
import { Field, TextArea, TextInput } from "@/components/dashboard/fields";
import { Icon } from "@/components/dashboard/icons";
import { PageSection } from "@/components/dashboard/page";
import { Toast } from "@/components/dashboard/toast";
import { buildStatement, countPlaceholders, type MsaInputs, type MsaScreening } from "@/lib/msa-statement";

const neverChanges = () => () => {};
const isoDay = (d: Date, local: boolean) =>
  local
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    : d.toISOString().slice(0, 10);

/**
 * Today in the buyer's own time zone. The server cannot know it, so it
 * renders the UTC day and the browser swaps in its own after hydration
 * (`useSyncExternalStore`, so the first client render still matches).
 */
function useToday(): string {
  return useSyncExternalStore(
    neverChanges,
    () => isoDay(new Date(), true),
    () => isoDay(new Date(), false),
  );
}

export function MsaGeneratorForm({ inputs, screening }: { inputs: MsaInputs; screening: MsaScreening | null }) {
  const id = useId();
  const currentYear = new Date().getFullYear();
  const [org, setOrg] = useState("");
  const [year, setYear] = useState(String(currentYear - 1));
  const [signerName, setSignerName] = useState("");
  const [signerRole, setSignerRole] = useState("Director");
  const [toast, setToast] = useState<string | null>(null);
  const today = useToday();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const draft = useMemo(
    () =>
      buildStatement({
        org,
        year,
        signerName,
        signerRole,
        asOf: today,
        inputs,
        screening,
      }),
    [org, year, signerName, signerRole, today, inputs, screening],
  );
  const pending = countPlaceholders(draft);
  const pendingWords = `${pending} ${pending === 1 ? "item" : "items"} still to confirm`;

  function handleCopy() {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setToast("Copying is not available in this browser");
      return;
    }
    navigator.clipboard.writeText(draft).then(
      () => setToast(`Draft copied. ${pendingWords}`),
      () => setToast("Could not copy. Select the preview and copy it instead"),
    );
  }

  function handleDownload() {
    const blob = new Blob([draft], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    // Only what the buyer typed: an empty year is left out, not guessed.
    const slug = [org.trim() || "msa-statement", year.trim()]
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    a.href = url;
    a.download = `${slug || "msa-statement"}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setToast(`Draft downloaded. ${pendingWords}`);
  }

  const fields: { key: string; label: string; value: string; set: (v: string) => void; placeholder: string }[] = [
    { key: "org", label: "Organisation name", value: org, set: setOrg, placeholder: "e.g. Example Apparel Ltd" },
    { key: "year", label: "Reporting financial year", value: year, set: setYear, placeholder: String(currentYear - 1) },
    { key: "signer", label: "Signatory name", value: signerName, set: setSignerName, placeholder: "e.g. Jane Smith" },
    { key: "role", label: "Signatory role", value: signerRole, set: setSignerRole, placeholder: "Director" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
      <PageSection title="Draft your statement" caption="Composed in your browser. Nothing is uploaded.">
        <div className="flex flex-col gap-4 p-4">
          {fields.map((f) => (
            <Field key={f.key} label={f.label} htmlFor={`${id}-${f.key}`}>
              <TextInput
                id={`${id}-${f.key}`}
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                placeholder={f.placeholder}
              />
            </Field>
          ))}
          {pending > 0 ? (
            <p role="note" className="m-0 flex items-start gap-2 rounded-md bg-caution-tint px-3 py-2 text-sm text-caution-ink">
              <Icon name="warn" />
              <span>
                {pending} {pending === 1 ? "item is" : "items are"} marked [Confirm: …]. SourceBD cannot know{" "}
                {pending === 1 ? "it" : "them"}. Fill in or delete each one before you publish.
              </span>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={handleDownload}>
              <Icon name="download" />
              Download draft .md
            </Button>
            <Button onClick={handleCopy}>Copy draft</Button>
          </div>
          <p className="m-0 text-xs text-ink-muted">
            Figures come from SourceBD&apos;s records for your saved suppliers. Section 54 requires board approval, a
            director&apos;s signature (or the equivalent for your kind of organisation) and a link from your homepage (
            <em>Transparency in supply chains: a practical guide</em>). Have counsel review before publication.
          </p>
        </div>
      </PageSection>

      <PageSection title="Preview" caption="Markdown, updates as you type">
        <TextArea
          readOnly
          aria-label="Statement preview"
          value={draft}
          rows={24}
          className="block min-h-[28rem] resize-y rounded-md border-0 font-mono text-sm"
        />
      </PageSection>

      {toast ? <Toast text={toast} href={null} className="fixed z-[60]" /> : null}
    </div>
  );
}
