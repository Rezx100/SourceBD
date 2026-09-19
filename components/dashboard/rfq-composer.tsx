// RFQComposer (REZ-A, handoff §3.6): a 1180px dialog over the results. Rail
// on canvas (steps with counts and a caution line naming what is missing) ·
// editor (template switch, Attach, Insert variable, the V2 Improve wording,
// subject + body with variable chips, the product table, the question list
// with REQUIRED stamps) · preview on `surface-sunken` as the supplier receives
// it. Send RFQ stays disabled until the required fields are filled; Save
// draft always works. Presentational in REZ-A; REZ-D wires the state.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button, Checkbox, V2Tag } from "./controls";
import { Icon } from "./icons";
import { SanctionBanner } from "./sheet";
import { Caption, Code, Label } from "./type";

export type RailStep = {
  label: string;
  detail: string;
  missing?: string | null;
  count?: string | null;
  active?: boolean;
  v2?: boolean;
};

export type VariableChip = { label: string; missing?: boolean };

export type ProductLine = { product: string; hs: string | null; quantity: string; targetPrice: string | null; shipBy: string | null };

export type QuestionRow = { text: string; on: boolean; required: boolean };

/**
 * A target of this draft. `rfq_create` refuses a sanctioned supplier
 * (handoff §4.5), and §3.6 says Send stays disabled until every supplier is
 * published and not sanctioned — so the composer has to carry the flag, not
 * just the name.
 */
export type ComposerTarget = { name: string; sanctioned: boolean; sanctionSample?: boolean };

export type RfqComposerModel = {
  title: string;
  /** "to Aboni Knitwear Ltd · first contact · HS 6105" */
  context: string;
  /** Every supplier this draft would go to. */
  targets: ComposerTarget[];
  draftSaved: string | null;
  steps: RailStep[];
  template: "first" | "repeat";
  subject: (string | VariableChip)[];
  body: (string | VariableChip | "br")[][];
  products: ProductLine[];
  questions: QuestionRow[];
  moreQuestions: { count: number; required: number } | null;
  preview: {
    from: string;
    subject: ReactNode;
    paragraphs: ReactNode[];
    footer: string;
  };
  missing: string[];
};

export function Dialog({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="dialog"
      aria-label={label}
      aria-modal="true"
      className="absolute left-1/2 top-10 flex w-[1180px] -translate-x-1/2 flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-lg"
    >
      {children}
    </div>
  );
}

/** `.var`: a variable chip inside the subject or body; a missing one is caution-tinted. */
export function Variable({ label, missing = false }: VariableChip) {
  return (
    <span
      data-missing={missing ? "true" : undefined}
      className={cn(
        "inline-flex h-[22px] items-center whitespace-nowrap rounded-xs px-1.5 align-baseline text-sm font-medium",
        missing ? "bg-caution-tint text-caution-ink" : "bg-brand-tint text-brand-ink",
      )}
    >
      {label}
    </span>
  );
}

function Runs({ runs }: { runs: readonly (string | VariableChip | "br")[] }) {
  return (
    <>
      {runs.map((r, i) =>
        r === "br" ? <br key={i} /> : typeof r === "string" ? <span key={i}>{r}</span> : <Variable key={i} {...r} />,
      )}
    </>
  );
}

/** A flagged gap in the preview: "⚠ date missing". */
export function MissingFlag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 font-medium text-caution-ink">
      <Icon name="warn" small /> {children}
    </span>
  );
}

