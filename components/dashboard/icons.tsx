// The dashboard kit's icons (REZ-A): Phosphor, regular weight, 16px in the
// app and 12px inside a chip (artifact "Iconography"). Icons take the text
// colour beside them and are decorative unless a label is passed.

import {
  ArrowElbowDownLeft,
  ArrowRight,
  ArrowUpLeft,
  ArrowSquareOut,
  ArrowsDownUp,
  ArrowsLeftRight,
  BookmarkSimple,
  CreditCard,
  SignOut,
  Package,
  Buildings,
  CaretDown,
  CaretLeft,
  CaretRight,
  ChatCircle,
  Check,
  CheckCircle,
  CircleNotch,
  Clock,
  ClockCounterClockwise,
  DotsThree,
  GearSix,
  DownloadSimple,
  Funnel,
  Image as ImageIcon,
  ListDashes,
  ListBullets,
  Lock,
  MagnifyingGlass,
  MapPin,
  Paperclip,
  SealCheck,
  PaperPlaneTilt,
  Plus,
  Rows,
  ShareNetwork,
  ShieldCheck,
  SidebarSimple,
  SlidersHorizontal,
  Sparkle,
  Tag,
  Trash,
  PencilSimple,
  Columns,
  RowsPlusBottom,
  Warning,
  X,
} from "@phosphor-icons/react/dist/ssr";
import type { ComponentType } from "react";

export const ICONS = {
  search: MagnifyingGlass,
  bookmark: BookmarkSimple,
  send: PaperPlaneTilt,
  "arrow-r": ArrowRight,
  "chev-r": CaretRight,
  "chev-l": CaretLeft,
  caret: CaretDown,
  check: Check,
  x: X,
  plus: Plus,
  cards: Rows,
  table: ListDashes,
  list: ListBullets,
  sort: ArrowsDownUp,
  download: DownloadSimple,
  external: ArrowSquareOut,
  funnel: Funnel,
  lock: Lock,
  warn: Warning,
  clock: Clock,
  "check-c": CheckCircle,
  shield: ShieldCheck,
  // Orders and Settings, so the kit rail can carry the same destinations the
  // app sidebar does. Same Phosphor set and weight as the rest.
  box: Package,
  gear: GearSix,
  building: Buildings,
  tag: Tag,
  chat: ChatCircle,
  sparkle: Sparkle,
  image: ImageIcon,
  dots: DotsThree,
  share: ShareNetwork,
  paperclip: Paperclip,
  compare: ArrowsLeftRight,
  // The typeahead's row kinds: a place and a certificate. Same set and weight.
  pin: MapPin,
  seal: SealCheck,
  // The loading state of a button; spun by the caller.
  spinner: CircleNotch,
  trash: Trash,
  pencil: PencilSimple,
  columns: Columns,
  rows: RowsPlusBottom,
  // The search (28 Sep 2026): a recent search, "put this in the field", the
  // Enter hint, opening a record in the pane beside the list, and All filters.
  history: ClockCounterClockwise,
  "fill-in": ArrowUpLeft,
  enter: ArrowElbowDownLeft,
  pane: SidebarSimple,
  sliders: SlidersHorizontal,
  // The account menu's Subscription and Sign out (founder's video, 29 Sep 2026).
  card: CreditCard,
  "sign-out": SignOut,
} as const;

export type IconName = keyof typeof ICONS;

type IconProps = { size?: number; weight?: "regular" | "bold" | "fill"; className?: string; role?: string; "aria-hidden"?: boolean; "aria-label"?: string };

/** A 16px icon (12px with `small`, or any `size` the caller names). Decorative unless `label` is given. */
export function Icon({
  name,
  small = false,
  size,
  label,
  className,
}: {
  name: IconName;
  small?: boolean;
  /** A size other than 16 or 12: the search landing's 20px field icon. */
  size?: number;
  label?: string;
  className?: string;
}) {
  const C = ICONS[name] as ComponentType<IconProps>;
  return (
    <C
      size={size ?? (small ? 12 : 16)}
      weight="regular"
      className={className ? `shrink-0 ${className}` : "shrink-0"}
      // A named `<svg>` with no role is neither a control nor a reliably
      // named graphic. Ten "Remove <filter>" icons were emitted this way and
      // read as actions nothing could reach; `marks.tsx` and `photo-tiles.tsx`
      // already do it correctly.
      role={label ? "img" : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label}
    />
  );
}
