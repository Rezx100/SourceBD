"use client";

// SettingsInquiryForm — the RFQ defaults (Settings · Inquiry): the questions a
// new RFQ asks and the message it opens with. Reads `settings_get().inquiry`
// and posts `{action:'update_inquiry', questions, email_template}` to
// /api/v1/settings. With nothing saved, it shows what the composer uses
// anyway (`DEFAULT_QUESTIONS`, `DEFAULT_TEMPLATE`), so the page never
// describes defaults different from the ones an RFQ gets.
//
// Two sections, each with its own Save. One API call carries both fields, so
// each section sends its own edit beside the OTHER section's last saved
// value: saving the questions never saves a half-written template.

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { useContext, useId, useState, useTransition } from "react";

import { Button } from "@/components/dashboard/controls";
import { Field, TextArea, TextInput } from "@/components/dashboard/fields";
import { Icon } from "@/components/dashboard/icons";
import { PageSection } from "@/components/dashboard/page";
import { DEFAULT_QUESTIONS, DEFAULT_TEMPLATE } from "@/components/dashboard/rfq-composer";
import { FormActions, FormError, type InquiryDoc } from "@/components/dashboard/settings";
import { Code } from "@/components/dashboard/type";
import { useFlash } from "@/components/dashboard/use-flash";

export const MAX_QUESTIONS = 20;
export const MAX_QUESTION_CHARS = 200;
const MAX_TEMPLATE = 4000;

/** The variables a template may use, and what each becomes. */
export const TEMPLATE_VARIABLES = [
  ["{{supplier}}", "the supplier's name"],
  ["{{product}}", "the product line: title, quantity, target price and ship date"],
  ["{{user}}", "your display name, from Profile"],
  ["{{company}}", "your company name, from Workspace"],
  ["{{website}}", "your website, from Workspace"],
] as const;

/** The body the settings API takes: blank questions dropped, each cut to 200 characters, at most 20; an empty template as null. */
export function inquiryPayload(questions: readonly string[], template: string) {
  return {
    action: "update_inquiry" as const,
    questions: questions
      .map((q) => q.trim().slice(0, MAX_QUESTION_CHARS))
      .filter(Boolean)
      .slice(0, MAX_QUESTIONS),
    email_template: template.trim() || null,
  };
}

