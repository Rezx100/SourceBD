"use client";

// The three email switches (Paper `10 · Settings · Emails`, `11 · Emails`). Each change saves at once
// (`{action:'update_notifications', <key>: bool}`); the switch moves first and goes back, with the
// reason, if the save fails. A switch is a checkbox with `role="switch"`: it works with the keyboard and
// says its state. 52x32 in a 44+ row on a phone.

import { Check, Info } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Switch } from "@/components/kit";
import { useIsPhone } from "@/components/kit/use-phone";
import type { SettingsDoc } from "./doc";
import { EMAILS_PHONE_NOTE, EMAIL_FAILED, EMAIL_ROWS, savedToWords, turnedWords, type NotificationKey } from "./emails";
import { Flash, FormNote, useFlash } from "./form";
import { browserFetch, postSettings } from "./transport";

export function EmailsForm({ initial, email }: { initial: SettingsDoc["notifications"]; email?: string | null }) {
  const router = useRouter();
  const phone = useIsPhone();
  const [on, setOn] = useState(initial);
  const [saving, setSaving] = useState<NotificationKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useFlash();

  async function toggle(key: NotificationKey) {
    if (saving) return;
    const next = !on[key];
    setOn((s) => ({ ...s, [key]: next }));
    setSaving(key);
    setError(null);
    setFlash(null);
    const r = await postSettings({ action: "update_notifications", [key]: next }, EMAIL_FAILED, { fetch: browserFetch });
    setSaving(null);
    if (!r.ok) {
      setOn((s) => ({ ...s, [key]: !next }));
      return setError(r.message);
    }
    setFlash(turnedWords(key, next));
    router.refresh();
  }

  return (
    <div className="flex flex-col max-md:pt-2">
      <p className="flex gap-2 rounded-lg bg-subtle px-3 py-2.5 text-sm text-ink-2 md:hidden">
        <Info size={16} className="mt-px shrink-0 text-ink-3" aria-hidden />
        {EMAILS_PHONE_NOTE}
      </p>
      <ul className="border-t border-line max-md:border-t-0 max-md:pt-2">
        {EMAIL_ROWS.map((r) => (
          <li key={r.key} className="flex min-h-14 items-center justify-between gap-6 border-b border-line py-3.5 max-md:min-h-[72px] max-md:gap-3 max-md:py-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span id={`email-${r.key}`} className="text-md font-medium text-ink max-md:font-normal max-md:leading-[22px]">
                {r.title}
              </span>
              <span className="text-base text-ink-2 max-md:hidden">{r.line}</span>
              <span className="text-sm text-ink-3 md:hidden">{r.phoneLine}</span>
            </div>
            <Switch aria-labelledby={`email-${r.key}`} size={phone ? "touch" : "md"} checked={on[r.key]} disabled={saving === r.key} onChange={() => toggle(r.key)} />
          </li>
        ))}
      </ul>
      <p className="flex items-center gap-1.5 pt-3 text-xs text-ink-3 [overflow-wrap:anywhere] md:hidden">
        <Check size={14} className="shrink-0" aria-hidden />
        {savedToWords(email)}
      </p>
      <div className="pt-3">
        <FormNote>{error}</FormNote>
      </div>
      <Flash text={flash} />
    </div>
  );
}
