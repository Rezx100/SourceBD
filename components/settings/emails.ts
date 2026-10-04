// Emails, out of React (Paper `10 · Settings · Emails`): the three preferences `settings_get` carries and
// the words for each. Sending starts later in the beta, so the page says what a switch records and
// never that an email will arrive. Paper's "Sanctions changes · Always on" and "Slack and Teams" are not
// here: no setting holds either (sanctions changes sit under Saved suppliers, as they did), and Slack
// and Teams is design only.

import type { SettingsDoc } from "./doc";

export type NotificationKey = keyof SettingsDoc["notifications"];

export const EMAIL_ROWS: readonly { key: NotificationKey; title: string; line: string }[] = [
  { key: "rfq_replies", title: "Quotes", line: "Email me when a supplier sends or changes a quote." },
  { key: "saved_alerts", title: "Saved suppliers", line: "Certificate expiry, RSC safety updates and sanctions changes on suppliers you saved." },
  { key: "digest", title: "Weekly summary", line: "Every Monday: new suppliers, certificate and sanctions changes." },
];

export const EMAILS_CAPTION = "Choose your emails. Sending starts later in the beta; your choices are saved now.";
export const EMAILS_NOTE = "Saved automatically";

export const labelOf = (key: NotificationKey): string => EMAIL_ROWS.find((r) => r.key === key)?.title ?? "Preference";

/** "Quotes turned on": said and heard after a switch is saved. */
export const turnedWords = (key: NotificationKey, on: boolean): string => `${labelOf(key)} turned ${on ? "on" : "off"}`;

export const EMAIL_FAILED = "Could not save that. The switch is back where it was.";
