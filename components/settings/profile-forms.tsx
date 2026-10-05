"use client";

// Profile (Paper `10 · Settings · Profile`): the name and picture, the email, the password. The
// picture goes to its own route the moment it is chosen; the name raises the bar at the foot; the
// email and the password each have their own button, because each is a separate act (a link to
// confirm, a new password). The password form asks for the current one first: the route checks it
// (ST-03) and refuses with a 403 when it is wrong, which is said under that field.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button, Field, Input } from "@/components/kit";
import { Flash, FormNote, SaveBar, SaveRow, useFlash } from "./form";
import { EMAIL_SENT, NAME_MAX, NAME_SAVED, PASSWORD_SAVED, PICTURE_ACCEPT, PICTURE_REMOVED, PICTURE_SAVED, emailRefusal, initialsOf, passwordBody, passwordFailureField, passwordRefusal, pictureRefusal, type PasswordField } from "./profile";
import { SAVE_FAILED, browserFetch, deleteAvatar, postAvatar, postSettings } from "./transport";

const touchInput = "max-md:h-input-touch max-md:text-md";
const doFetch = { fetch: browserFetch };

/** The picture and the display name: the picture is saved on choosing; the name by the bar. */
export function NameForm({ initialName, initialAvatarUrl, email }: { initialName: string; initialAvatarUrl: string | null; email: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(initialName);
  const [name, setName] = useState(initialName);
  const [url, setUrl] = useState(initialAvatarUrl);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useFlash();
  const changed = name.trim() !== saved.trim() ? ["Name"] : [];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving || changed.length === 0) return;
    setSaving(true);
    setError(null);
    const r = await postSettings({ action: "update_profile", display_name: name.trim() || null }, SAVE_FAILED.profile, doFetch);
    setSaving(false);
    if (!r.ok) return setError(r.message);
    setSaved(name);
    setFlash(NAME_SAVED);
    router.refresh();
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || busy) return;
    const refusal = pictureRefusal(file);
    if (refusal) return setError(refusal);
    setBusy(true);
    setError(null);
    const r = await postAvatar(file, doFetch);
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setUrl(typeof r.json?.avatar_url === "string" ? r.json.avatar_url : null);
    setFlash(PICTURE_SAVED);
    router.refresh();
  }

  async function onRemove() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await deleteAvatar(doFetch);
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setUrl(null);
    setFlash(PICTURE_REMOVED);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} aria-label="Your name" className="flex flex-col gap-3">
      <div className="flex items-end gap-3 max-sm:flex-col max-sm:items-stretch">
        <div className="flex items-center gap-3">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- the buyer's own upload on storage, drawn at 48px
            <img src={url} alt="Your profile picture" className="size-12 shrink-0 rounded-full border border-line object-cover" />
          ) : (
            <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-sunken text-md font-semibold text-ink-2">
              {initialsOf(name, email)}
            </span>
          )}
          <Field label="Display name" help={`Up to ${NAME_MAX} characters`} className="w-72 max-sm:w-full">
            {(a) => <Input {...a} value={name} onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))} maxLength={NAME_MAX} placeholder="e.g. Jane Doe" autoComplete="name" className={touchInput} />}
          </Field>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input ref={input} type="file" accept={PICTURE_ACCEPT} onChange={onPick} className="hidden" tabIndex={-1} aria-hidden />
        <Button onClick={() => input.current?.click()} loading={busy} loadingLabel="Saving" className="max-md:h-input-touch">
          {url ? "Change picture" : "Upload picture"}
        </Button>
        {url ? (
          <Button kind="quiet" onClick={onRemove} disabled={busy} className="max-md:h-input-touch">
            Remove
          </Button>
        ) : null}
        <span className="text-xs text-ink-3">PNG, JPEG, WebP or GIF · up to 5 MB</span>
      </div>
      <FormNote>{error}</FormNote>
      <SaveBar changed={changed} saving={saving} onDiscard={() => (setName(saved), setError(null))} />
      <Flash text={flash} />
    </form>
  );
}

/** A new address: a link is sent to it and the email changes when it is opened. Nothing changes until then. */
export function EmailForm() {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useFlash(6000);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const refusal = emailRefusal(email);
    if (refusal) return setError(refusal);
    setSaving(true);
    setError(null);
    const r = await postSettings({ action: "change_email", new_email: email }, SAVE_FAILED.email, doFetch);
    setSaving(false);
    if (!r.ok) return setError(r.message);
    setEmail("");
    setFlash(r.info ?? EMAIL_SENT);
  }

  return (
    <form onSubmit={onSubmit} aria-label="Change email" noValidate className="flex flex-col gap-3">
      <Field label="New email" error={error} help="We'll email a link to the new address. Click it to confirm." className="w-72 max-sm:w-full">
        {(a) => <Input {...a} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. you@company.com" autoComplete="email" className={touchInput} />}
      </Field>
      <SaveRow label="Send link" loadingLabel="Sending" saving={saving} />
      <Flash text={flash} />
    </form>
  );
}

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ field: PasswordField; message: string } | null>(null);
  const [flash, setFlash] = useFlash();
  const under = (f: PasswordField) => (error?.field === f ? error.message : null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const refusal = passwordRefusal(current, pwd, confirm);
    if (refusal) return setError(refusal);
    setSaving(true);
    setError(null);
    const r = await postSettings(passwordBody(current, pwd), SAVE_FAILED.password, doFetch);
    setSaving(false);
    if (!r.ok) return setError({ field: passwordFailureField(r.status), message: r.message ?? SAVE_FAILED.password });
    setCurrent("");
    setPwd("");
    setConfirm("");
    setFlash(PASSWORD_SAVED);
  }

  return (
    <form onSubmit={onSubmit} aria-label="Change password" noValidate className="flex flex-col gap-3">
      <div className="flex max-w-72 flex-col gap-3 max-sm:max-w-none">
        <Field
          label="Current password"
          error={under("current")}
          help={
            <>
              Forgotten it, or always signed in with an email link?{" "}
              <Link href="/forgot-password" prefetch={false} className="text-brand underline decoration-1 [text-underline-position:from-font]">
                Reset it by email
              </Link>
              .
            </>
          }
        >
          {(a) => <Input {...a} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" className={touchInput} />}
        </Field>
        <Field label="New password" error={under("new")}>
          {(a) => <Input {...a} type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} autoComplete="new-password" className={touchInput} />}
        </Field>
        <Field label="Confirm new password" error={under("confirm")}>
          {(a) => <Input {...a} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className={touchInput} />}
        </Field>
      </div>
      <SaveRow label="Update password" loadingLabel="Updating" saving={saving} />
      <Flash text={flash} />
    </form>
  );
}
