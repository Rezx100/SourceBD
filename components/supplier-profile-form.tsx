"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { FormGrid } from "@/components/ui/form-grid";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";

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
    <Card>
      <CardHeader>
        <CardTitle>Supplier-attested details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label
              htmlFor="s2-tagline"
              className="block text-xs font-medium text-ink-secondary"
            >
              Tagline
            </label>
            <input
              id="s2-tagline"
              type="text"
              maxLength={MAX_TAGLINE}
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="mt-1 w-full rounded-input border border-hairline bg-bg-l0 px-3 py-2 text-sm text-ink-primary focus:outline-none focus:ring-1 focus:ring-accent-indigo"
              placeholder="One-line positioning, e.g. 'Knitwear, premium quality, MOQ 500'"
            />
            <p className="mt-1 text-xs text-ink-tertiary">
              {tagline.length}/{MAX_TAGLINE}
            </p>
          </div>

          <div>
            <label
              htmlFor="s2-about"
              className="block text-xs font-medium text-ink-secondary"
            >
              About
            </label>
            <textarea
              id="s2-about"
              rows={6}
              maxLength={MAX_ABOUT}
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              className="mt-1 w-full rounded-input border border-hairline bg-bg-l0 px-3 py-2 text-sm text-ink-primary focus:outline-none focus:ring-1 focus:ring-accent-indigo"
              placeholder="Company narrative, sustainability story, machinery overview, buyer references…"
            />
            <p className="mt-1 text-xs text-ink-tertiary">
              {about.length}/{MAX_ABOUT}
            </p>
          </div>

          <FormGrid cols="profile">
            <div>
              <label
                htmlFor="s2-moq"
                className="block text-xs font-medium text-ink-secondary"
              >
                MOQ (pieces)
              </label>
              <input
                id="s2-moq"
                type="number"
                min={0}
                value={moq}
                onChange={(e) => setMoq(e.target.value)}
                className="mt-1 w-full rounded-input border border-hairline bg-bg-l0 px-3 py-2 text-sm text-ink-primary focus:outline-none focus:ring-1 focus:ring-accent-indigo"
                placeholder="e.g. 500"
              />
            </div>
            <div>
              <label
                htmlFor="s2-lead"
                className="block text-xs font-medium text-ink-secondary"
              >
                Lead time (days, 0–{MAX_LEAD})
              </label>
              <input
                id="s2-lead"
                type="number"
                min={0}
                max={MAX_LEAD}
                value={lead}
                onChange={(e) => setLead(e.target.value)}
                className="mt-1 w-full rounded-input border border-hairline bg-bg-l0 px-3 py-2 text-sm text-ink-primary focus:outline-none focus:ring-1 focus:ring-accent-indigo"
                placeholder="e.g. 60"
              />
            </div>
          </FormGrid>

          <div>
            <span className="block text-xs font-medium text-ink-secondary">
              Capabilities (≤ {MAX_CAPS})
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {capabilities.map((c) => (
                <Tag key={c}>
                  <span>{c}</span>
                  <button
                    type="button"
                    onClick={() => removeCap(c)}
                    aria-label={`Remove ${c}`}
                    className="ml-1 text-ink-tertiary hover:text-sem-red"
                  >
                    ×
                  </button>
                </Tag>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={capDraft}
                onChange={(e) => setCapDraft(e.target.value)}
                onKeyDown={onCapKey}
                maxLength={MAX_CAP_LEN}
                className="flex-1 rounded-input border border-hairline bg-bg-l0 px-3 py-2 text-sm text-ink-primary focus:outline-none focus:ring-1 focus:ring-accent-indigo"
                placeholder="Add a capability (Enter to add)"
              />
              <Button type="button" variant="outline" size="sm" onClick={addCapability}>
                Add
              </Button>
            </div>
            <p className="mt-1 text-xs text-ink-tertiary">
              {capabilities.length}/{MAX_CAPS} · each ≤ {MAX_CAP_LEN} chars
            </p>
          </div>

          <FormGrid cols="profile">
            <div>
              <label
                htmlFor="s2-cname"
                className="block text-xs font-medium text-ink-secondary"
              >
                Contact name
              </label>
              <input
                id="s2-cname"
                type="text"
                maxLength={MAX_CONTACT_NAME}
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="mt-1 w-full rounded-input border border-hairline bg-bg-l0 px-3 py-2 text-sm text-ink-primary focus:outline-none focus:ring-1 focus:ring-accent-indigo"
              />
            </div>
            <div>
              <label
                htmlFor="s2-crole"
                className="block text-xs font-medium text-ink-secondary"
              >
                Contact role
              </label>
              <input
                id="s2-crole"
                type="text"
                maxLength={MAX_CONTACT_ROLE}
                value={contactRole}
                onChange={(e) => setContactRole(e.target.value)}
                className="mt-1 w-full rounded-input border border-hairline bg-bg-l0 px-3 py-2 text-sm text-ink-primary focus:outline-none focus:ring-1 focus:ring-accent-indigo"
              />
            </div>
            <div>
              <label
                htmlFor="s2-cemail"
                className="block text-xs font-medium text-ink-secondary"
              >
                Contact email
              </label>
              <input
                id="s2-cemail"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="mt-1 w-full rounded-input border border-hairline bg-bg-l0 px-3 py-2 text-sm text-ink-primary focus:outline-none focus:ring-1 focus:ring-accent-indigo"
              />
            </div>
            <div>
              <label
                htmlFor="s2-cphone"
                className="block text-xs font-medium text-ink-secondary"
              >
                Contact phone
              </label>
              <input
                id="s2-cphone"
                type="text"
                maxLength={MAX_CONTACT_PHONE}
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="mt-1 w-full rounded-input border border-hairline bg-bg-l0 px-3 py-2 text-sm text-ink-primary focus:outline-none focus:ring-1 focus:ring-accent-indigo"
              />
            </div>
          </FormGrid>

          {error ? <p className="text-xs text-sem-red">{error}</p> : null}
          {info ? <p className="text-xs text-sem-green">{info}</p> : null}

          <p className="text-xs text-ink-tertiary">
            Your edits never overwrite the register record above. Buyers see
            your supplier-attested values when the register does not publish
            the field; otherwise the register wins.
          </p>

          <StickyActionBar>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Saving…" : "Save profile"}
            </Button>
          </StickyActionBar>
        </form>
      </CardContent>
    </Card>
  );
}
