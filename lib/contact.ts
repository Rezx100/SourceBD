// Contact sales (B9e; Paper `30 Marketing · Contact sales`): the form's fields, their check, and the one thing it does:
// email the founder. No table holds a lead; the message goes to sales@sourcebd.net and the visitor's own address is the
// reply-to. A filled honeypot is dropped without a word. Pure and dependency-injected so a test reads every branch.

export const CONTACT_TO = "sales@sourcebd.net";

export const ROLES = ["Sourcing or buying", "Merchandising", "Compliance or sustainability", "Founder or executive", "Other"] as const;
export const MARKETS = ["UK", "EU", "US", "Canada", "Other"] as const;
export const PIECES = ["Under 100,000", "100,000–1 million", "1–10 million", "Over 10 million"] as const;

export type ContactField = "name" | "email" | "company" | "role" | "markets" | "pieces" | "message";

export type ContactValues = { name: string; email: string; company: string; role: string; markets: string[]; pieces: string; message: string };

export type ContactState = { sent?: true; error?: string; field?: ContactField; fields?: Partial<Record<ContactField, string>>; values?: Partial<ContactValues> };

const clean = (v: FormDataEntryValue | null, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max) : "");
export const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** What the form held, cut to size; nothing is refused here. */
export function readContact(fd: FormData): ContactValues {
  return {
    name: oneLine(clean(fd.get("name"), 120)),
    email: clean(fd.get("email"), 254).toLowerCase(),
    company: oneLine(clean(fd.get("company"), 160)),
    role: clean(fd.get("role"), 60),
    markets: fd.getAll("markets").map((m) => clean(m, 20)).filter((m): m is string => (MARKETS as readonly string[]).includes(m)),
    pieces: clean(fd.get("pieces"), 40),
    message: clean(fd.get("message"), 2000),
  };
}

/** The first thing wrong, as words under its own field, or null. */
export function checkContact(v: ContactValues): { field: ContactField; error: string } | null {
  if (!v.name) return { field: "name", error: "Enter your name." };
  if (!EMAIL.test(v.email)) return { field: "email", error: "Enter a work email, like name@company.com." };
  if (!v.company) return { field: "company", error: "Enter your company." };
  if (!(ROLES as readonly string[]).includes(v.role)) return { field: "role", error: "Choose your role." };
  if (v.markets.length === 0) return { field: "markets", error: "Choose at least one market." };
  if (!(PIECES as readonly string[]).includes(v.pieces)) return { field: "pieces", error: "Choose a range." };
  return null;
}

export type ContactDeps = {
  /** Resolves to true when the email was handed to the mail service; false when it was not (no key, a refusal). */
  send: (mail: { to: string; replyTo: string; subject: string; values: ContactValues }) => Promise<boolean>;
};

export const SENT_FAILED = `We could not send that. Please write to ${CONTACT_TO} instead.`;

export async function submitContact(fd: FormData, deps: ContactDeps): Promise<ContactState> {
  // The honeypot: a person never sees this field. A bot that fills it is told it worked.
  if (clean(fd.get("website"), 200)) return { sent: true };
  const values = readContact(fd);
  const bad = checkContact(values);
  if (bad) return { error: bad.error, field: bad.field, fields: { [bad.field]: bad.error }, values };
  let ok = false;
  try {
    ok = await deps.send({ to: CONTACT_TO, replyTo: values.email, subject: `Contact sales: ${oneLine(values.name)}, ${oneLine(values.company)}`.slice(0, 200), values });
  } catch {
    ok = false;
  }
  return ok ? { sent: true } : { error: SENT_FAILED, values };
}
