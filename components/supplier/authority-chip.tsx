import { cn } from "@/lib/utils";

/** Named authority chip — shared by the header "Corroborated by" row and
 *  location address rows. */
export function AuthorityChip({
  label,
  className,
  title,
}: {
  label: string;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-[12px] font-medium text-neutral-600",
        className,
      )}
    >
      {label}
    </span>
  );
}
