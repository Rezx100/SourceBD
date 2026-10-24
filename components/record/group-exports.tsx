import Link from "next/link";
import { customsWindow, formatUsdShort, type GroupExports } from "@/lib/dashboard/facts";
import { cn } from "@/lib/utils";

/**
 * The group's customs records beside a member that has none of its own (0157). Founder, 24 Oct 2026: 4A Yarn Dyeing
 * (Team Group) read "no customs records" while its sister Mars Stitch shipped 990 times. Labelled as the group's on
 * every line, never added to the member's own figures; each sister links to its own record. Drawn once, under Exports.
 */
export function GroupExportsNote({ group, className }: { group: GroupExports; className?: string }) {
  return (
    <section aria-label={`${group.group} export records`} data-group-exports="" className={cn("flex max-w-[620px] flex-col gap-2 rounded-lg bg-subtle px-3.5 py-3", className)}>
      <div className="flex flex-col gap-0.5">
        <p className="text-base font-medium text-ink">{group.group}&apos;s export records</p>
        <p className="text-sm text-ink-2">
          These belong to its sister companies, not to this one. A group often ships its orders under one member&apos;s name.
        </p>
      </div>
      <ul className="flex flex-col gap-1.5 [font-variant-numeric:tabular-nums]">
        {group.members.map((m) => (
          <li key={m.slug} className="flex flex-col">
            <Link href={`/app/suppliers/${m.slug}`} className="text-sm font-medium text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">
              {m.name}
            </Link>
            <span className="text-sm text-ink-2">
              {[
                `${m.shipments.toLocaleString("en-GB")} shipment${m.shipments === 1 ? "" : "s"}`,
                m.fob_usd !== null ? formatUsdShort(m.fob_usd) : null,
                m.buyers !== null ? `${m.buyers.toLocaleString("en-GB")} buyer${m.buyers === 1 ? "" : "s"}` : null,
                customsWindow(m),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
