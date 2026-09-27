// The buyer's own records (products, RFQ drafts) are free-form JSON the buyer
// wrote. None of them should ever hold a supplier's contact field, but the
// guarantee that contact details never reach buyer HTML cannot rest on
// "should": every products and drafts response passes through this, at any
// depth, before it leaves the API.

import { PII_KEYS } from "@/lib/discover-v32-rpc";

const CONTACT_KEYS: ReadonlySet<string> = new Set(PII_KEYS);

/** A copy of `value` with every contact key removed, however deep. */
export function stripContactKeys<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripContactKeys) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !CONTACT_KEYS.has(key))
        .map(([key, v]) => [key, stripContactKeys(v)]),
    ) as T;
  }
  return value;
}
