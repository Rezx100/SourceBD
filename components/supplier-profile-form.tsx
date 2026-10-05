"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type KeyboardEvent } from "react";

import { Button, Field, Input, TypeChip, fieldBox, fieldEdge } from "@/components/kit";
import { cn } from "@/lib/utils";

// Spec S2 — supplier-attested editor client island. Controlled inputs for
// all 9 editable keys; chip-style capabilities; partial patch on submit.
// Defence-in-depth caps mirror the server-side check constraints; the
// SECURITY DEFINER RPC is the security boundary.

const MAX_TAGLINE = 160;
const MAX_ABOUT = 4000;
const MAX_CONTACT_NAME = 120;
const MAX_CONTACT_ROLE = 120;
const MAX_CONTACT_PHONE = 40;
const MAX_CAP_LEN = 60;
const MAX_CAPS = 20;
const MAX_LEAD = 365;

type Initial = {
  tagline: string | null;
  about: string | null;
  moq: number | null;
  lead_time_days: number | null;
  capabilities: string[];
  contact_name: string | null;
  contact_role: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

export function SupplierProfileForm({
  supplierId,
  initial,
}: {
  supplierId: string;
  initial: Initial;
}) {
  const router = useRouter();
  const [tagline, setTagline] = useState(initial.tagline ?? "");
  const [about, setAbout] = useState(initial.about ?? "");
  const [moq, setMoq] = useState<string>(
    initial.moq === null ? "" : String(initial.moq),
  );
  const [lead, setLead] = useState<string>(
    initial.lead_time_days === null ? "" : String(initial.lead_time_days),
  );
  const [capabilities, setCapabilities] = useState<string[]>(initial.capabilities);
  const [capDraft, setCapDraft] = useState("");
  const [contactName, setContactName] = useState(initial.contact_name ?? "");
  const [contactRole, setContactRole] = useState(initial.contact_role ?? "");
  const [contactEmail, setContactEmail] = useState(initial.contact_email ?? "");
  const [contactPhone, setContactPhone] = useState(initial.contact_phone ?? "");

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function addCapability() {
    const t = capDraft.trim();
    if (!t) return;
    if (t.length > MAX_CAP_LEN) {
      setError(`Capability must be ≤ ${MAX_CAP_LEN} characters.`);
      return;
    }
    if (capabilities.length >= MAX_CAPS) {
      setError(`At most ${MAX_CAPS} capabilities.`);
      return;
    }
    if (capabilities.includes(t)) {
      setCapDraft("");
      return;
    }
    setCapabilities((prev) => [...prev, t]);
    setCapDraft("");
    setError(null);
  }

  function onCapKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addCapability();
    }
  }

  function removeCap(c: string) {
    setCapabilities((prev) => prev.filter((x) => x !== c));
  }

  function buildPatch(): Record<string, unknown> {
    return {
      tagline: tagline.trim() === "" ? null : tagline.trim().slice(0, MAX_TAGLINE),
      about: about.trim() === "" ? null : about.trim().slice(0, MAX_ABOUT),
      moq: moq.trim() === "" ? null : Number(moq),
      lead_time_days: lead.trim() === "" ? null : Number(lead),
      capabilities,
      contact_name:
        contactName.trim() === ""
          ? null
          : contactName.trim().slice(0, MAX_CONTACT_NAME),
      contact_role:
        contactRole.trim() === ""
          ? null
          : contactRole.trim().slice(0, MAX_CONTACT_ROLE),
      contact_email: contactEmail.trim() === "" ? null : contactEmail.trim(),
      contact_phone:
        contactPhone.trim() === ""
          ? null
          : contactPhone.trim().slice(0, MAX_CONTACT_PHONE),
    };
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const moqStr = moq.trim();
    if (moqStr !== "") {
      const n = Number(moqStr);
      if (!Number.isInteger(n) || n < 0) {
        setError("MOQ must be a non-negative integer.");
        return;
      }
    }
    const leadStr = lead.trim();
    if (leadStr !== "") {
      const n = Number(leadStr);
      if (!Number.isInteger(n) || n < 0 || n > MAX_LEAD) {
        setError(`Lead time must be an integer in 0..${MAX_LEAD}.`);
        return;
      }
    }
    if (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      setError("Contact email is not a valid address.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/supplier/profile", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ supplier_id: supplierId, patch: buildPatch() }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as
            | { detail?: string; error?: string }
            | null;
          setError(j?.detail ?? j?.error ?? `Failed (${res.status})`);
          return;
        }
        setInfo("Saved.");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <section aria-labelledby="attested-title" className="rounded-md border border-line p-5">
      <h2 id="attested-title" className="text-md font-semibold text-ink">
        Supplier-attested details
      </h2>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-5">
        <Field label="Tagline" help={`${tagline.length}/${MAX_TAGLINE}`}>
          {(a) => (
            <Input
              {...a}
              type="text"
              maxLength={MAX_TAGLINE}
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="One-line positioning, e.g. 'Knitwear, premium quality, MOQ 500'"
            />
          )}
        </Field>

        <Field label="About" help={`${about.length}/${MAX_ABOUT}`}>
          {(a) => (
            <textarea
              {...a}
              rows={6}
              maxLength={MAX_ABOUT}
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              className={cn(fieldBox, fieldEdge, "px-2.5 py-2 text-base")}
              placeholder="Company narrative, sustainability story, machinery overview, buyer references…"
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="MOQ (pieces)">
            {(a) => <Input {...a} type="number" min={0} value={moq} onChange={(e) => setMoq(e.target.value)} placeholder="e.g. 500" />}
          </Field>
          <Field label={`Lead time (days, 0–${MAX_LEAD})`}>
            {(a) => <Input {...a} type="number" min={0} max={MAX_LEAD} value={lead} onChange={(e) => setLead(e.target.value)} placeholder="e.g. 60" />}
          </Field>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Capabilities (≤ {MAX_CAPS})</span>
          {capabilities.length > 0 ? (
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {capabilities.map((c) => (
                <li key={c}>
                  <TypeChip className="gap-1 pr-1">
                    <span>{c}</span>
                    <button
                      type="button"
                      onClick={() => removeCap(c)}
                      aria-label={`Remove ${c}`}
                      className="flex size-5 items-center justify-center rounded-sm text-ink-3 outline-none hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                    >
                      ×
                    </button>
                  </TypeChip>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex gap-2">
            <Input
              type="text"
              aria-label="Add a capability"
              value={capDraft}
              onChange={(e) => setCapDraft(e.target.value)}
              onKeyDown={onCapKey}
              maxLength={MAX_CAP_LEN}
              placeholder="Add a capability (Enter to add)"
            />
            <Button kind="secondary" onClick={addCapability}>
              Add
            </Button>
          </div>
          <p className="text-xs text-ink-3">
            {capabilities.length}/{MAX_CAPS} · each ≤ {MAX_CAP_LEN} chars
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact name">
            {(a) => <Input {...a} type="text" maxLength={MAX_CONTACT_NAME} value={contactName} onChange={(e) => setContactName(e.target.value)} />}
          </Field>
          <Field label="Contact role">
            {(a) => <Input {...a} type="text" maxLength={MAX_CONTACT_ROLE} value={contactRole} onChange={(e) => setContactRole(e.target.value)} />}
          </Field>
          <Field label="Contact email">
            {(a) => <Input {...a} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />}
          </Field>
          <Field label="Contact phone">
            {(a) => <Input {...a} type="text" maxLength={MAX_CONTACT_PHONE} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />}
          </Field>
        </div>

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

        <p className="text-xs text-ink-3">
          Your edits never overwrite the register record above. Buyers see
          your supplier-attested values when the register does not publish
          the field; otherwise the register wins.
        </p>

        <div>
          <Button type="submit" kind="primary" loading={pending} loadingLabel="Saving…">
            Save profile
          </Button>
        </div>
      </form>
    </section>
  );
}
