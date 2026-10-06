// The daily copy of the record's seal to a mailbox outside the company (moderation plan 1e): the seal's
// hash and window, the outside authority's time, the chain's verdict, and the authority's token attached.
// This email is itself evidence: a dated third-party copy of what the record said that day.

import * as React from "react";
import { Text } from "@react-email/components";

import { EmailLayout, emailStyles } from "./_layout";

export type LedgerStampData = {
  sealId: number;
  sealHash: string;
  periodStart: string;
  periodEnd: string;
  entryCount: number;
  tsaUrl: string | null;
  tsaTime: string | null;
  stampError: string | null;
  verifyOk: boolean | null;
  verifyWhy: string | null;
  sealsChecked: number | null;
  appUrl: string;
};

const day = (iso: string) => iso.slice(0, 10);
const when = (iso: string) => iso.replace("T", " ").slice(0, 19) + " UTC";

export const ledgerStampSubject = (d: LedgerStampData) =>
  `SourceBD record seal ${d.sealId} · ${day(d.periodEnd)} · ${d.verifyOk === false ? "CHAIN BROKEN" : d.tsaTime ? "stamped" : "not stamped"}`;

export function LedgerStamp({ data }: { data: LedgerStampData }) {
  return (
    <EmailLayout
      preview={`Seal ${data.sealId}: ${data.sealHash.slice(0, 16)}… ${data.verifyOk === false ? "The chain is broken." : "The chain verifies."}`}
      heading={`Record seal ${data.sealId}`}
      footer={
        <Text style={emailStyles.muted}>
          Keep this email. It is the copy of the seal that the company cannot change: the hash, the day, and the outside authority&apos;s token.
        </Text>
      }
    >
      <Text style={emailStyles.paragraph}>
        The SourceBD activity record was sealed through <strong>{when(data.periodEnd)}</strong>. Seal {data.sealId} covers the hour from{" "}
        {when(data.periodStart)} ({data.entryCount} entries) and chains every seal before it.
      </Text>
      <Text style={{ ...emailStyles.paragraph, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13, wordBreak: "break-all" }}>
        {data.sealHash}
      </Text>
      {data.tsaTime ? (
        <Text style={emailStyles.paragraph}>
          Stamped by the outside timestamp authority ({data.tsaUrl}) at <strong>{when(data.tsaTime)}</strong>. The authority&apos;s token is attached
          (.tsr); anyone can verify it against the hash above with <code>openssl ts -verify</code>.
        </Text>
      ) : (
        <Text style={emailStyles.paragraph}>
          <strong>No outside stamp today.</strong> {data.stampError ?? "The authority was not reached."} This email is still a dated copy of the hash.
        </Text>
      )}
      <Text style={emailStyles.paragraph}>
        {data.verifyOk === true
          ? `The whole chain was re-checked: ${data.sealsChecked ?? "every"} seal${data.sealsChecked === 1 ? "" : "s"} match the entries.`
          : data.verifyOk === false
            ? `THE CHAIN IS BROKEN: ${data.verifyWhy ?? "a seal no longer matches its entries"}. Look into it today.`
            : "The chain could not be re-checked today."}
      </Text>
      <Text style={emailStyles.muted}>From {data.appUrl}, the record&apos;s daily job. Nobody at the company can edit or delete an entry or a seal.</Text>
    </EmailLayout>
  );
}

export default LedgerStamp;
