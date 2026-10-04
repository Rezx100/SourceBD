// The list of conversations as a page draws it (B6a): the column with its head, the rows after the
// tab and the search, and what stands in for them when the read failed, nothing matches, or there
// are no conversations at all. One place for the list page and the conversation page, so the two
// agree on every word. Server component.

import { InboxColumn, InboxError, InboxFoot, InboxHead, InboxNone, InboxRows } from "./list";
import type { InboxData } from "./load";
import { buildThreadItems, filterItems, listHref, type ListState } from "./words";

/** "No reply yet" is counted only when every conversation's newest message was read; otherwise the tab is not drawn. */
export function noReplyCount(items: readonly { noReply: boolean }[], complete: boolean): number | null {
  return complete ? items.filter((i) => i.noReply).length : null;
}

export function InboxView({ inbox, state, currentId, now, className }: { inbox: InboxData; state: ListState; currentId: string | null; now: Date; className?: string }) {
  if (inbox.rows === null) {
    return (
      <InboxColumn className={className}>
        <InboxError retryHref={listHref(state)} />
      </InboxColumn>
    );
  }
  const items = buildThreadItems(inbox.rows, inbox.last, now);
  const noReply = noReplyCount(items, inbox.lastComplete);
  // Without the count there is no tab: a link to it must not filter on data that was not read.
  const effective: ListState = noReply === null && state.show === "noreply" ? { ...state, show: "all" } : state;
  const shown = filterItems(items, effective);
  return (
    <InboxColumn className={className} head={<InboxHead total={items.length} noReply={noReply} state={effective} Title={currentId ? "h2" : "h1"} />}>
      {shown.length === 0 ? <InboxNone state={effective} /> : <InboxRows items={shown} state={effective} currentId={currentId} />}
      <InboxFoot shown={shown.length} total={items.length} />
    </InboxColumn>
  );
}
