import { notFound } from "next/navigation";
import {
  CheckCircle,
  Lock,
  Prohibit,
  Question,
  SealCheck,
  Warning,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";
import { getServerRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  borderRadius,
  boxShadow,
  contrastPairs,
  contrastRatio,
  cssVarName,
  density,
  fontSize,
  light,
  resolve,
  tiers,
  transitionDuration,
  type TierRank,
} from "@/lib/design/tokens";

export const dynamic = "force-dynamic";

// Design-system gallery — tokens plus the locked direction (spec §9). No components yet.
// Dev only and admin only, both checked on the server; otherwise 404.
//
// Spec §2 "nothing fake": the company names below are read live from the
// database. When none can be read the samples are left out, not invented.

const TIER_CLASS: Record<TierRank, string> = {
  1: "bg-tier-1 text-tier-1-on",
  2: "bg-tier-2 text-tier-2-on",
  3: "bg-tier-3 text-tier-3-on",
  4: "bg-tier-4 text-tier-4-on",
  5: "bg-tier-5 text-tier-5-on ring-1 ring-inset ring-tier-5-line",
};

const SIZE_CLASS: Record<string, string> = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
  "3xl": "text-3xl",
  "4xl": "text-4xl",
  "5xl": "text-5xl",
  "6xl": "text-6xl",
  "7xl": "text-7xl",
};

const RADIUS_CLASS: Record<string, string> = {
  none: "rounded-none",
  sm: "rounded-sm",
  DEFAULT: "rounded",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  full: "rounded-full",
};

const SHADOW_CLASS: Record<string, string> = {
  none: "shadow-none",
  xs: "shadow-xs",
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
};

function varColor(group: string, key: string): string {
  return `rgb(var(${cssVarName(group, key)}))`;
}

function refColor(ref: string): string {
  const [group = "", key = "DEFAULT"] = ref.split(".");
  return varColor(group, key);
}

type NameRow = { company_name: string | null };

/** Real names only: the longest on record, and one of ordinary length. */
async function loadRealNames(): Promise<{ longest: string | null; typical: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    // PostgREST cannot sort by length, so ask for names of at least N
    // characters (`_` matches exactly one) and step down until some exist.
    let longest: string | null = null;
    for (const min of [110, 90, 70, 50]) {
      const { data } = await supabase
        .from("suppliers")
        .select("company_name")
        .eq("is_published", true)
        .like("company_name", `${"_".repeat(min)}%`)
        .limit(50);
      const rows = (data ?? []) as NameRow[];
      const names = rows.map((r) => r.company_name).filter((n): n is string => Boolean(n));
      if (names.length > 0) {
        longest = names.reduce((a: string, b: string) => (b.length > a.length ? b : a));
        break;
      }
    }
    const { data: some } = await supabase
      .from("suppliers")
      .select("company_name")
      .eq("is_published", true)
      // Measured 18 Sep 2026: median name is 22 characters, nine in ten are under 34.
      .like("company_name", `${"_".repeat(20)}%`)
      .not("company_name", "like", `${"_".repeat(25)}%`)
      .limit(1);
    const typical = ((some ?? []) as NameRow[])[0]?.company_name ?? null;
    return { longest, typical };
  } catch {
    return { longest: null, typical: null };
  }
}

