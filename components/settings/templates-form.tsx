"use client";

// RFQ templates (Paper `10 · Settings · RFQ templates`): the message a new RFQ opens with, with an
// "Insert fill-in" menu, and the questions every new RFQ asks, reordered with the arrows or Alt and
// the arrow keys. A preview beside it shows the message as a supplier would read it, filled in with the
// buyer's own name, company and website and a saved supplier's name; what is not filled in stays in
// [brackets]. Two saves, one each: the API takes both fields in one call, so each section sends its
// own edit beside the OTHER section's last saved value, and saving the questions never saves a
// half-written message. Paper's drag handles are not drawn: nothing here drags.

import { ArrowDown, ArrowUp, CaretDown, X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, IconButton, Input, Menu, MenuItem } from "@/components/kit";
import { cn } from "@/lib/utils";
import type { InquiryDoc } from "./doc";
import { Flash, FormNote, textareaClass, useFlash } from "./form";
import { FILL_INS, MAX_QUESTIONS, MAX_QUESTION_CHARS, MAX_TEMPLATE, MESSAGE_SAVED, QUESTIONS_SAVED, TEMPLATE_FAILED, gapWords, inquiryPayload, insertAt, moveItem, previewOf, startOf } from "./templates";
import { browserFetch, postSettings } from "./transport";

export type PreviewFacts = { supplier: string | null; user: string | null; company: string | null; website: string | null };

