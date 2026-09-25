// Contact details filed inside free text.
//
// The registers do not keep an address clean. Of the published records, 25
// file an address that carries a phone number, an e-mail or a website —
// "…Baridhara DOHS, Dhaka, 9125191 Tel: 01732476815" — and five of those print
// the exact number held in the gated `phones` column (live SQL, 25 Sep 2026).
// Contact details are sign-in gated and, on the buyer record, shown as counts
// only; an address that carries them verbatim defeats both. So every surface
// that prints a filed address passes it through here first.
//
// What counts as contact detail, from the real rows:
// - an e-mail address, a URL (`www.…`, `http…`), or whatever follows a Web or
//   Email label;
// - an international number, `+880 1700 000000`;
// - a number after a contact label — Tel, Phone, Pho, Mobile, Cell, Fax —
//   including lists ("TEL: 741872, 741889, 741890");
// - a bare number whose longest unbroken run of digits is six or more
//   ("9125191", "01730-014933", "8715141-2"). Addresses number their plots,
//   holdings and postcodes in runs of five or fewer ("18926-18930",
//   "B-164-165-166", "Dhaka-1000"), so those stay;
// - the label left behind once its value is gone ("Web:", "Email:").
// Words that merely begin like a label — Telihati, Telecom, Telirchala — are
// not labels: every label match is a whole word.

const LABEL = String.raw`\b(?:tel|tele|telephone|phone|pho|ph|mobile|mob|cell|fax|e-?mail|web|website)\b`;

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/gi;
const URL = /\b(?:https?:\/\/|www\.)[^\s,;]+/gi;
const LABELLED_TEXT = /\b(?:e-?mail|web|website)\b[ \t]*[:.]?[ \t]*[^\s,;]+/gi;
const INTERNATIONAL = /\+\d[\d \t\-()]{6,}\d/g;
const LABELLED_NUMBER = new RegExp(String.raw`${LABEL}[ \t]*[:.]?[ \t]*\+?\d[\d \t\-()/.,]*\d`, "gi");
const BARE_NUMBER = /(^|[\s,;:(])(\+?[\d\-()]*\d{6,}[\d\-()]*)(?=$|[\s,;.)])/g;
const DANGLING_LABEL = new RegExp(String.raw`${LABEL}\s*[:.]?\s*(?=$|[,;\n])`, "gim");

/** `text` with every contact detail removed; unchanged when it carries none. */
export function withoutContactDetails(text: string): string;
export function withoutContactDetails(text: string | null | undefined): string | null;
export function withoutContactDetails(text: string | null | undefined): string | null {
  if (text == null) return null;
  const cut = text
    .replace(EMAIL, " ")
    .replace(URL, " ")
    .replace(LABELLED_NUMBER, " ")
    .replace(LABELLED_TEXT, " ")
    .replace(INTERNATIONAL, " ")
    .replace(BARE_NUMBER, "$1 ")
    .replace(DANGLING_LABEL, " ");
  // A clean address comes back byte for byte: the premises matcher and the
  // register attribution both compare these strings.
  if (cut === text) return text;
  return cut
    .split("\n")
    .map((line) =>
      line
        .replace(/[ \t]+/g, " ")
        .replace(/\s*,(?:\s*,)+/g, ",")
        .replace(/ +,/g, ",")
        .replace(/^[\s,;:]+|[\s,;:]+$/g, ""),
    )
    .filter((line) => line !== "")
    .join("\n");
}
