"use client";

// The three email switches (Paper `10 · Settings · Emails`, `11 · Emails`). Each change saves at once
// (`{action:'update_notifications', <key>: bool}`); the switch moves first and goes back, with the
// reason, if the save fails. A switch is a checkbox with `role="switch"`: it works with the keyboard and
// says its state. 52x32 in a 44+ row on a phone.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Switch } from "@/components/kit";
import { useIsPhone } from "@/components/kit/use-phone";
import type { SettingsDoc } from "./doc";
import { EMAIL_FAILED, EMAIL_ROWS, turnedWords, type NotificationKey } from "./emails";
import { Flash, FormNote, useFlash } from "./form";
import { browserFetch, postSettings } from "./transport";

export function EmailsForm({ initial }: { initial: SettingsDoc["notifications"] }) {
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
    <div className="flex flex-col">
      <ul className="border-t border-line">
        {EMAIL_ROWS.map((r) => (
          <li key={r.key} className="flex min-h-14 items-center justify-between gap-6 border-b border-line py-3.5 max-md:gap-4 max-md:py-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span id={`email-${r.key}`} className="text-md font-medium text-ink">
                {r.title}
              </span>
              <span className="text-base text-ink-2 max-md:text-sm max-md:text-ink-3">{r.line}</span>
            </div>
            <Switch aria-labelledby={`email-${r.key}`} size={phone ? "touch" : "md"} checked={on[r.key]} disabled={saving === r.key} onChange={() => toggle(r.key)} />
          </li>
        ))}
      </ul>
      <div className="pt-3">
        <FormNote>{error}</FormNote>
      </div>
      <Flash text={flash} />
    </div>
  );
}