export function TemplatesForm({ initial, facts }: { initial: InquiryDoc | null; facts: PreviewFacts }) {
  const router = useRouter();
  const [saved, setSaved] = useState(() => startOf(initial));
  const [questions, setQuestions] = useState<string[]>(saved.questions);
  const [template, setTemplate] = useState(saved.template);
  const [errors, setErrors] = useState<{ questions: string | null; template: string | null }>({ questions: null, template: null });
  const [saving, setSaving] = useState<"questions" | "template" | null>(null);
  const [flash, setFlash] = useFlash();
  const box = useRef<HTMLTextAreaElement>(null);
  const [focusRow, setFocusRow] = useState<number | null>(null);
  const rows = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (focusRow === null) return;
    rows.current[focusRow]?.focus();
    setFocusRow(null);
  }, [focusRow]);

  const templateChanged = template.trim() !== saved.template.trim();
  const questionsChanged = inquiryPayload(questions, "").questions.join("\n") !== saved.questions.join("\n");

  async function save(which: "questions" | "template", e?: FormEvent) {
    e?.preventDefault();
    if (saving) return;
    const body = which === "questions" ? inquiryPayload(questions, saved.template) : inquiryPayload(saved.questions, template);
    setErrors((x) => ({ ...x, [which]: null }));
    setFlash(null);
    setSaving(which);
    const r = await postSettings(body, TEMPLATE_FAILED, { fetch: browserFetch });
    setSaving(null);
    if (!r.ok) return setErrors((x) => ({ ...x, [which]: r.message }));
    const defaults = startOf(null);
    if (which === "questions") {
      const next = body.questions.length ? body.questions : defaults.questions;
      setSaved((s) => ({ ...s, questions: next }));
      setQuestions(next);
    } else {
      setSaved((s) => ({ ...s, template: body.email_template ?? defaults.template }));
    }
    setFlash(which === "questions" ? QUESTIONS_SAVED : MESSAGE_SAVED);
    router.refresh();
  }

  function insert(token: string) {
    const el = box.current;
    const { text, caret } = insertAt(template, el?.selectionStart ?? template.length, el?.selectionEnd ?? template.length, token);
    setTemplate(text);
    // The caret goes after what was put in, once React has drawn the new text and once the menu has
    // handed focus back to its button (it does that on the next turn, so a frame is not enough).
    setTimeout(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    }, 30);
  }

  const move = (i: number, by: -1 | 1) => {
    if (i + by < 0 || i + by >= questions.length) return;
    setQuestions((l) => moveItem(l, i, by));
    setFocusRow(i + by);
  };

  const view = previewOf(template, facts);

  return (
    <div className="flex gap-8 max-xl:flex-col">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <form aria-label="RFQ message" onSubmit={(e) => save("template", e)} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="rfq-message" className="text-sm font-medium text-ink-2">
              RFQ message
            </label>
            <Menu
              align="end"
              trigger={
                <Button iconRight={CaretDown} className="max-md:h-11">
                  Insert fill-in
                </Button>
              }
            >
              {FILL_INS.map((f) => (
                <MenuItem key={f.token} hint={f.token} onSelect={() => insert(f.token)}>
                  {f.label}
                </MenuItem>
              ))}
            </Menu>
          </div>
          <textarea id="rfq-message" ref={box} className={textareaClass} value={template} onChange={(e) => setTemplate(e.target.value)} maxLength={MAX_TEMPLATE} rows={13} />
          <p className="text-xs text-ink-3">Anything missing shows in [brackets], so you can fill it first.</p>
          <FormNote>{errors.template}</FormNote>
          <div className="flex justify-end">
            <Button kind="primary" type="submit" disabled={!templateChanged} loading={saving === "template"} loadingLabel="Saving" className="max-md:h-input-touch max-md:w-full">
              Save message
            </Button>
          </div>
        </form>

        <form aria-label="RFQ questions" onSubmit={(e) => save("questions", e)} className="flex flex-col gap-1.5">
          <h2 className="text-sm font-medium text-ink-2">RFQ questions</h2>
          <p className="text-xs text-ink-3">Questions every new RFQ asks, in this order. Up to {MAX_QUESTIONS}.</p>
          <ol className="flex flex-col rounded-md border border-line">
            {questions.map((q, i) => (
              <li key={i} className={cn("flex min-h-11 items-center gap-1.5 px-2 py-1", i < questions.length - 1 && "border-b border-line")}>
                <span aria-hidden className="w-5 shrink-0 text-right text-sm text-ink-3">
                  {i + 1}
                </span>
                <label htmlFor={`rfq-q-${i}`} className="sr-only">
                  Question {i + 1}
                </label>
                <Input
                  id={`rfq-q-${i}`}
                  ref={(el) => {
                    rows.current[i] = el;
                  }}
                  value={q}
                  maxLength={MAX_QUESTION_CHARS}
                  onChange={(e) => setQuestions((l) => l.map((x, j) => (j === i ? e.target.value : x)))}
                  onKeyDown={(e) => {
                    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                      e.preventDefault();
                      move(i, e.key === "ArrowUp" ? -1 : 1);
                    }
                  }}
                  className="min-w-0 flex-1 border-transparent hover:border-line-strong max-md:h-11"
                />
                <IconButton icon={ArrowUp} label={`Move question ${i + 1} up`} kind="quiet" size={32} disabled={i === 0} onClick={() => move(i, -1)} className="max-md:size-11" />
                <IconButton icon={ArrowDown} label={`Move question ${i + 1} down`} kind="quiet" size={32} disabled={i === questions.length - 1} onClick={() => move(i, 1)} className="max-md:size-11" />
                <IconButton icon={X} label={`Remove question ${i + 1}`} kind="quiet" size={32} onClick={() => setQuestions((l) => l.filter((_, j) => j !== i))} className="max-md:size-11" />
              </li>
            ))}
            {questions.length === 0 ? <li className="px-3 py-3 text-sm text-ink-3">No questions of your own: a new RFQ asks the five defaults.</li> : null}
          </ol>
          <div className="flex items-center justify-between gap-3">
            <Button
              kind="link"
              disabled={questions.length >= MAX_QUESTIONS}
              onClick={() => {
                setQuestions((l) => [...l, ""]);
                setFocusRow(questions.length);
              }}
              className="max-md:flex max-md:h-11 max-md:items-center"
            >
              Add question
            </Button>
            <span className="text-xs text-ink-3">Use the arrows, or Alt and the arrow keys, to reorder</span>
          </div>
          <FormNote>{errors.questions}</FormNote>
          <div className="flex justify-end">
            <Button kind="primary" type="submit" disabled={!questionsChanged} loading={saving === "questions"} loadingLabel="Saving" className="max-md:h-input-touch max-md:w-full">
              Save questions
            </Button>
          </div>
        </form>
      </div>

      <aside aria-label="Preview" className="flex w-[400px] shrink-0 flex-col gap-2 max-xl:w-auto">
        <h2 className="text-sm font-medium text-ink-2">{facts.supplier ? `Preview with ${facts.supplier}` : "Preview"}</h2>
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-subtle p-4">
          <p className="whitespace-pre-wrap text-base leading-[22px] text-ink [overflow-wrap:anywhere]">
            {view.pieces.map((p, i) =>
              p.gap ? (
                <span key={i} className="rounded-sm border border-dashed border-caution-icon bg-caution-tint px-1 font-medium text-caution">
                  {p.text}
                </span>
              ) : (
                <span key={i}>{p.text}</span>
              ),
            )}
          </p>
        </div>
        <p className="text-xs text-ink-3">{gapWords(view.gaps)}</p>
      </aside>
      <Flash text={flash} />
    </div>
  );
}
