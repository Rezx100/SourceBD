// Contact details filed inside free text.
//
// The registers do not keep an address clean. Of the published records, a few
// dozen file an address that carries a phone number, an e-mail, a website or a
// named person — "…Baridhara DOHS, Dhaka, 9125191 Tel: 01732476815", "…,
// Bangladesh, Your contact:  Jahidul Islam", "Mohd. Abid Hossain Belal,
// Proprietor" — and five of those print the exact number held in the gated
// `phones` column (live SQL, 25 Sep 2026). One record files its website as its
// only principal product. Contact details are sign-in gated and, on the buyer
// record, shown as counts only; free text that carries them verbatim defeats
// both. So the buyer record, card, table row and line sheet pass every filed
// address and product entry through here (`build-models.ts`,
// `withoutFiledContact`). The anonymous public profile does not yet — that is
// its own issue. `ops/verify_contact_text.py` runs this over every published
// text and checks the gated values against what comes out.
//
// What counts as contact detail, from the real rows and the audits' probes:
// - an e-mail address, including "info @ abc.com", "info [at] abc.com" and
//   "abc(at)gmail(dot)com";
// - a URL (`www.…`, `http…`), whatever follows a "Web:", "Email:" or "Skype:"
//   label, or a bare domain ("chikleetrims.com/") — but not a company name
//   that is one ("New Apparel.com Limited");
// - a Bangladeshi mobile number however it is grouped — "01711528388",
//   "0171 152 8388", "01711-52-83-88", "01711 - 528388", "(01711) 528388",
//   "+880 1711 528388" — including slash-separated pairs;
// - an international number, `+44 20 7946 0958`;
// - a number after a contact label — Tel, Phone, Pho, Ph, Mobile, Mob, Cell,
//   Fax, Hotline, Contact, PABX, WhatsApp, Viber, IMO, and "T:"/"M:"/"F:" —
//   with "No"/"#" and ":"/"-"/"#" separators ("Tel No: 912 5191",
//   "Mob-01711528388", "Tel/Fax: (02) 9898989"), including lists; the number
//   must carry six or more digits, so "Ph. 12" (a phase) is not a phone;
// - a bare number with an unbroken run of seven or more digits ("9125191",
//   "8715141-2"), or one that starts with 0 and runs six or more
//   ("018-238019", "011029958"). Plots, holdings and postcodes run six or
//   fewer and do not start with 0 ("Plot # 110072", "314102", "Dhaka-1000"),
//   and a number straight after an address label (Plot, Holding, House…) is
//   never a phone. A product entry skips this rule: "Knit T-shirt 61091000"
//   carries an HS code, not a phone;
// - a named contact: "Your contact: <name>", "Contact person: …", "Attn: …",
//   "C/O …", "CEO: …"; a role (Proprietor, Managing Director) and the name
//   filed with it — the part that opens the address, a comma part that is an
//   honorific and a name ("Md. Moniruzzaman Monir"), and in a text that names
//   a role, a name written with an initial ("Sorder M. Nur-Uz-Zaman");
// - the label left behind once its value is gone ("Web:", "Email:").
// Words that merely begin like a label — Telihati, Telecom, Web Tower, Email
// Road, Chairman Bari, Md. Ali Mansion is not one — are not contact details:
// labels are whole words, and a label only goes when its value did.
//
// Not covered, by decision: an unlabelled Dhaka landline split 3-4
// ("912-5191") reads exactly like a plot range, and no published text holds
// one today; a labelled one is covered.

const ONE_LABEL = String.raw`\b(?:tel|tele|telephone|phone|pho|ph|mobile|mob|cell|fax|hotline|contact|pabx|call|whatsapp|viber|imo|e-?mail|web|website)\b`;
// "Tel/Fax:" is one label.
const LABEL = String.raw`${ONE_LABEL}(?:[ \t]*\/[ \t]*${ONE_LABEL})*`;
const LABEL_TAIL = String.raw`(?:[ \t]*(?:no|number|#)\.?)?[ \t]*[:.#\-]?[ \t]*`;
const ADDRESS_LABEL = String.raw`\b(?:plot|holding|house|h|road|rd|block|sector|sec|flat|apt|reg|khatian|dag|mouza|ward|no)\b\.?[ \t]*[#:\-]?[ \t]*`;
// Between the digits of one mobile number: a space, dot, dash (any), or parenthesis — up to three of them.
const SEP = String.raw`[ \t.\-–—()]{0,3}`;

