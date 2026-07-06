import { notFound } from "next/navigation";
import { RESPONSIVE_WIDTHS, heightForWidth } from "@/lib/responsive/breakpoints";
import { getServerRole } from "@/lib/auth";

// Dev-only responsive QA matrix. Triple-gated:
//   1. File extension `.dev.tsx` — registered only in development via
//      `next.config.ts::pageExtensions`, so the route is invisible to the
//      production build and the routes-manifest stays at 68.
//   2. `NODE_ENV !== 'production'` runtime guard — belt for the brace.
//   3. Admin role gate — UI hiding is never a security control.
//
// Usage in dev:  http://localhost:3000/responsive-grid?path=/discover

export const dynamic = "force-dynamic";

type SearchParams = { path?: string };

const DEFAULT_PATH = "/";
const PRESET_PATHS = [
  "/",
  "/discover",
  "/pricing",
  "/compliance",
  "/legal/privacy",
  "/login",
  "/signup",
  "/app",
  "/app/discover",
  "/app/match",
];

export default async function ResponsiveGridPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const role = await getServerRole();
  if (role !== "admin") notFound();

  const params = await searchParams;
  const path = params.path && params.path.startsWith("/") ? params.path : DEFAULT_PATH;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <header className="space-y-2">
        <p className="text-[12px] text-ink-tertiary">
          Dev only · Spec P1 responsive QA
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tightish text-ink-primary">
          Responsive grid — {path}
        </h1>
        <p className="text-sm text-ink-secondary">
          Every iframe below renders <code>{path}</code> at a locked
          viewport width. Sweep horizontally; flag anything that scrolls
          horizontally, has unreadable text, or stretches beyond the
          intended max-width. Widths are locked in
          <code className="ml-1">lib/responsive/breakpoints.ts</code>.
        </p>
        <form className="flex flex-wrap items-center gap-2 pt-2" method="get">
          <label className="text-sm text-ink-secondary" htmlFor="path-input">
            Route:
          </label>
          <input
            id="path-input"
            name="path"
            defaultValue={path}
            className="rounded-input border border-hairline bg-bg-l0 px-3 py-1.5 text-sm outline-none focus:border-accent-indigo"
            placeholder="/discover"
            list="path-presets"
          />
          <datalist id="path-presets">
            {PRESET_PATHS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <button
            type="submit"
            className="rounded-input border border-hairline bg-bg-l1 px-3 py-1.5 text-sm hover:bg-bg-l2"
          >
            Render
          </button>
        </form>
      </header>

      <div className="flex gap-6 overflow-x-auto pb-12">
        {RESPONSIVE_WIDTHS.map((w) => {
          const h = heightForWidth(w);
          return (
            <figure key={w} className="flex-none">
              <figcaption className="text-[12px] text-ink-tertiary">
                {w} × {h}
              </figcaption>
              <iframe
                src={path}
                title={`${path} at ${w}px`}
                className="mt-1 border border-hairline bg-bg-l0"
                style={{ width: `${w}px`, height: `${h}px` }}
                loading="lazy"
              />
            </figure>
          );
        })}
      </div>
    </main>
  );
}
