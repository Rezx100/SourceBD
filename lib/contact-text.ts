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
// its own issue.
//
// What counts as contact detail, from the real rows:
// - an e-mail address, including "info [at] abc.com";
// - a URL (`www.…`, `http…`), whatever follows a "Web:" or "Email:" label, or
//   a bare domain ("chikleetrims.com/") — but not a company name that is one
//   ("New Apparel.com Limited");
// - a Bangladeshi mobile number however it is grouped — "01711528388",
//   "0171 152 8388", "01711-52-83-88", "01711.528388", "+880 1711 528388" —
//   including slash-separated pairs;
// - an international number, `+880 2 9898989`;
// - a number after a contact label — Tel, Phone, Pho, Ph, Mobile, Mob, Cell,
//   Fax, Hotline, Contact, and "T:"/"M:"/"F:" — with "No"/"#" and ":"/"-"/"#"
//   separators ("Tel No: 912 5191", "Mob-01711528388", "Cell#01711…"),
//   including lists ("TEL: 741872, 741889, 741890"); the number must carry six
//   or more digits, so "Ph. 12" (a phase) is not a phone;
// - a bare number with an unbroken run of seven or more digits ("9125191",
//   "8715141-2"), or one that starts with 0 and runs six or more
//   ("018-238019", "011029958"). Plots, holdings and postcodes run six or
//   fewer and do not start with 0 ("Plot # 110072", "314102", "Dhaka-1000"),
//   and a number straight after an address label (Plot, Holding, House…) is
//   never a phone;
// - a named contact: "Your contact: <name>", a role (Proprietor, Managing
//   Director) and, where the address opens "Name, Role", the name; a
//   comma-separated part that is an honorific and a name ("Md. Moniruzzaman
//   Monir") and holds no address word ("Dr. Assaduzzaman Industrial Park" is a
//   place, so "Dr." is not taken as one);
// - the label left behind once its value is gone ("Web:", "Email:").
// Words that merely begin like a label — Telihati, Telecom, Web Tower, Email
// Road, Chairman Bari — are not contact details: labels are whole words, and a
// label only goes when its value did.

const ONE_LABEL = String.raw`\b(?:tel|tele|telephone|phone|pho|ph|mobile|mob|cell|fax|hotline|contact|e-?mail|web|website)\b`;
// "Tel/Fax:" is one label.
const LABEL = String.raw`${ONE_LABEL}(?:[ \t]*\/[ \t]*${ONE_LABEL})*`;
const LABEL_TAIL = String.raw`(?:[ \t]*(?:no|number|#)\.?)?[ \t]*[:.#\-]?[ \t]*`;
const ADDRESS_LABEL = String.raw`\b(?:plot|holding|house|h|road|rd|block|sector|sec|flat|apt|reg|khatian|dag|mouza|ward|no)\b\.?[ \t]*[#:\-]?[ \t]*`;

const EMAIL = /[\w.+-]+(?:@|\s*[[(]\s*at\s*[\])]\s*)[\w-]+(?:\.[\w-]+)+/gi;
const URL = /\b(?:https?:\/\/|www\.)[^\s,;]+/gi;
// Whatever follows "Web:"/"Email:" when it holds a dot, whatever its domain ends
// in; "Web Tower" and "Email Road" have no colon and stay.
const LABELLED_TEXT = /\b(?:e-?mail|web|website)\b[ \t]*:[ \t]*[^\s,;]*\.[^\s,;]+/gi;
const DOMAIN = /\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*\.(?:com|net|org|info|biz|co|bd|cn|hk|in|uk|de|io|asia)(?:\.[a-z]{2})?\b(?!\s+(?:limited|ltd)\b)\/?[^\s,;]*/gi;
const MOBILE = /(?<![\d+])(?:\+?[ \t]?88[ \t\-]?)?0[ \t.\-]?1[ \t.\-]?[3-9](?:[ \t.\-]?\d){8}(?!\d)/g;
const INTERNATIONAL = /\+\d[\d \t\-()]{6,}\d/g;
const LABELLED_NUMBER = new RegExp(String.raw`(?:${LABEL}|\b[TMF]\b(?=[ \t]*:))${LABEL_TAIL}\+?\d[\d \t\-()/.,]*\d`, "gi");
const BARE_NUMBER = new RegExp(String.raw`(?<!${ADDRESS_LABEL})(?<=^|[\s,;:(/])\+?[\d\-()]*\d[\d\-()]*(?=$|[\s,;.)/])`, "gi");
const YOUR_CONTACT = /\byour contact\b[ \t]*:?[^,\n]*/gi;
const ROLE = /\b(?:managing director|proprietor)\b/gi;
const DANGLING_LABEL = new RegExp(String.raw`${LABEL}(?:[ \t]*(?:no|number|#)\.?)?[ \t]*[:.#\-][ \t]*(?=$|[,;\n])`, "gim");

