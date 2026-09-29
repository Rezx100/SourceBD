// SourceBD's own icons (founder's video, 29 Sep 2026: "a high-quality custom
// icon set to replace these generic designs"; the decision page's style A).
// Drawn on the 24px grid of the Phosphor icons that stay, 1.5px strokes with
// round ends, in the text colour beside them. In the repo, not a package.

const PATHS = {
  // The source-pending mark: a document with a clock (it was a dashed square
  // that read as a tick box).
  pending: "M11 20.5H6.5a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1h7l4 4v2.5M13.5 3.5v4h4M16.5 12.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM16.5 14.5v2l1.4 1",
  // Open the record beside the list: a pane with an arrow into it.
  "open-beside": "M5.5 5h13a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM14 5v14M6.5 12H11M9 9.5 11.5 12 9 14.5",
  expand: "M14 4h6v6M20 4l-6.5 6.5M10 20H4v-6M4 20l6.5-6.5",
  "collapse-sidebar": "M5.5 4.5h13a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2zM9.5 4.5v15M16 9l-3 3 3 3",
  workers: "M9 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM3.5 19a5.5 5.5 0 0 1 11 0M17 6.5a2.5 2.5 0 1 1 0 5M16.2 14.2A4.5 4.5 0 0 1 20.5 18.8",
  established: "M5.5 5h13a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3.5 10h17M8 3v4M16 3v4",
  machines: "M7.5 3.5h9a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1zM7.5 17.5h9a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1zM8.5 6.5v11M15.5 6.5v11M8.5 10l7 2.2M8.5 13.5l7 2.2",
  address: "M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11zM12 7.6a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8z",
  register: "M3.5 9.5 12 4.5l8.5 5M5.5 10.5v7M9.8 10.5v7M14.2 10.5v7M18.5 10.5v7M3.5 20h17",
  certificate: "M12 3.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11zM9.2 13.8 8.2 20.5l3.8-2 3.8 2-1-6.7M9.7 9.1l1.6 1.6 3-3",
  "brand-list": "M3.5 12.3V4.5a1 1 0 0 1 1-1h7.8l8.2 8.2a1.4 1.4 0 0 1 0 2l-6.6 6.6a1.4 1.4 0 0 1-2 0zM8 6.6a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8z",
  receipt: "M6 3.5h8l4 4v13H6zM14 3.5v4h4M9 14l2 2 4-4",
} as const;

export type SbIconName = keyof typeof PATHS;
export const SB_ICON_NAMES = Object.keys(PATHS) as SbIconName[];

/** A 16px icon from SourceBD's own set; decorative unless `label` is given. */
export function SbIcon({ name, size = 16, label, className }: { name: SbIconName; size?: number; label?: string; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ? `shrink-0 ${className}` : "shrink-0"}
      role={label ? "img" : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
