// Spec H4 — cert_expiry digest (nightly, sent to a buyer summarising
// certifications on their saved suppliers that expire in the next 30 days).

import * as React from "react";
import { Button, Text } from "@react-email/components";

import { EmailLayout, emailStyles } from "./_layout";

export type CertExpiryItem = {
  supplierName: string;
  supplierSlug: string;
  certCode: string;
  expiresOn: string;
};

export type CertExpiryData = {
  appUrl: string;
  items: ReadonlyArray<CertExpiryItem>;
};

export const certExpirySubject = (data: CertExpiryData) =>
  data.items.length === 1
    ? "1 certification on your saved suppliers expires soon"
    : `${data.items.length} certifications on your saved suppliers expire soon`;

export function CertExpiry({ data }: { data: CertExpiryData }) {
  return (
    <EmailLayout
      preview="Certifications on your saved suppliers are expiring."
      heading="Expiring certifications"
    >
      <Text style={emailStyles.paragraph}>
        The following certifications on suppliers you have saved expire in the
        next 30 days. Reach out to the supplier to confirm renewal status
        before placing an order.
      </Text>
      <Text style={emailStyles.paragraph}>
        {data.items.map((item) => (
          <React.Fragment key={`${item.supplierSlug}:${item.certCode}:${item.expiresOn}`}>
            <strong>{item.supplierName}</strong>
            {" — "}
            {item.certCode} expires {item.expiresOn}
            <br />
          </React.Fragment>
        ))}
      </Text>
      <Button href={`${data.appUrl}/app/saved`} style={emailStyles.button}>
        Open saved suppliers
      </Button>
    </EmailLayout>
  );
}

export default CertExpiry;