const HONORIFIC_NAME = /^\s*(?:md|mohd|mohammad|mr|mrs|ms|engr)\.?\s+[a-z][a-z .'\-]*$/i;
const STANDALONE_ROLE = /^\s*(?:managing director|proprietor|chairman|director|ceo|owner|md)\s*$/i;
const ADDRESS_WORD = /\b(?:road|rd|street|avenue|lane|bari|market|plaza|tower|bhaban|bhabon|house|para|nagar|bazar|sarak|sarani|mor|villa|complex|centre|center|park|industrial|university|college|school|mosque|hospital)\b/i;

function digitsOf(s: string): number {
  return s.replace(/\D/g, "").length;
}

/** A labelled number is a phone only when it carries six or more digits. */
function labelledNumber(match: string): string {
  return digitsOf(match.replace(new RegExp(LABEL, "i"), "")) >= 6 ? " " : match;
}

/** A bare number is a phone when it runs seven unbroken digits, or six from a leading 0. */
function bareNumber(match: string): string {
  const longest = Math.max(0, ...(match.match(/\d+/g) ?? []).map((r) => r.length));
  const digits = match.replace(/^[+(]+/, "");
  if (longest >= 7 || (digits.startsWith("0") && (longest >= 6 || digitsOf(digits) >= 9))) return " ";
  return match;
}

/** Drop the comma-separated parts of one line that name a person. */
function withoutNamedParts(line: string): string {
  const parts = line.split(",");
  const role = parts.map((p) => STANDALONE_ROLE.test(p));
  const keep = parts.map((p, i) => {
    if (role[i]) return false;
    if (HONORIFIC_NAME.test(p) && !ADDRESS_WORD.test(p)) return false;
    // "Name, Proprietor" opening the address: the first part names the role holder.
    if (i === 0 && role[1] && !/\d/.test(p) && !ADDRESS_WORD.test(p)) return false;
    return true;
  });
  return keep.every(Boolean) ? line : parts.filter((_, i) => keep[i]).join(",");
}

/** `text` with every contact detail removed; unchanged when it carries none. */
export function withoutContactDetails(text: string): string;
export function withoutContactDetails(text: string | null | undefined): string | null;
export function withoutContactDetails(text: string | null | undefined): string | null {
  if (text == null) return null;
  const cut = text
    .replace(EMAIL, " ")
    .replace(URL, " ")
    .replace(LABELLED_TEXT, " ")
    .replace(DOMAIN, " ")
    .replace(LABELLED_NUMBER, labelledNumber)
    .replace(MOBILE, " ")
    .replace(INTERNATIONAL, " ")
    .replace(BARE_NUMBER, bareNumber)
    .replace(YOUR_CONTACT, " ")
    .replace(DANGLING_LABEL, " ")
    .split("\n")
    .map(withoutNamedParts)
    .join("\n")
    .replace(ROLE, " ");
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
        .replace(/\/(?=\s*(?:,|$))/g, "")
        .replace(/^[\s,;:/]+|[\s,;/.]+$/g, ""),
    )
    .filter((line) => line !== "")
    .join("\n");
}
