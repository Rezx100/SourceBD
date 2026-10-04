"use server";

// The filter pane's live count: how many suppliers the draft finds. The draft arrives as the
// query string the page would parse, so the count and "Show N suppliers" read one search. The
// read is the public one the results make; a signed-in buyer is still required, so the
// action is not a counting service for anyone with its id.

import { getServerRole } from "@/lib/auth";
import { readFilterCount } from "@/lib/dashboard/search-cache";
import { parseDiscoverState } from "@/lib/discover-v32-state";

/** A search's own address is far shorter than this; anything longer is not one. (A "use server" file may export only actions.) */
const COUNT_QUERY_MAX = 1500;

export async function countSuppliers(search: string): Promise<number | null> {
  if (typeof search !== "string" || search.length > COUNT_QUERY_MAX) return null;
  if (!(await getServerRole())) return null;
  return readFilterCount(parseDiscoverState(new URLSearchParams(search)));
}
