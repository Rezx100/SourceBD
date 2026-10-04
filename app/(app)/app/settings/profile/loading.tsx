import { SettingsSkeleton } from "@/components/settings/shell";

// The layout draws the frame; this is the content region while Settings loads: the navigation's
// silhouette and a few fields from 768, the list's rows under it.

export default function SettingsLoading() {
  return <SettingsSkeleton />;
}
