// The companies that handle data for SourceBD, in one list. The Security page prints it as a list and the Privacy
// notice (section 5) prints it as a sentence, so the two cannot name different companies (subprocessors.test.ts).
// Each line is true of the running product: Stripe is not here because nothing is billed yet (the beta is free, the
// webhook route returns "disabled", no checkout exists); add it the day a card is first taken.

export const SUBPROCESSORS: readonly (readonly [name: string, what: string])[] = [
  ["Supabase", "database and sign-in"],
  ["Cloudflare", "HTTPS and network"],
  ["Resend", "email"],
  ["Sentry", "error reports"],
  ["PostHog", "product analytics"],
  ["Bunny CDN", "copies of public source documents"],
  ["Barikoi", "maps"],
];

const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

/** "Seven" for the Security page's answer line. */
export const subprocessorCount = (): string => WORDS[SUBPROCESSORS.length] ?? String(SUBPROCESSORS.length);

/** "Supabase (database and sign-in), Cloudflare (HTTPS and network), ... and Barikoi (maps)" for the Privacy notice. */
export function subprocessorSentence(): string {
  const items = SUBPROCESSORS.map(([n, w]) => `${n} (${w})`);
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