const EMAIL = /[\w.+-]+\s*(?:@|[[(]\s*at\s*[\])])\s*[\w-]+(?:(?:\.|\s*[[(]\s*dot\s*[\])]\s*)[\w-]+)+/gi;
const SPELLED_EMAIL = /\b[\w.+-]+\s+at\s+[\w-]+\s+dot\s+[a-z]{2,}\b/gi;
const URL = /\b(?:https?:\/\/|www\.)[^\s,;]+/gi;
// Whatever follows "Web:"/"Email:"/"Skype:" when it holds a dot, whatever its
// domain ends in; "Web Tower" and "Email Road" have no colon and stay.
const LABELLED_TEXT = /\b(?:e-?mail|web|website|skype)\b[ \t]*:[ \t]*[^\s,;]*\.[^\s,;]+/gi;
const DOMAIN = /\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*\.(?:com|net|org|info|biz|co|bd|cn|hk|in|uk|de|io|asia|shop|store|online|xyz)(?:\.[a-z]{2})?\b(?!\s+(?:limited|ltd)\b)\/?[^\s,;]*/gi;
const MOBILE = new RegExp(String.raw`(?<![\d+])(?:\+?[ \t]?88${SEP})?\(?0${SEP}1${SEP}[3-9](?:${SEP}\d){8}(?!\d)\)?`, "g");
const INTERNATIONAL = /\+\d[\d \t\-()]{6,}\d/g;
const LABELLED_NUMBER = new RegExp(String.raw`(?:${LABEL}|\b[TMF]\b(?=[ \t]*:))${LABEL_TAIL}\+?\(?\d[\d \t\-()/.,]*\d`, "gi");
const BARE_NUMBER = new RegExp(String.raw`(?<!${ADDRESS_LABEL})(?<=^|[\s,;:(/])\+?[\d\-()]*\d[\d\-()]*(?=$|[\s,;.)/])`, "gi");
const ADDRESS_WORD = /\b(?:road|rd|street|avenue|lane|bari|market|plaza|tower|bhaban|bhabon|house|mansion|building|para|nagar|bazar|sarak|sarani|mor|villa|complex|centre|center|park|industrial|university|college|school|mosque|hospital|zone|epz|section|sector|area|estate|colony|union|village|upazila|thana)\b/i;
// A label names a person when a colon or a dash follows it: "CEO: X",
// "Owner - X", "Proprietor-Md Karim". The one exception is a compound place:
// a bare hyphen followed by place words only, to the end of the part
// ("Chairman-Bari, …", "Chairman-Bari Road"). A place word is also a name
// ("Proprietor - Bari Ahmed", "Chairman-Road Karim"), so it is not enough that
// one follows the dash.
const NAME_LABEL = new RegExp(
  String.raw`(?:\b(?:your contact|contact person)\b[ \t]*:?|\bcontact(?:[ \t]+name)?[ \t]*:|\b(?:attn|attention|ceo|general manager|gm|director|chairman|owner|proprietor|managing director|md|m\.d)\b\.?(?:[ \t]*:|[ \t]+[-–—]|[-–—](?!${ADDRESS_WORD.source}(?:[ \t]*(?:${ADDRESS_WORD.source}|no\.?|#|\d\w*))*[ \t]*(?:[,\n]|$))))[^,\n]*|\bc\/o\b[^,\n]*`,
  "gi",
);
// "Karim Uddin - Proprietor", "Karim Uddin (MD)": a name with its role beside it.
// "…- Owner" (no space before the dash), "… (MD)." (a full stop after),
// "(M.D.)", "(Chairman & MD)", and a part ended by ";" too.
const PLAIN_ROLE = String.raw`(?:proprietor|managing director|owner|ceo|chairman|director|general manager|gm)`;
const ROLE_WORD = String.raw`(?:${PLAIN_ROLE}|m\.?d\.?)`;
const ROLES = String.raw`${ROLE_WORD}(?:[ \t]*&[ \t]*${ROLE_WORD})*`;
const DASH = String.raw`[ \t]*[-–—][ \t]*`;
const STOP = String.raw`(?:[ \t]*\.(?=[ \t]*[^\s,;.])|(?=[ \t]*(?:[,;.]|$)))`;
// Where a full stop after the role ends the name's part:
//  - after a CLOSED bracket, always: "Abdul Karim (MD). Plot 5" (cycle 11);
//  - after a role that is no honorific, always: "Karim Uddin - Proprietor. House 5";
//  - otherwise only when nothing follows on the line — "Md." opens place names:
//    "(Md. Ali Tower)", "- Md. Ali Mansion" (cycle 10). "Abdul Karim - MD.
//    Mirpur" is the one shape left to the population guard's review.
const NAME_WITH_ROLE = new RegExp(
  // The first two take the full stop with them when text follows it, so the
  // rest of the line reads on: "Abdul Karim (MD). Plot 5" → "Plot 5".
  String.raw`[^,;\n]*?(?:[ \t]*\(${ROLES}\)${STOP}|${DASH}${PLAIN_ROLE}(?:[ \t]*&[ \t]*${ROLE_WORD})*${STOP}|(?:${DASH}|[ \t]*\()${ROLES}\)?(?=[ \t]*(?:[,;]|\.[ \t]*$|$)))`,
  "gim",
);
const ROLE = /\b(?:managing director|proprietor)\b/gi;
const NAMES_A_ROLE = /\b(?:managing director|proprietor|your contact|contact person)\b/i;
// "Sorder M. Nur-Uz-Zaman": capitalised words around an initial.
const INITIALLED_NAME = /\b[A-Z][a-z]+(?: [A-Z]\.)+ [A-Z][\w-]+/g;
const DANGLING_LABEL = new RegExp(String.raw`${LABEL}(?:[ \t]*(?:no|number|#)\.?)?[ \t]*[:.#\-][ \t]*(?=$|[,;\n])`, "gim");

