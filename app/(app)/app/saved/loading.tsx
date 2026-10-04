import { SavedSkeleton } from "@/components/saved/list";

// The layout draws the frame; this is the content region while the saved list loads. Saved has no
// detail route that answers 404, so a loading state over the whole folder is safe here.

export default function SavedLoading() {
  return <SavedSkeleton />;
}
