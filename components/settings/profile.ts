// Profile, out of React (Paper `10 · Settings · Profile`): the name's limits, the picture's, and the
// two refusals a form can make before it asks the server. The server enforces them again.

export const NAME_MAX = 120;
export const PICTURE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
export const PICTURE_MAX_BYTES = 5 * 1024 * 1024;
export const PASSWORD_MIN = 8;

export const NAME_SAVED = "Display name saved";
export const PICTURE_SAVED = "Profile picture saved";
export const PICTURE_REMOVED = "Profile picture removed";
export const PASSWORD_SAVED = "Password updated";
export const EMAIL_SENT = "Link sent. Open it from the new address to confirm.";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The two letters on the picture's tile: from the name, else from the email's local part. */
export function initialsOf(displayName: string | null | undefined, email: string | null | undefined): string {
  const name = (displayName ?? "").trim();
  if (name) {
    const words = name.split(/\s+/).filter(Boolean);
    return ((words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1]![0]! : (words[0]?.[1] ?? ""))).toUpperCase();
  }
  const local = (email ?? "").replace(/@.*/, "");
  return (local.slice(0, 2) || "?").toUpperCase();
}

/** Null when the file may be sent; otherwise what is wrong with it. */
export function pictureRefusal(file: { size: number; type: string }): string | null {
  if (!PICTURE_ACCEPT.split(",").includes(file.type)) return "Use a PNG, JPEG, WebP or GIF image.";
  if (file.size > PICTURE_MAX_BYTES) return "The image must be 5 MB or smaller.";
  return null;
}

export function emailRefusal(v: string): string | null {
  return EMAIL_RE.test(v.trim()) ? null : "Enter a valid email address, such as you@company.com.";
}

export function passwordRefusal(pwd: string, confirm: string): string | null {
  if (pwd.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (pwd !== confirm) return "The two passwords do not match.";
  return null;
}
