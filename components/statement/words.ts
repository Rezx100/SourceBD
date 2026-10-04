// The words of the Modern Slavery statement editor (B6c-2, Paper `10 · Modern slavery statement
// editor, 3 claims open`, `11 · Alerts · modern slavery statement`). The draft is the markdown
// `buildStatement` composes (`lib/msa-statement.ts`); this reads it into sections and claims: every
// `[Confirm: ...]` is a claim only the buyer can answer (dashed amber until it is answered, underlined
// once it is). A fill replaces the claim in the text that downloads, so a download holds no gap.
// Pure: no React, so the tests read exactly what the editor shows and the file holds.

import { countPlaceholders, draftNote, typed, STATEMENT_TITLE_LINE } from "@/lib/msa-statement";

const OPEN = "[Confirm:";

/**
 * What the buyer typed that a claim's text may repeat: a claim such as "what Example Apparel does" must
 * keep its answer when the organisation name is corrected, so a fill is stored under the claim with these
 * swapped for stable tokens.
 */
export type Subs = readonly (readonly [from: string, to: string])[];

/** The substitutions for the details as typed; an untyped detail is the words the draft puts in its place. */
export function subsOf(details: { org: string; year: string }): Subs {
  return [
    [typed(details.org) || "your organisation", "{org}"],
    [typed(details.year) || "the financial year", "{year}"],
  ];
}

/** The key a claim's fill is stored under: its text with the typed details swapped for tokens. */
export function claimKey(text: string, subs: Subs): string {
  return subs.reduce((t, [from, to]) => (from ? t.split(from).join(to) : t), text);
}

/** One piece of a paragraph: plain words, bold words, or a claim (open until it has a fill). */
export type Segment = { kind: "text"; text: string } | { kind: "bold"; text: string } | { kind: "claim"; claim: string; text: string; fill: string | null };

export type Block = { kind: "p"; segments: Segment[] } | { kind: "ul"; items: Segment[][] } | { kind: "quote"; segments: Segment[] };

export type Section = {
  id: string;
  /** "1" for "1. Organisation and supply chain structure"; null for the opening. */
  number: string | null;
  title: string;
  blocks: Block[];
};

/** A claim to confirm: what is asked, in a short line, and the section it sits in. */
export type Claim = {
  /** The key a fill is stored under: the claim's text with the typed details swapped for tokens. */
  key: string;
  /** The text inside `[Confirm: ...]` as it reads in the draft now. */
  text: string;
  /** "How many suppliers you ordered from": a short line for the rail. */
  label: string;
  sectionId: string;
  section: string;
  /** Which of the four details it is, when typing it in the details card answers it. */
  detail: DetailKey | null;
};

export type DetailKey = "org" | "year" | "signerName" | "signerRole";

/** The four placeholders the details card answers: the text `buildStatement` puts in the claim. */
const DETAIL_CLAIMS: Record<string, DetailKey> = {
  "organisation name": "org",
  "financial year": "year",
  "signatory name": "signerName",
  "signatory role": "signerRole",
};

export const DETAIL_LABELS: Record<DetailKey, string> = {
  org: "Organisation name",
  year: "Reporting financial year",
  signerName: "Signatory name",
  signerRole: "Signatory role",
};

/** A short line for the rail from a claim's long text: its first clause, cut at 80 characters. */
export function claimLabel(key: string): string {
  const detail = DETAIL_CLAIMS[key];
  if (detail) return DETAIL_LABELS[detail];
  const first = key.split(/(?<=[.:;])\s/)[0]!.replace(/[.:;]+$/, "").trim();
  const cut = first.length > 80 ? `${first.slice(0, 77).trimEnd()}...` : first;
  return cut.charAt(0).toUpperCase() + cut.slice(1);
}

function segmentsOf(line: string, fills: Readonly<Record<string, string>>, subs: Subs): Segment[] {
  const out: Segment[] = [];
  let rest = line;
  while (rest.length > 0) {
    const open = rest.indexOf(OPEN);
    const bold = rest.indexOf("**");
    if (open === -1 && bold === -1) {
      out.push({ kind: "text", text: rest });
      break;
    }
    if (open !== -1 && (bold === -1 || open < bold)) {
      if (open > 0) out.push({ kind: "text", text: rest.slice(0, open) });
      const close = rest.indexOf("]", open);
      const text = (close === -1 ? rest.slice(open + OPEN.length) : rest.slice(open + OPEN.length, close)).trim();
      const key = claimKey(text, subs);
      const fill = fills[key]?.trim() ? typed(fills[key]!) : null;
      out.push({ kind: "claim", claim: key, text, fill });
      rest = close === -1 ? "" : rest.slice(close + 1);
      continue;
    }
    const end = rest.indexOf("**", bold + 2);
    if (end === -1) {
      out.push({ kind: "text", text: rest });
      break;
    }
    if (bold > 0) out.push({ kind: "text", text: rest.slice(0, bold) });
    out.push({ kind: "bold", text: rest.slice(bold + 2, end) });
    rest = rest.slice(end + 2);
  }
  return out;
}

