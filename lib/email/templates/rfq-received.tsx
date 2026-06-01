// Spec H4 — rfq_received email (fires to a claimed-supplier owner when a
// buyer creates an RFQ that targets that supplier).

import * as React from "react";
import { Button, Text } from "@react-email/components";

import { EmailLayout, emailStyles } from "./_layout";

export type RfqReceivedData = {
  appUrl: string;
  rfqId: string;
  productTitle: string;
  quantity: number;
  quantityUnit: string;
  buyerCountry?: string | null;
  shipBy?: string | null;
};

export const rfqReceivedSubject = (data: RfqReceivedData) =>
  `New RFQ: ${data.productTitle}`;

export function RfqReceived({ data }: { data: RfqReceivedData }) {
  const url = `${data.appUrl}/supplier/rfqs/${data.rfqId}`;
  const fromLine = data.buyerCountry
    ? `A buyer in ${data.buyerCountry} just sent you an RFQ.`
    : "A buyer just sent you an RFQ.";
  return (
    <EmailLayout
      preview={`New RFQ for ${data.productTitle}`}
      heading="You have a new RFQ"
    >
      <Text style={emailStyles.paragraph}>{fromLine}</Text>
      <Text style={emailStyles.paragraph}>
        <strong>{data.productTitle}</strong>
        <br />
        Quantity: {data.quantity.toLocaleString()} {data.quantityUnit}
        {data.shipBy ? (
          <>
            <br />
            Ship by: {data.shipBy}
          </>
        ) : null}
      </Text>
      <Button href={url} style={emailStyles.button}>
        Review &amp; quote
      </Button>
      <Text style={emailStyles.muted}>
        Responding within 24 hours boosts your visibility to this buyer.
      </Text>
    </EmailLayout>
  );
}

export default RfqReceived;