/** `list` with item `i` moved one place up (-1) or down (+1); unchanged at either end. */
export function moveItem<T>(list: readonly T[], i: number, by: -1 | 1): T[] {
  const j = i + by;
  if (j < 0 || j >= list.length) return [...list];
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

export function SettingsInquiryForm({ initial }: { initial: InquiryDoc | null }) {
  // Not `useRouter()`, which throws outside a mounted app router (the route tests draw this with none).
  const router = useContext(AppRouterContext);
  const id = useId();
  // An empty list is what the composer reads as "use the defaults", so it is shown as them.
  const startQuestions = initial?.questions.length ? initial.questions : [...DEFAULT_QUESTIONS];
  const startTemplate = initial?.email_template ?? DEFAULT_TEMPLATE;
  const [saved, setSaved] = useState({ questions: startQuestions, template: startTemplate });
  const [questions, setQuestions] = useState<string[]>(startQuestions);
  const [template, setTemplate] = useState(startTemplate);
  const [errors, setErrors] = useState<{ questions: string | null; template: string | null }>({ questions: null, template: null });
  const [flash, setFlash] = useFlash();
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState<"questions" | "template" | null>(null);

  function save(which: "questions" | "template") {
    const body = which === "questions" ? inquiryPayload(questions, saved.template) : inquiryPayload(saved.questions, template);
    setErrors((e) => ({ ...e, [which]: null }));
    setFlash(null);
    setSaving(which);
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/settings", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const detail = (await res.json().catch(() => null)) as { error?: string } | null;
          setErrors((e) => ({ ...e, [which]: detail?.error ?? `Could not save (${res.status}). Nothing was changed.` }));
          return;
        }
        setSaved((s) => (which === "questions" ? { ...s, questions: body.questions } : { ...s, template: body.email_template ?? DEFAULT_TEMPLATE }));
        if (which === "questions") setQuestions(body.questions.length ? body.questions : [...DEFAULT_QUESTIONS]);
        setFlash(which === "questions" ? "Questions saved" : "Email template saved");
        router?.refresh();
      } catch {
        setErrors((e) => ({ ...e, [which]: "Could not reach SourceBD. Nothing was changed; try again." }));
      } finally {
        setSaving(null);
      }
    });
  }

  return (
    <>
      <PageSection title="Question template" caption={`The questions every new RFQ asks, in this order. Up to ${MAX_QUESTIONS}.`}>
        <form
          aria-label="Question template"
          onSubmit={(e) => {
            e.preventDefault();
            save("questions");
          }}
        >
          <ol className="m-0 flex list-none flex-col gap-2 p-4">
            {questions.map((q, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <span aria-hidden className="w-5 shrink-0 text-right font-mono text-xs text-ink-subtle">
                  {i + 1}
                </span>
                <label htmlFor={`${id}-q${i}`} className="sr-only">
                  Question {i + 1}
                </label>
                <TextInput
                  id={`${id}-q${i}`}
                  value={q}
                  maxLength={MAX_QUESTION_CHARS}
                  onChange={(e) => setQuestions((list) => list.map((x, j) => (j === i ? e.target.value : x)))}
                />
                <Button variant="ghost" size="sm" icon aria-label={`Move question ${i + 1} up`} disabled={i === 0} onClick={() => setQuestions((l) => moveItem(l, i, -1))}>
                  <Icon name="caret" className="rotate-180" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon
                  aria-label={`Move question ${i + 1} down`}
                  disabled={i === questions.length - 1}
                  onClick={() => setQuestions((l) => moveItem(l, i, 1))}
                >
                  <Icon name="caret" />
                </Button>
                <Button variant="ghost" size="sm" icon aria-label={`Remove question ${i + 1}`} onClick={() => setQuestions((l) => l.filter((_, j) => j !== i))}>
                  <Icon name="x" />
                </Button>
              </li>
            ))}
            {questions.length === 0 ? <li className="text-sm text-ink-muted">No questions of your own: a new RFQ asks the five defaults.</li> : null}
            <li>
              <Button variant="ghost" size="sm" disabled={questions.length >= MAX_QUESTIONS} onClick={() => setQuestions((l) => [...l, ""])}>
                <Icon name="plus" /> Add question
              </Button>
            </li>
          </ol>
          {errors.questions ? (
            <div className="px-4 pb-3">
              <FormError>{errors.questions}</FormError>
            </div>
          ) : null}
          <FormActions pending={saving === "questions"} label="Save questions" flash={flash} />
        </form>
      </PageSection>

      <PageSection title="Email template" caption="The message a new RFQ opens with. You can still edit it on each RFQ.">
        <form
          aria-label="Email template"
          onSubmit={(e) => {
            e.preventDefault();
            save("template");
          }}
        >
          <div className="flex flex-col gap-3 p-4">
            <Field label="Message" htmlFor={`${id}-template`}>
              <TextArea id={`${id}-template`} value={template} onChange={(e) => setTemplate(e.target.value)} maxLength={MAX_TEMPLATE} rows={10} />
            </Field>
            <div className="flex flex-col gap-1.5">
              <p className="m-0 text-sm font-medium text-ink-strong">Variables</p>
              <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
                {TEMPLATE_VARIABLES.map(([name, what]) => (
                  <div key={name} className="contents">
                    <dt>
                      <Code className="text-ink-strong">{name}</Code>
                    </dt>
                    <dd className="m-0 text-ink-muted">{what}</dd>
                  </div>
                ))}
              </dl>
              <p className="m-0 text-xs text-ink-subtle">A fact you have not filled in shows in brackets on the RFQ, so you see the gap before the supplier does.</p>
            </div>
            <FormError>{errors.template}</FormError>
          </div>
          <FormActions pending={saving === "template"} label="Save template" flash={null} />
        </form>
      </PageSection>
    </>
  );
}
