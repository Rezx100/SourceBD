// Sign-up, sign-in and reset, out of React (Paper `20 Onboarding` · rows 0, 2000, 4000): the words, the
// refusals a form makes before it asks the server, and the small decisions (is this a personal address,
// where "Open Gmail" goes). The server checks everything again.

export const PASSWORD_MIN = 8;
/** The cookie that remembers where the last email or link went (httpOnly, an hour): the "Check your email" pages name it without a URL carrying it. */
export const AUTH_EMAIL_COOKIE = "sbd_auth_email";
/** Where a confirmation email should lead, kept beside the address (an invite link, a record); only a same-origin path is ever stored. */
export const AUTH_NEXT_COOKIE = "sbd_auth_next";
/** How long a sent link or email waits before it can be sent again. */
export const RESEND_SECONDS = 60;

export const EXISTS = "An account already uses this email.";
export const WRONG_SIGN_IN = "That email and password don't match.";
export const WRONG_SIGN_IN_HELP = "Try again, reset your password, or get a sign-in link.";
export const LINK_SENT_WORD = "A new link is on its way. The old one no longer works.";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Webmail and other personal providers: allowed, but the form explains what a work address gives (Paper: "A Gmail address works."). */
const PERSONAL = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "ymail.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]);

export function isPersonalEmail(email: string): boolean {
  const at = email.trim().toLowerCase().lastIndexOf("@");
  return at > 0 && PERSONAL.has(email.trim().toLowerCase().slice(at + 1));
}

/** The provider's name for the notice: "A Gmail address works." Null for a work address. */
export function personalProvider(email: string): string | null {
  if (!isPersonalEmail(email)) return null;
  const domain = email.trim().toLowerCase().split("@").pop() ?? "";
  if (domain.startsWith("gmail") || domain.startsWith("googlemail")) return "Gmail";
  if (domain.startsWith("yahoo") || domain === "ymail.com") return "Yahoo";
  if (domain === "icloud.com" || domain === "me.com") return "iCloud";
  if (domain.startsWith("proton")) return "Proton";
  if (domain === "aol.com") return "AOL";
  return "Outlook";
}

export function emailRefusal(email: string): string | null {
  return EMAIL_RE.test(email.trim()) ? null : "Enter a valid email address, such as you@company.com.";
}

/** Paper: "Use at least 8 characters. This one has 5." Null when long enough. */
export function passwordRefusal(password: string): string | null {
  return password.length >= PASSWORD_MIN ? null : `Use at least ${PASSWORD_MIN} characters. This one has ${password.length}.`;
}

/** The sentence under a field when Supabase refuses; its own messages are not ours to show. */
export function signUpRefusal(message: string): { field: "email" | "password" | null; error: string } {
  if (/already (been )?registered|already exists|already uses/i.test(message)) return { field: "email", error: EXISTS };
  if (/password/i.test(message)) return { field: "password", error: "That password was not accepted. Use at least 8 characters, and avoid a common one." };
  if (/rate limit|too many|security purposes/i.test(message)) return { field: null, error: "Too many attempts just now. Wait a minute and try again." };
  if (/email/i.test(message)) return { field: "email", error: "Enter a valid email address, such as you@company.com." };
  return { field: null, error: "We could not create your account just now. Try again in a minute." };
}

/** What a failed password sign-in says; the unconfirmed-address case is told apart so it can lead to the verify page. */
export function signInRefusal(message: string): "unconfirmed" | "rate" | "wrong" {
  if (/not confirmed|confirm your email/i.test(message)) return "unconfirmed";
  if (/rate limit|too many|security purposes/i.test(message)) return "rate";
  return "wrong";
}

/** 0:42, the way the resend timer reads. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Only same-origin paths: no `//host`, no absolute address, no backslash. */
export function safeNext(value: string | null | undefined, fallback = "/app"): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : fallback;
}

/** "Open Gmail" and "Open Outlook" go to the webmail's inbox. */
export const MAIL_LINKS = [
  { label: "Open Gmail", href: "https://mail.google.com/mail/u/0/#inbox" },
  { label: "Open Outlook", href: "https://outlook.live.com/mail/0/inbox" },
] as const;

/** The same words as the clock, for a screen reader's label. */
export function resendLabel(seconds: number): string {
  return seconds > 0 ? `Resend in ${clock(seconds)}` : "Resend the email";
}

export type AuthActionState = {
  error?: string;
  info?: string;
  /** Which field the error sits under; none means a banner above the form. */
  field?: "email" | "password";
  /** A refusal that needs more than a sentence: the account exists (Sign in, Reset password) or the pair did not match. */
  kind?: "exists" | "wrong";
};
