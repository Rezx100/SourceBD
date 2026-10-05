// Contact sales: the message the founder receives. It is the whole record of the enquiry (nothing is stored in a
// table), so every field the visitor gave is here, and the visitor's address is the reply-to of the email.

import * as React from "react";
import { Text } from "@react-email/components";

import { EmailLayout, emailStyles } from "./_layout";

export type ContactLeadData = {
  name: string;
  email: string;
  company: string;
  role: string;
  markets: string[];
  pieces: string;
  message: string;
};

export const contactLeadSubject = (d: ContactLeadData) => `Contact sales: ${d.name.replace(/\s+/g, " ")}, ${d.company.replace(/\s+/g, " ")}`.slice(0, 200);

export function ContactLead({ data }: { data: ContactLeadData }) {
  const rows: [string, string][] = [
    ["Name", data.name],
    ["Work email", data.email],
    ["Company", data.company],
    ["Role", data.role],
    ["Markets", data.markets.join(", ")],
    ["Pieces a year", data.pieces],
  ];
  return (
    <EmailLayout preview={`${data.name} at ${data.company} wrote to sales.`} heading="A message from the Contact sales form">
      {rows.map(([k, v]) => (
        <Text key={k} style={emailStyles.paragraph}>
          <strong>{k}:</strong> {v}
        </Text>
      ))}
      {data.message ? (
        <Text style={{ ...emailStyles.paragraph, whiteSpace: "pre-wrap" }}>
          <strong>Message:</strong> {data.message}
        </Text>
      ) : null}
      <Text style={emailStyles.paragraph}>Reply to this email to answer {data.name}.</Text>
    </EmailLayout>
  );
}

export default ContactLead;
