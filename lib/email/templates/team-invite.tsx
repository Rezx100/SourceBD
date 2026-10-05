// Gap 4 — the email an owner's invite sends. The link carries the one-time token; it is the only place
// the token leaves the database, and it is never logged or returned to the browser.

import * as React from "react";
import { Button, Text } from "@react-email/components";

import { EmailLayout, emailStyles } from "./_layout";

export type TeamInviteData = {
  /** `${origin}/invite/<token>`. */
  link: string;
  inviterName: string;
  companyName: string | null;
  /** "Editor", "Approver" or "Viewer". */
  roleLabel: string;
};

export const teamInviteSubject = (d: TeamInviteData) => `${d.inviterName} invited you to SourceBD`;

export function TeamInvite({ data }: { data: TeamInviteData }) {
  const who = data.companyName ? `${data.inviterName} at ${data.companyName}` : data.inviterName;
  return (
    <EmailLayout preview={`${who} invited you to join their team on SourceBD.`} heading="You're invited to a SourceBD team">
      <Text style={emailStyles.paragraph}>
        {who} invited you to join their team on SourceBD as {/^[AEIOU]/.test(data.roleLabel) ? "an" : "a"} {data.roleLabel}.
      </Text>
      <Button href={data.link} style={emailStyles.button}>
        Accept the invitation
      </Button>
      <Text style={emailStyles.paragraph}>
        The link works for 7 days, and only when you sign in or sign up with this email address. If you weren&apos;t expecting it, ignore this email.
      </Text>
    </EmailLayout>
  );
}

export default TeamInvite;