const HONORIFIC_NAME = /^\s*(?:md|mohd|mohammad|mr|mrs|ms|engr)\.?\s+[a-z][a-z .'\-]*$/i;
const STANDALONE_ROLE = /^\s*(?:managing director|proprietor|chairman|director|ceo|owner|md)\s*$/i;

function digitsOf(s: string): number {
  return s.replace(/\D/g, "").length;
}

/** A labelled number is a phone only when it carries six or more digits. */
function labelledNumber(match: string): string {
  return digitsOf(match.replace(new RegExp(LABEL, "i"), "")) >= 6 ? " " : match;
}

/** A bare number is a phone when it runs seven unbroken digits, or six from a leading 0. */
/**
 * A name with its role beside it ("Karim Uddin (MD)"). The match runs back to
 * the last comma, so it can open with a place: "House 5 Road 3 Md Karim (MD)".
 * Only the run of house/plot/road numbers that OPENS the stretch stays;
 * everything from the first other word on goes. Address words do not mark a
 * place here — they are names too ("Abdul Bari", "Rokeya Nagar"; cycle 8) —
 * nor does a number further on: "Abdul Karim 2nd Floor (Owner)" kept the name
 * when the cut ran to the last number (cycle 9). So "Nur Mansion (MD)" loses
 * its place: privacy over completeness.
 */
const PLACE_TOKEN = /^(?:[#(]*\d[\w\/#.,:-]*|(?:plot|holding|house|h|road|rd|block|sector|sec|flat|apt|floor|fl|level|unit|lane|ward|no)\b[.#:-]*\w*)$/i;
function placeBeforeRole(match: string): string {
  const role = /(?:[ \t]*[-–—][ \t]*|[ \t]*\()[^-–—(]*$/.exec(match)!;
  const words = match.slice(0, role.index).trim().split(/\s+/);
  let run = 0;
  while (run < words.length && PLACE_TOKEN.test(words[run]!)) run++;
  // End the kept run on a number: "House 5 Road" keeps "House 5".
  while (run > 0 && !/\d/.test(words[run - 1]!)) run--;
  const lead = /^\s*/.exec(match)![0];
  return run === 0 ? " " : lead + words.slice(0, run).join(" ");
}

function bareNumber(match: string): string {
  const longest = Math.max(0, ...(match.match(/\d+/g) ?? []).map((r) => r.length));
  const digits = match.replace(/^[+(]+/, "");
  if (longest >= 7 || (digits.startsWith("0") && (longest >= 6 || digitsOf(digits) >= 9))) return " ";
  return match;
}

/**
 * Drop the comma-separated parts of one line that name a person. `named`: the
 * text named a role somewhere, so the part that opens it — digit-free, no
 * address word — is the role holder's name even when the role is not next to it.
 */
function withoutNamedParts(line: string, named: boolean): string {
  const parts = line.split(",");
  const role = parts.map((p) => STANDALONE_ROLE.test(p));
  const bare = (p: string) => p.trim() !== "" && !/\d/.test(p) && !ADDRESS_WORD.test(p);
  const keep = parts.map((p, i) => {
    if (role[i]) return false;
    if (HONORIFIC_NAME.test(p) && !ADDRESS_WORD.test(p)) return false;
    // The opening part of a text that names a role is its holder — when it
    // reads as a name, two words or more: "Kashimpur, Gazipur, Your contact: …"
    // keeps the place.
    if (i === 0 && (named || role[1]) && bare(p) && p.trim().split(/\s+/).length >= 2) return false;
    // "…, Abdul Karim, Chairman, …": the part just before a role is its holder
    // when it reads as a name — two words or more, so "Gulshan, Managing
    // Director" keeps the place.
    if (role[i + 1] && bare(p) && p.trim().split(/\s+/).length >= 2) return false;
    return true;
  });
  return keep.every(Boolean) ? line : parts.filter((_, i) => keep[i]).join(",");
}

export type ContactTextOptions = {
  /** False for a product entry, where a long bare number is an HS code, not a phone. Default true. */
  bareNumbers?: boolean;
};

/** `text` with every contact detail removed; unchanged when it carries none. */
export function withoutContactDetails(text: string, options?: ContactTextOptions): string;
export function withoutContactDetails(text: string | null | undefined, options?: ContactTextOptions): string | null;
export function withoutContactDetails(text: string | null | undefined, options: ContactTextOptions = {}): string | null {
  if (text == null) return null;
  // A role beside a name anywhere ("…, House 5 (MD)") names a role too, so
  // the opening name part goes: "Karim Uddin, House 5 (MD), Dhaka" (cycle 9).
  const named = NAMES_A_ROLE.test(text) || new RegExp(NAME_WITH_ROLE.source, "im").test(text);
  let cut = text
    .replace(EMAIL, " ")
    .replace(SPELLED_EMAIL, " ")
    .replace(URL, " ")
    .replace(LABELLED_TEXT, " ")
    .replace(DOMAIN, " ")
    .replace(LABELLED_NUMBER, labelledNumber)
    .replace(MOBILE, " ")
    .replace(INTERNATIONAL, " ");
  if (options.bareNumbers !== false) cut = cut.replace(BARE_NUMBER, bareNumber);
  cut = cut
    .replace(NAME_WITH_ROLE, placeBeforeRole)
    .replace(NAME_LABEL, " ")
    .replace(DANGLING_LABEL, " ")
    .split("\n")
    .map((line) => withoutNamedParts(line, named))
    .join("\n")
    .replace(ROLE, " ");
  // …but "Mirpur D. Section" is a place: an address word keeps it.
  if (named) cut = cut.replace(INITIALLED_NAME, (m) => (ADDRESS_WORD.test(m) ? m : " "));
  // A clean address comes back byte for byte: the premises matcher and the
  // register attribution both compare these strings.
  if (cut === text) return text;
  return cut
    .split("\n")
    .map((line) =>
      line
        .replace(/\(\s*\)/g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/\s*,(?:\s*,)+/g, ",")
        .replace(/ +,/g, ",")
        // What a removed name leaves between separators: "…, (MD)." → "…, ."
        .replace(/,\s*[.;](?=\s*(?:[,;]|$))/g, "")
        .replace(/,\s*;/g, ",")
        .replace(/;\s*(?=;)/g, "")
        .replace(/\/(?=\s*(?:,|$))/g, "")
        .replace(/^[\s,;:/]+|[\s,;/]+$/g, ""),
    )
    .filter((line) => line !== "")
    .join("\n");
}
