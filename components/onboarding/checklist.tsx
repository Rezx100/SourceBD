// The getting-started card (Paper `20 Onboarding` 7): in the sidebar from 1440, and as a card at the top of
// Alerts on a phone. Six steps, each a link to where it is done; a done step is ticked and struck through,
// the first undone one is the one to do next. The X hides it (a form post, so it works with no script).
// `ChecklistSlot` is the server part: it reads and draws nothing when there is nothing to show.

import { CaretRight, CheckCircle, X } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { progressLine, type Checklist } from "@/lib/checklist";
import { dismissChecklist } from "./actions";
import { loadChecklist } from "./checklist-load";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client, as the other loaders take it.
type Client = any;

function Hide({ size, label }: { size: "sm" | "touch"; label: string }) {
  return (
    <form action={dismissChecklist}>
      <button
        type="submit"
        aria-label={label}
        title={label}
        className={cn("flex items-center justify-center rounded-sm text-ink-3 hover:bg-sunken hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus", size === "touch" ? "size-11" : "size-6")}
      >
        <X size={size === "touch" ? 18 : 14} aria-hidden />
      </button>
    </form>
  );
}

/** The mark: a ticked circle when done, a ring (brand for the next one) when not. */
function Mark({ done, next, px }: { done: boolean; next: boolean; px: number }) {
  if (done) return <CheckCircle size={px} weight="fill" className="shrink-0 text-brand-ink" aria-hidden />;
  return <span aria-hidden style={{ width: px, height: px }} className={cn("block shrink-0 rounded-full", next ? "border-[1.5px] border-brand-ink" : "border border-line-strong")} />;
}

export function ChecklistCard({ checklist, variant }: { checklist: Checklist; variant: "sidebar" | "phone" }) {
  const next = checklist.steps.findIndex((s) => !s.done);
  const phone = variant === "phone";
  return (
    <section aria-label="Getting started" className={cn("rounded-lg border border-line bg-surface", phone ? "mx-4 mt-2 flex flex-col md:hidden" : "mx-3 mb-2 hidden flex-col gap-2 p-3 2xl:flex")}>
      <div className={cn("flex items-center justify-between", phone && "pl-4 pr-1 pt-1")}>
        <div className="flex flex-col">
          <h2 className={cn("font-semibold text-ink", phone ? "text-md" : "text-base")}>Getting started</h2>
          <p className={cn("text-ink-3", phone ? "text-sm" : "text-xs")}>{progressLine(checklist)}</p>
        </div>
        <Hide size={phone ? "touch" : "sm"} label="Hide getting started" />
      </div>
      <ul className={cn("flex flex-col", phone ? "py-1" : "gap-1.5")}>
        {checklist.steps.map((s, i) => (
          <li key={s.key}>
            <Link
              href={s.href}
              prefetch={false}
              className={cn(
                "flex items-center gap-2 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                phone ? "min-h-11 gap-3 px-4 text-md" : "items-start text-sm",
                s.done ? "text-ink-3 line-through decoration-1" : i === next ? "font-medium text-ink" : "text-ink",
              )}
            >
              <span className={cn("flex", !phone && "mt-0.5")}>
                <Mark done={s.done} next={i === next} px={phone ? 18 : 14} />
              </span>
              <span className={cn("min-w-0", phone && "grow")}>
                {s.label}
                {s.detail ? ` · ${s.detail}` : ""}
              </span>
              {phone && !s.done ? <CaretRight size={16} className="shrink-0 text-ink-3" aria-hidden /> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Reads the card's facts and draws it, or nothing: hidden, finished, or nothing could be read. */
export async function ChecklistSlot({ supabase, userId, variant }: { supabase: Client; userId: string | null | undefined; variant: "sidebar" | "phone" }) {
  const checklist = await loadChecklist(supabase, userId);
  return checklist ? <ChecklistCard checklist={checklist} variant={variant} /> : null;
}
