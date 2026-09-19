// The dashboard kit's icons (REZ-A): Phosphor, regular weight, 16px in the
// app and 12px inside a chip (artifact "Iconography"). Icons take the text
// colour beside them and are decorative unless a label is passed.

import {
  ArrowRight,
  ArrowSquareOut,
  ArrowsDownUp,
  ArrowsLeftRight,
  BookmarkSimple,
  Buildings,
  CaretDown,
  CaretLeft,
  CaretRight,
  ChatCircle,
  Check,
  CheckCircle,
  Clock,
  DotsThree,
  DownloadSimple,
  Funnel,
  Image as ImageIcon,
  ListDashes,
  Lock,
  MagnifyingGlass,
  Paperclip,
  PaperPlaneTilt,
  Plus,
  Rows,
  ShareNetwork,
  ShieldCheck,
  Sparkle,
  Tag,
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
  sort: ArrowsDownUp,
  download: DownloadSimple,
  external: ArrowSquareOut,
  funnel: Funnel,
  lock: Lock,
  warn: Warning,
  clock: Clock,
  "check-c": CheckCircle,
  shield: ShieldCheck,
  building: Buildings,
  tag: Tag,
  chat: ChatCircle,
  sparkle: Sparkle,
  image: ImageIcon,
  dots: DotsThree,
  share: ShareNetwork,
  paperclip: Paperclip,
  compare: ArrowsLeftRight,
} as const;

export type IconName = keyof typeof ICONS;

type IconProps = { size?: number; weight?: "regular" | "bold" | "fill"; className?: string; "aria-hidden"?: boolean; "aria-label"?: string };

/** A 16px icon (12px with `small`). Decorative unless `label` is given. */
export function Icon({
  name,
  small = false,
  label,
  className,
}: {
  name: IconName;
  small?: boolean;
  label?: string;
  className?: string;
}) {
  const C = ICONS[name] as ComponentType<IconProps>;
  return (
    <C
      size={small ? 12 : 16}
      weight="regular"
      className={className ? `shrink-0 ${className}` : "shrink-0"}
      aria-hidden={label ? undefined : true}
      aria-label={label}
    />
  );
}
