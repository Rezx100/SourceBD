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
