const QUERY_NORMALISATIONS: Record<string, string> = {
  childrean: "children",
  childrens: "children",
  kid: "kids",
  tshirt: "t-shirt",
  tshirts: "t-shirts",
  womens: "women",
  ladies: "women",
  mens: "men",
};

/**
 * The most the rewrite can lengthen a keyword. Each token is a key plus its
 * separator, so a keyword made of the worst key repeated grows by
 * (value + 1) / (key + 1). Over the WHOLE table: lib/discover-v32-state.test.ts
 * holds Q_MAX × this under 0104's refusal, so a new mapping that lengthens
 * more than today's cannot make an accepted keyword a refused search.
 */
export const QUERY_REWRITE_WORST_GROWTH = Math.max(
  ...Object.entries(QUERY_NORMALISATIONS).map(([key, value]) => (value.length + 1) / (key.length + 1)),
);

export type DiscoverSmartQuery = {
  rpcQ: string;
  inferredCategory: string;
};

export function resolveDiscoverSmartQuery(
  q: string,
  explicitCategory: string,
): DiscoverSmartQuery {
  const trimmed = q.trim();
  if (!trimmed) {
    return { rpcQ: trimmed, inferredCategory: "" };
  }

  if (explicitCategory.trim()) {
    return { rpcQ: normaliseQuery(trimmed), inferredCategory: "" };
  }

  return { rpcQ: normaliseQuery(trimmed), inferredCategory: "" };
}

function normaliseQuery(q: string): string {
  return q
    .toLowerCase()
    .split(/([^a-z0-9]+)/)
    .map((part) => QUERY_NORMALISATIONS[part] ?? part)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}