/**
 * The draft as sections of blocks, with each claim carrying its fill (null while open). The title line
 * and the DRAFT note are not drawn: the page has its own title and says how many claims are open.
 */
export function parseStatement(markdown: string, fills: Readonly<Record<string, string>> = {}, subs: Subs = []): Section[] {
  const sections: Section[] = [{ id: "s0", number: null, title: "Statement", blocks: [] }];
  const cur = () => sections[sections.length - 1]!;
  const paragraphs = markdown.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  for (const para of paragraphs) {
    if (para === STATEMENT_TITLE_LINE || para.startsWith("> DRAFT:")) continue;
    const h = /^##\s+(?:(\d+)\.\s+)?(.+)$/.exec(para);
    if (h) {
      sections.push({ id: `s${sections.length}`, number: h[1] ?? null, title: h[2]!.trim(), blocks: [] });
      continue;
    }
    const lines = para.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.every((l) => l.startsWith("- "))) {
      cur().blocks.push({ kind: "ul", items: lines.map((l) => segmentsOf(l.slice(2), fills, subs)) });
    } else {
      // A paragraph's own lines (Organisation / Financial year, Signed / Role / Date) stay lines of one block.
      cur().blocks.push({ kind: "p", segments: lines.flatMap((l, i) => (i === 0 ? segmentsOf(l, fills, subs) : [{ kind: "text" as const, text: "\n" }, ...segmentsOf(l, fills, subs)])) });
    }
  }
  return sections;
}

/** Every distinct claim in draft order, with the section it first appears in. */
export function claimsOf(sections: readonly Section[]): Claim[] {
  const seen = new Map<string, Claim>();
  const visit = (s: Section, segs: Segment[]) => {
    for (const seg of segs) {
      if (seg.kind === "claim" && !seen.has(seg.claim)) {
        seen.set(seg.claim, { key: seg.claim, text: seg.text, label: claimLabel(seg.text), sectionId: s.id, section: s.number ? `Section ${s.number} · ${s.title}` : s.title, detail: DETAIL_CLAIMS[seg.text] ?? null });
      }
    }
  };
  for (const s of sections)
    for (const b of s.blocks) {
      if (b.kind === "ul") b.items.forEach((i) => visit(s, i));
      else visit(s, b.segments);
    }
  return [...seen.values()];
}

/** The claims still open: those with no fill. */
export function openClaims(sections: readonly Section[]): Claim[] {
  const open = new Set<string>();
  const visit = (segs: Segment[]) => segs.forEach((g) => g.kind === "claim" && g.fill === null && open.add(g.claim));
  for (const s of sections)
    for (const b of s.blocks) {
      if (b.kind === "ul") b.items.forEach(visit);
      else visit(b.segments);
    }
  return claimsOf(sections).filter((c) => open.has(c.key));
}

/** How many claims are open in each section: the left list's "2 claims to confirm". */
export function openBySection(sections: readonly Section[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of openClaims(sections)) out[c.sectionId] = (out[c.sectionId] ?? 0) + 1;
  return out;
}

export const claimsToConfirm = (n: number) => `${n} ${n === 1 ? "claim" : "claims"} to confirm`;
export const downloadBlocked = (n: number) => `Confirm ${n} ${n === 1 ? "claim" : "claims"} to download.`;

/** The text that downloads or is copied: each answered claim replaced by its fill; a DRAFT note over what is still open. */
export function finalText(markdown: string, fills: Readonly<Record<string, string>>, subs: Subs = []): string {
  let out = markdown.replace(/\[Confirm:\s*([^\]]*)\]/g, (whole, raw: string) => {
    const f = fills[claimKey(raw.trim(), subs)];
    return f && f.trim() ? typed(f) : whole;
  });
  // The note counted the claims when the draft was built; it counts again over what is left.
  out = out.replace(/^> DRAFT:[^\n]*\n\n/m, "");
  const left = countPlaceholders(out);
  const [title, ...rest] = out.split("\n\n");
  return left > 0 ? `${title}\n\n${draftNote(left)}${rest.join("\n\n")}` : out;
}

/** The statement's file name from what the buyer typed: an empty year is left out, never guessed. */
export function fileName(org: string, year: string): string {
  const slug = [org.trim() || "msa-statement", year.trim()]
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug || "msa-statement"}.md`;
}