function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-4 border-t border-line pt-8">
      <div className="space-y-1">
        <h2 id={id} className="text-2xl font-semibold text-ink-strong">
          {title}
        </h2>
        {note ? <p className="max-w-prose text-base text-ink-muted">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default async function DesignSystemGallery() {
  if (process.env.NODE_ENV === "production") notFound();
  const role = await getServerRole();
  if (role !== "admin") notFound();

  const { longest, typical } = await loadRealNames();
  const sampleName = longest ?? typical;

  const results = contrastPairs.map((p) => {
    const ratio = contrastRatio(resolve(light, p.fg), resolve(light, p.bg));
    return { ...p, ratio, pass: ratio >= p.min };
  });
  const failures = results.filter((r) => !r.pass).length;

  return (
    <main className="mx-auto max-w-content space-y-10 px-4 py-8 sm:px-6 lg:py-12">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
          Dev only · Design rebuild · Direction locked 18 Sep 2026
        </p>
        <h1 className="text-4xl font-bold text-ink-strong">Tokens</h1>
        <p className="max-w-prose text-lg text-ink-muted">
          Every colour, size and shadow the new design is allowed to use. One family (Inter),
          light only for now, colours named by job so a dark set can be added later. Brand green
          is fixed; the rest of the shell is near-monochrome so colour is left for status.
        </p>
      </header>

      <Section
        id="direction"
        title="Direction"
        note="Locked in ds-rebuild-must-stay.md §9. Patterns taken from the references, never their brand."
      >
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-ink-strong">Type</dt>
            <dd className="text-ink-muted">Inter only. App body 14, table cells 13, captions 12. Headings semibold, tight tracking from 20 up.</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink-strong">Colour roles</dt>
            <dd className="text-ink-muted">Ink on white and off-white. Brand green for primary action, links and the active nav mark only. Status gets its own tint; sanction red is reserved.</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink-strong">Spacing</dt>
            <dd className="text-ink-muted tabular-nums">4px grid. Card padding {density.cardPadding}, panel padding {density.panelPadding}, page gutter {density.gutter} (16 on phones), sidebar {density.sidebar}.</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink-strong">Radius</dt>
            <dd className="text-ink-muted">5px on controls, badges and cards; 6px on panels and tables; 8px only on dialogs. Never 12 in the app.</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink-strong">Density</dt>
            <dd className="text-ink-muted tabular-nums">Table row {density.tableRow} (admin, directory) or {density.tableRowRelaxed} (buyer lists). Control {density.control}, primary {density.controlLarge}. Fact row {density.factRow}. Hairline dividers, no card shadows in lists.</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink-strong">References (Mobbin)</dt>
            <dd className="text-ink-muted">Shell: Vanta. Directory: Zendesk Reach. Profile: Attio. Tone: Midday.</dd>
          </div>
        </dl>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="overflow-hidden rounded-md border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line px-4 py-2 text-xs text-ink-subtle">
              <span>Table row · {density.tableRow}px</span>
              <span className="tabular-nums">1–25 of 10,266</span>
            </div>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{ height: density.tableRow }}
                className="flex items-center gap-3 border-b border-line-subtle px-4 text-sm last:border-b-0"
              >
                <span className="h-3 w-40 rounded-sm bg-skeleton" />
                <span className="ml-auto h-3 w-16 rounded-sm bg-skeleton" />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface p-4">
            <button
              type="button"
              style={{ height: density.controlLarge }}
              className="rounded bg-brand px-4 text-sm font-semibold text-brand-on hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 active:bg-brand-active"
            >
              Primary
            </button>
            <button
              type="button"
              style={{ height: density.control }}
              className="rounded border border-line-strong bg-surface px-3 text-sm font-medium text-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
            >
              Secondary
            </button>
            <a href="#direction" className="text-sm font-medium text-brand-ink underline underline-offset-2">
              Link
            </a>
          </div>
        </div>
      </Section>

      <Section
        id="tiers"
        title="Source rank"
        note="A neutral lightness ramp, darkest is most trusted. The order reads without a legend, does not rely on telling colours apart, and leaves colour free for status."
      >
        <ol className="flex flex-wrap gap-2">
          {tiers.map((t) => (
            <li
              key={t.rank}
              className={`inline-flex items-center gap-2 rounded px-2.5 py-1 text-sm font-medium ${TIER_CLASS[t.rank]}`}
            >
              <span className="tabular-nums font-semibold">{t.rank}</span>
              {t.label}
            </li>
          ))}
        </ol>
      </Section>

      <Section
        id="states"
        title="State colours"
        note="Colour samples for the states every piece must have. Each pairs a colour with an icon and a word, never colour alone. These are swatches, not the finished components."
      >
        <div
          role="alert"
          className="flex items-start gap-3 rounded-md bg-sanction px-4 py-3 text-sanction-on"
        >
          <Prohibit aria-hidden className="mt-0.5 size-5 shrink-0" weight="bold" />
          <p className="text-base font-semibold">
            Sanctioned — this red is reserved for sanctions and used for nothing else.
          </p>
        </div>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <li className="flex items-center gap-2 rounded border border-positive-line bg-positive-tint px-3 py-2 text-sm font-medium text-positive-ink">
            <SealCheck aria-hidden className="size-4 shrink-0" weight="fill" /> Verified
          </li>
          <li className="flex items-center gap-2 rounded border border-dashed border-quiet-line bg-quiet px-3 py-2 text-sm font-medium text-quiet-ink">
            <Question aria-hidden className="size-4 shrink-0" /> Unverified
          </li>
          <li className="flex items-center gap-2 rounded border border-caution-line bg-caution-tint px-3 py-2 text-sm font-medium text-caution-ink">
            <Warning aria-hidden className="size-4 shrink-0" weight="fill" /> Contradicted
          </li>
          <li className="flex items-center gap-2 rounded border border-positive-line bg-positive-tint px-3 py-2 text-sm font-medium text-positive-ink">
            <CheckCircle aria-hidden className="size-4 shrink-0" weight="fill" /> Valid
          </li>
          <li className="flex items-center gap-2 rounded border border-caution-line bg-caution-tint px-3 py-2 text-sm font-medium text-caution-ink">
            <WarningCircle aria-hidden className="size-4 shrink-0" weight="fill" /> Expired
          </li>
          <li className="locked-pattern flex items-center gap-2 rounded border border-locked-line px-3 py-2 text-sm font-medium text-locked-ink">
            <Lock aria-hidden className="size-4 shrink-0" weight="fill" /> Locked
          </li>
          <li className="flex items-center gap-2 rounded border border-dashed border-quiet-line bg-quiet px-3 py-2 text-sm text-quiet-ink">
            Empty — no data yet
          </li>
          <li className="flex items-center gap-2 rounded border border-danger-line bg-danger-tint px-3 py-2 text-sm font-medium text-danger-ink">
            <XCircle aria-hidden className="size-4 shrink-0" weight="fill" /> Error
          </li>
          <li className="rounded border border-line bg-surface px-3 py-2" aria-label="Loading">
            <span className="block h-5 w-2/3 animate-pulse rounded-sm bg-skeleton" />
          </li>
        </ul>
      </Section>

      <Section
        id="type"
        title="Type scale"
        note={
          sampleName
            ? `Set in the longest live company name we could read (${sampleName.length} characters), so wrapping shows at every size. Suffixes are never cut off.`
            : "No live company name could be read, so the samples show the size only. Nothing is invented."
        }
      >
        <div className="space-y-5 rounded-md border border-line bg-surface p-4 sm:p-6">
          {Object.entries(fontSize).map(([name, [size, meta]]) => (
            <div key={name} className="space-y-1">
              <p className="text-xs tabular-nums text-ink-subtle">
                text-{name} · {size} / {meta.lineHeight}
              </p>
              <p className={`${SIZE_CLASS[name]} break-words font-semibold text-ink-strong`}>
                {sampleName ?? `text-${name}`}
              </p>
            </div>
          ))}
        </div>
        {typical && typical !== sampleName ? (
          <p className="text-base text-ink">
            <span className="text-ink-subtle">Ordinary length: </span>
            {typical}
          </p>
        ) : null}
        <p className="text-base tabular-nums text-ink">
          <span className="text-ink-subtle">Tabular figures: </span>
          0123456789 · 10,922 · 1,111.11 · 88.0%
        </p>
      </Section>

      <Section
        id="colour"
        title="Colour roles"
        note="Named by job, not by hue. These are the only colour classes that exist: bg-, text-, border- and ring- followed by the name shown."
      >
        <div className="space-y-6">
          {Object.entries(light).map(([group, keys]) => (
            <div key={group} className="space-y-2">
              <h3 className="text-sm font-semibold text-ink-strong">{group}</h3>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {Object.entries(keys as Record<string, string>).map(([key, hex]) => (
                  <li key={key} className="overflow-hidden rounded border border-line bg-surface">
                    <span
                      className="block h-12 border-b border-line"
                      style={{ backgroundColor: varColor(group, key) }}
                    />
                    <span className="block px-2 py-1.5">
                      <span className="block break-words text-xs font-medium text-ink-strong">
                        {key === "DEFAULT" ? group : `${group}-${key}`}
                      </span>
                      <span className="block text-xs tabular-nums text-ink-subtle">{hex}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="contrast"
        title="Contrast check"
        note={`${results.length} allowed text and outline pairs, measured from the token values. ${
          failures === 0 ? "All pass." : `${failures} FAIL.`
        } The same list runs in the test suite, so a failing pair blocks the build.`}
      >
        <div className="overflow-x-auto rounded-md border border-line bg-surface">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="border-b border-line text-xs text-ink-subtle">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Sample</th>
                <th scope="col" className="px-3 py-2 font-medium">Pair</th>
                <th scope="col" className="px-3 py-2 font-medium">Used for</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Ratio</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Needs</th>
                <th scope="col" className="px-3 py-2 font-medium">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {results.map((r) => (
                <tr key={`${r.fg}|${r.bg}`}>
                  <td className="px-3 py-2">
                    <span
                      className="inline-block rounded-sm border border-line px-2 py-0.5 font-semibold"
                      style={{ color: refColor(r.fg), backgroundColor: refColor(r.bg) }}
                    >
                      Aa 123
                    </span>
                  </td>
                  <td className="px-3 py-2 text-ink">
                    {r.fg} <span className="text-ink-subtle">on</span> {r.bg}
                  </td>
                  <td className="px-3 py-2 text-ink-muted">{r.use}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-strong">
                    {r.ratio.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-muted">{r.min}</td>
                  <td className="px-3 py-2">
                    {r.pass ? (
                      <span className="inline-flex items-center gap-1 font-medium text-positive-ink">
                        <CheckCircle aria-hidden className="size-4" weight="fill" /> Pass
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-medium text-danger-ink">
                        <XCircle aria-hidden className="size-4" weight="fill" /> Fail
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="shape" title="Corners, shadows, timing">
        <ul className="flex flex-wrap gap-3">
          {Object.entries(borderRadius).map(([name, value]) => (
            <li key={name} className="space-y-1 text-center">
              <span className={`block size-16 border border-line-strong bg-surface ${RADIUS_CLASS[name]}`} />
              <span className="block text-xs text-ink-subtle">
                {name === "DEFAULT" ? "rounded" : `rounded-${name}`}
                <br />
                {value}
              </span>
            </li>
          ))}
        </ul>
        <ul className="flex flex-wrap gap-5 pt-2">
          {Object.keys(boxShadow).map((name) => (
            <li key={name} className="space-y-2 text-center">
              <span className={`block h-16 w-24 rounded-md bg-surface ${SHADOW_CLASS[name]}`} />
              <span className="block text-xs text-ink-subtle">shadow-{name}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm tabular-nums text-ink-muted">
          Timing:{" "}
          {Object.entries(transitionDuration)
            .map(([k, v]) => `${k === "DEFAULT" ? "default" : k} ${v}`)
            .join(" · ")}
          . All motion switches off when the device asks for reduced motion.
        </p>
      </Section>
    </main>
  );
}
