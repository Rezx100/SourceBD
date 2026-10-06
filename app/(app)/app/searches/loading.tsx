import { SavedSkeleton } from "@/components/saved/list";

// The layout draws the frame; this is the content region while the saved searches load. The
// `[id]` route is a route handler that redirects, not a page, so this does not sit above a status.

export default function SearchesLoading() {
  return <SavedSkeleton />;
}
