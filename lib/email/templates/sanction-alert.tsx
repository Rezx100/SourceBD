// Spec H4 — sanction_alert email (fires to every buyer who has saved a
// supplier whose queued sanctions hit was just confirmed by an admin).

import * as React from "react";
import { Button, Text } from "@react-email/components";

import { EmailLayout, emailStyles } from "./_layout";

export type SanctionAlertData = {
  appUrl: string;
  supplierName: string;
  supplierSlug: string;
  listName: string;
  reason: string;
};

export const sanctionAlertSubject = (data: SanctionAlertData) =>
  `Sanctions alert: ${data.supplierName}`;

export function SanctionAlert({ data }: { data: SanctionAlertData }) {
  const url = `${data.appUrl}/suppliers/${data.supplierSlug}`;
  return (
    <EmailLayout
      preview={`${data.supplierName} now matches ${data.listName}`}
      heading="Sanctions alert on a saved supplier"
    >
      <Text style={emailStyles.paragraph}>
        SourceBD just confirmed a sanctions-list match for a supplier you have
        saved.
      </Text>
      <Text style={emailStyles.paragraph}>
        <strong>{data.supplierName}</strong>
        <br />
        List: {data.listName}
        <br />
        Reviewer note: {data.reason}
      </Text>
      <Text style={emailStyles.paragraph}>
        Do not place new orders until you have completed your own enhanced
        due-diligence review.
      </Text>
      <Button href={url} style={emailStyles.button}>
        View supplier
      </Button>
    </EmailLayout>
  );
}

export default SanctionAlert;
