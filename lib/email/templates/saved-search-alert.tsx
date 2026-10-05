// Gap 14 — the Monday email for a saved search with "Email me new matches" on: how many suppliers newly
// match, up to five names, a link that runs the search, and where to turn it off.

import * as React from "react";
import { Button, Link, Text } from "@react-email/components";

import { EmailLayout, emailStyles } from "./_layout";

export type SavedSearchAlertData = {
  searchName: string;
  /** How many suppliers match now that did not at the last check. */
  newCount: number;
  /** Up to five of them, by name. */
  names: ReadonlyArray<string>;
  /** `${origin}/app/discover?...`: the search itself. */
  runUrl: string;
  /** `${origin}/app/searches`: where the switch is. */
  manageUrl: string;
};

export const savedSearchAlertSubject = (d: SavedSearchAlertData) =>
  `${d.newCount} new ${d.newCount === 1 ? "supplier matches" : "suppliers match"} “${d.searchName}”`;

export function SavedSearchAlert({ data }: { data: SavedSearchAlertData }) {
  const more = data.newCount - data.names.length;
  return (
    <EmailLayout
      preview={`${data.newCount} new ${data.newCount === 1 ? "match" : "matches"} for ${data.searchName}.`}
      heading={`${data.newCount} new ${data.newCount === 1 ? "match" : "matches"} for “${data.searchName}”`}
    >
      <Text style={emailStyles.paragraph}>
        Since we last checked, {data.newCount === 1 ? "one more supplier matches" : `${data.newCount} more suppliers match`} your saved search.
      </Text>
      <Text style={emailStyles.paragraph}>
        {data.names.map((name) => (
          <React.Fragment key={name}>
            <strong>{name}</strong>
            <br />
          </React.Fragment>
        ))}
        {more > 0 ? `and ${more} more` : null}
      </Text>
      <Button href={data.runUrl} style={emailStyles.button}>
        Run search
      </Button>
      <Text style={emailStyles.muted}>
        You get this email once a week, on Monday, and only when something new matches. To stop it, turn off “Email me new matches” on{" "}
        <Link href={data.manageUrl} style={emailStyles.link}>
          your saved searches
        </Link>
        .
      </Text>
    </EmailLayout>
  );
}

export default SavedSearchAlert;
