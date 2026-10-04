import { ResultsSkeleton } from "@/components/search/list";

// The results page while the search runs: the table's own head and rows (Paper `Results,
// loading`), so what arrives replaces its silhouette in place; after two seconds the head
// says it is loading (`SlowHead`). The layout draws the frame.

export default function BuyerDiscoverLoading() {
  return <ResultsSkeleton />;
}
