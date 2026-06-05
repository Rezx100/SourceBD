"use client";

import { useState } from "react";

// I-013 — Reveal-on-click for the additional phone numbers in the unlocked
// admin contact card. `phones[]` is already in the server payload; this is a
// pure UI disclosure with no API call.

export function PhonesReveal({ phones }: { phones: string[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!phones || phones.length === 0) return null;
  const primary = phones[0];
  if (!primary) return null;
  const rest = phones.slice(1);

  if (rest.length === 0) {
    return <a href={`tel:${primary}`}>{primary}</a>;
  }

  return (
    <div className="phones-reveal">
      <a href={`tel:${primary}`}>{primary}</a>
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="phones-reveal-toggle"
          aria-label={`Show ${rest.length} more phone number${rest.length === 1 ? "" : "s"}`}
        >
          +{rest.length} more
        </button>
      ) : (
        <>
          <ul className="phones-reveal-list">
            {rest.map((p) => (
              <li key={p}>
                <a href={`tel:${p}`}>{p}</a>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="phones-reveal-toggle"
          >
            Show less
          </button>
        </>
      )}
    </div>
  );
}
