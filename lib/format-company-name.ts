/** Legal suffixes and region codes that stay uppercase in display names. */
const UPPERCASE_TOKENS = new Set([
  "BD",
  "UK",
  "USA",
  "EU",
  "LLC",
  "PLC",
  "INC",
  "CO",
]);

function titleCaseWord(word: string): string {
  if (!word) return word;
  const upper = word.toUpperCase();
  if (UPPERCASE_TOKENS.has(upper)) return upper;

  // Preserve parenthetical region codes, e.g. "(BD)".
  const paren = word.match(/^(\()([A-Za-z]+)(\))$/);
  if (paren) {
    const inner = paren[2]!.toUpperCase();
    return UPPERCASE_TOKENS.has(inner)
      ? `(${inner})`
      : `(${inner.charAt(0)}${inner.slice(1).toLowerCase()})`;
  }

  if (word === word.toUpperCase() && word.length > 1) {
    return word.charAt(0) + word.slice(1).toLowerCase();
  }

  if (/^[A-Z]/.test(word) && /[a-z]/.test(word)) return word;

  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function splitToken(token: string): { word: string; trailing: string } {
  const match = token.match(/^(.+?)([.,;:]*)$/);
  if (!match) return { word: token, trailing: "" };
  return { word: match[1]!, trailing: match[2] ?? "" };
}

/** Normalise supplier legal names to consistent title case for UI display. */
export function formatCompanyName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  return trimmed
    .split(/\s+/)
    .map((token) => {
      const { word, trailing } = splitToken(token);
      return `${titleCaseWord(word)}${trailing}`;
    })
    .join(" ");
}
