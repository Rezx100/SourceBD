// RFQ templates, out of React (Paper `10 · Settings · RFQ templates`): the questions every new RFQ asks
// and the message it opens with. The limits are the settings API's, which enforces them again. With
// nothing saved the page shows what the composer uses anyway (`DEFAULT_QUESTIONS`, `DEFAULT_TEMPLATE`
// from `components/rfqs/composer-model`), so it never describes defaults different from the ones an
// RFQ gets.

import { DEFAULT_QUESTIONS, DEFAULT_TEMPLATE, fillTemplate } from "@/components/rfqs/composer-model";
import type { InquiryDoc } from "./doc";

export { DEFAULT_QUESTIONS, DEFAULT_TEMPLATE };

export const MAX_QUESTIONS = 20;
export const MAX_QUESTION_CHARS = 200;
export const MAX_TEMPLATE = 4000;

/** What the "Insert fill-in" menu offers, Paper's names, and where each fact comes from. */
export const FILL_INS = [
  { token: "{{supplier}}", label: "Supplier name", from: "the supplier's name" },
  { token: "{{product}}", label: "Product", from: "the product line: title, quantity, target price and ship date" },
  { token: "{{user}}", label: "Your name", from: "your display name, from Profile" },
  { token: "{{company}}", label: "Your company", from: "your company name, from Company details" },
  { token: "{{website}}", label: "Your website", from: "your website, from Company details" },
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

/** The questions and message the page starts from: the buyer's own, else the composer's. An empty list is read as "use the defaults", so it is shown as them. */
export function startOf(initial: InquiryDoc | null): { questions: string[]; template: string } {
  return {
    questions: initial?.questions.length ? [...initial.questions] : [...DEFAULT_QUESTIONS],
    template: initial?.email_template ?? DEFAULT_TEMPLATE,
  };
}

/** `text` with `token` put where the caret is (or over the selection); the caret then sits after it. */
export function insertAt(text: string, start: number, end: number, token: string): { text: string; caret: number } {
  const a = Math.max(0, Math.min(start, text.length));
  const b = Math.max(a, Math.min(end, text.length));
  return { text: text.slice(0, a) + token + text.slice(b), caret: a + token.length };
}

export type Piece = { text: string; gap: boolean };

/**
 * The message as a supplier would read it, with the buyer's own facts filled in. A fact not yet filled
 * in stays in [brackets] (and is a `gap`), so the buyer sees it before the supplier does. The product
 * line is the one thing a template cannot know: it is the RFQ's, so it stays a bracket here too.
 */
export function previewOf(template: string, v: { supplier: string | null; user: string | null; company: string | null; website: string | null }): { pieces: Piece[]; gaps: string[] } {
  const { text, missing } = fillTemplate(template, { supplier: v.supplier?.trim() || "[Supplier name]", product: "[Product line from the RFQ]", user: v.user, company: v.company, website: v.website });
  const pieces: Piece[] = [];
  for (const part of text.split(/(\[[^\]\n]+\])/)) if (part) pieces.push({ text: part, gap: /^\[[^\]\n]+\]$/.test(part) });
  return { pieces, gaps: missing };
}

export const MESSAGE_SAVED = "Message saved";
export const QUESTIONS_SAVED = "Questions saved";
export const TEMPLATE_FAILED = "Could not save. Nothing was changed.";

const GAP_WORDS: Record<string, string> = {
  "your name": "your name in Profile",
  "company name": "your company name in Company details",
  website: "your website in Company details",
};

/** What the preview's footnote says: the gaps the buyer can close here, and that the product line is each RFQ's. */
export function gapWords(gaps: readonly string[]): string {
  const named = gaps.map((g) => GAP_WORDS[g] ?? g);
  const list = named.length < 2 ? (named[0] ?? "") : `${named.slice(0, -1).join(", ")} and ${named.at(-1)}`;
  const gapLine = named.length === 0 ? "Nothing of yours is missing." : `${named.length} ${named.length === 1 ? "gap" : "gaps"} to fill: ${list}.`;
  return `${gapLine} The product line comes from each RFQ.`;
}