/** `aiEnabled` false (AI off or no key): every V2 surface is not rendered — not disabled, absent (handoff §7). */
export function RfqComposer({ model, aiEnabled = false }: { model: RfqComposerModel; aiEnabled?: boolean }) {
  const required = model.questions.filter((q) => q.required).length + (model.moreQuestions?.required ?? 0);
  const total = model.questions.length + (model.moreQuestions?.count ?? 0);
  const steps = aiEnabled ? model.steps : model.steps.filter((s) => !s.v2);
  const sanctioned = model.targets.filter((t) => t.sanctioned);
  const sanctionSample = sanctioned.length > 0 && sanctioned.every((t) => t.sanctionSample);
  // Send is refused for a sanctioned target whatever else is filled in, and the
  // server refuses it too (`rfq_create`, handoff §4.5).
  const blocked = sanctioned.length > 0 || model.missing.length > 0;
  return (
    <Dialog label={model.title}>
      <div className="flex h-[52px] items-center gap-3 border-b border-line-subtle px-5">
        <Label className="text-ink-strong">{model.title}</Label>
        <Caption>{model.context}</Caption>
        <span className="ml-auto flex items-center gap-2">
          {model.draftSaved ? <Caption>Draft saved {model.draftSaved}</Caption> : null}
          <Button variant="ghost" icon aria-label="Close">
            <Icon name="x" />
          </Button>
        </span>
      </div>
      {sanctioned.length > 0 ? (
        <>
          <SanctionBanner sample={sanctionSample} />
          <div className="border-b border-line-subtle px-5 py-2 text-sm text-sanction-ink">
            {sanctioned.length === 1 ? "This supplier is" : `${sanctioned.length} of these suppliers are`} on a sanctions
            screen: {sanctioned.map((t) => t.name).join(", ")}. Remove {sanctioned.length === 1 ? "it" : "them"} to send
            this RFQ.
          </div>
        </>
      ) : null}
      <div className="grid min-h-0 grid-cols-[250px_1fr_330px]">
        <nav aria-label="RFQ steps" className="flex min-w-0 flex-col gap-0.5 border-r border-line-subtle bg-canvas p-3">
          {steps.map((s) => (
            <a
              key={s.label}
              href={`#${s.label.toLowerCase().replace(/\s+/g, "-")}`}
              aria-current={s.active ? "step" : undefined}
              className={cn(
                "flex items-start gap-2 rounded-sm px-2.5 py-2 text-ink",
                s.active && "bg-surface ring-1 ring-inset ring-line",
                s.v2 && "text-smart",
              )}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <Label className={cn("inline-flex items-center gap-1.5", s.v2 ? "text-smart" : "text-ink-strong")}>
                  {s.label}
                  {s.v2 ? <V2Tag /> : null}
                </Label>
                <Caption>{s.detail}</Caption>
                {s.missing ? <Caption className="text-caution-ink">{s.missing}</Caption> : null}
              </span>
              {s.count ? <span className="pt-[3px] font-mono text-[11px] text-ink-subtle">{s.count}</span> : null}
            </a>
          ))}
        </nav>
        <div className="flex min-w-0 flex-col gap-4 border-r border-line-subtle p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span role="group" aria-label="Template" className="inline-flex h-control shrink-0 overflow-hidden rounded-sm border border-line">
              {(["first", "repeat"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={model.template === t}
                  className={cn(
                    "whitespace-nowrap px-3 text-sm font-medium text-ink-muted",
                    model.template === t && "bg-surface-sunken text-ink-strong",
                  )}
                >
                  {t === "first" ? "First contact" : "Repeat supplier"}
                </button>
              ))}
            </span>
            <span className="flex flex-wrap items-center justify-end gap-1">
              <Button variant="ghost">
                <Icon name="paperclip" /> Attach
              </Button>
              <Button variant="ghost">
                <Icon name="plus" /> Insert variable
              </Button>
              {aiEnabled ? (
                <Button variant="ghost" className="text-smart">
                  <Icon name="sparkle" /> Improve wording <V2Tag />
                </Button>
              ) : null}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink-muted">Subject</span>
            <div className="flex min-h-control flex-wrap items-center gap-1 rounded-sm border border-line-strong bg-surface px-2.5 py-[5px] text-base leading-5 text-ink">
              <Runs runs={model.subject} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink-muted">Message</span>
            <div className="min-h-[120px] rounded-sm border border-line-strong bg-surface px-2.5 py-2 text-base leading-[22px] text-ink">
              {model.body.map((para, i) => (
                <p key={i} className={cn("m-0", i > 0 && "mt-[22px]")}>
                  <Runs runs={para} />
                </p>
              ))}
            </div>
          </div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {["Product", "HS", "Quantity", "Target price", "Ship by"].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="border-b border-line-subtle px-2 py-1.5 text-left font-mono text-eyebrow font-medium uppercase text-ink-subtle"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {model.products.map((p, i) => (
                <tr key={i}>
                  <td className="border-b border-line-subtle px-2 py-1.5">{p.product}</td>
                  <td className="border-b border-line-subtle px-2 py-1.5">{p.hs ? <Code>{p.hs}</Code> : <span className="text-caution-ink">Missing</span>}</td>
                  <td className="border-b border-line-subtle px-2 py-1.5">{p.quantity}</td>
                  <td className={cn("border-b border-line-subtle px-2 py-1.5", !p.targetPrice && "text-caution-ink")}>{p.targetPrice ?? "Missing"}</td>
                  <td className={cn("border-b border-line-subtle px-2 py-1.5", !p.shipBy && "text-caution-ink")}>{p.shipBy ?? "Missing"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink-muted">
              Questions · {total}, {required} required
            </span>
            <div className="flex flex-col">
              {model.questions.map((q) => (
                <div key={q.text} className="flex min-h-7 items-center gap-2 border-t border-line-subtle py-[3px] text-sm first:border-t-0">
                  <Checkbox on={q.on} label={q.text} />
                  {q.text}
                  {q.required ? <span className="ml-auto font-mono text-[10px] text-caution-ink">REQUIRED</span> : null}
                </div>
              ))}
              {model.moreQuestions ? (
                <div className="flex min-h-7 items-center border-t border-line-subtle py-[3px]">
                  <Caption>
                    +{model.moreQuestions.count} more · {model.moreQuestions.required} required
                  </Caption>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-3 bg-surface-sunken p-5 text-sm">
          <div className="flex items-center gap-2">
            <Label className="text-ink-strong">As the supplier receives it</Label>
            <Caption className="ml-auto">via SourceBD Messages</Caption>
          </div>
          <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-4 text-ink">
            <Caption>{model.preview.from}</Caption>
            <Label className="text-ink-strong">{model.preview.subject}</Label>
            {model.preview.paragraphs.map((p, i) => (
              <span key={i}>{p}</span>
            ))}
            <Caption>{model.preview.footer}</Caption>
          </div>
          {/* No delivery promise: an unclaimed supplier is not reached until
              REZ-D ships behind RFQ_EMAIL_UNCLAIMED (handoff §4.6), and the
              RPC does not say whether this record has been claimed. */}
          <Caption>Your email and phone are not shared. The supplier&apos;s contact details stay on their record.</Caption>
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-line-subtle px-5 py-3">
        <Caption className={cn("inline-flex flex-1 items-center gap-1", sanctioned.length > 0 && "text-sanction-ink")}>
          {sanctioned.length > 0 ? (
            <>
              <Icon name="warn" small /> RFQs cannot be sent to a sanctioned supplier
            </>
          ) : model.missing.length > 0 ? (
            <>
              <Icon name="warn" small /> {model.missing.length} {model.missing.length === 1 ? "field" : "fields"} missing —{" "}
              {model.missing.join(", ")}
            </>
          ) : (
            "Every required field is filled"
          )}
        </Caption>
        <Button>Save draft</Button>
        <Button variant="primary" disabled={blocked}>
          <Icon name="send" /> Send RFQ
        </Button>
      </div>
    </Dialog>
  );
}
