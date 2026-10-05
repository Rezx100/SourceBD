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

export type PasswordField = "current" | "new" | "confirm";

/** What is wrong before the server is asked, and under which field to say it. The route checks the current password itself (ST-03). */
export function passwordRefusal(current: string, pwd: string, confirm: string): { field: PasswordField; message: string } | null {
  if (current.length === 0) return { field: "current", message: "Enter your current password." };
  if (pwd.length < PASSWORD_MIN) return { field: "new", message: `Use at least ${PASSWORD_MIN} characters.` };
  if (pwd === current) return { field: "new", message: "Choose a password different from your current one." };
  if (pwd !== confirm) return { field: "confirm", message: "The two passwords do not match." };
  return null;
}

/** The route answers 403 when the current password is wrong: that belongs under its own field. */
export function passwordFailureField(status: number): PasswordField {
  return status === 403 ? "current" : "confirm";
}

export const passwordBody = (current: string, pwd: string) => ({ action: "change_password", current_password: current, new_password: pwd });
