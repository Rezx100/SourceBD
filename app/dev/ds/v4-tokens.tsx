// /dev/ds, first section: SourceBD v4's tokens under Paper's names, drawn from
// lib/design/tokens.ts through the classes tailwind.config.ts serves (B0,
// 4 Oct 2026). Its own file so a test can render it (v4-tokens.test.ts).

import {
  borderRadius,
  containers,
  cssVarName,
  fontSize,
  screens,
  spacing,
  splitColorName,
  v4Alpha,
  v4CertAliases,
  v4Colors,
} from "@/lib/design/tokens";

/** Paper's v4 tokens, under Paper's names, as the config serves them (B0). */
const V4_TYPE = ["xs", "sm", "base", "md", "lg", "xl", "2xl", "3xl", "display-3", "display-2", "display-1"];
const V4_RADIUS = ["sm", "md", "lg", "full"] as const;

// Literal class names, so Tailwind's scan of this file generates each one.
const SIZE_CLASS: Record<string, string> = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
  md: "text-md",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
  "3xl": "text-3xl",
  "display-3": "text-display-3",
  "display-2": "text-display-2",
  "display-1": "text-display-1",
};
const RADIUS_CLASS: Record<(typeof V4_RADIUS)[number], string> = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  full: "rounded-full",
};

export function V4Tokens() {
  const colours: [name: string, value: string, note?: string][] = [
    ...Object.entries(v4Colors).map(([name, hex]): [string, string] => [name, hex]),
    ...Object.entries(v4CertAliases).map(([name, target]): [string, string, string] => [name, v4Colors[target], `= ${target}`]),
    ...Object.entries(v4Alpha).map(([name, a]): [string, string, string] => [name, v4Colors[a.color], `${a.color} at ${a.alpha * 100}%`]),
  ];
  return (
    <div className="space-y-6">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {colours.map(([name, hex, note]) => {
          const [group, key] = splitColorName(name);
          const alpha = name in v4Alpha ? v4Alpha[name as keyof typeof v4Alpha].alpha : 1;
          return (
            <li key={name} className="overflow-hidden rounded-md border border-line bg-surface">
              <span
                className="block h-12 border-b border-line"
                style={{ backgroundColor: `rgb(var(${cssVarName(group, key)}) / ${alpha})` }}
              />
              <span className="block px-2 py-1.5">
                <span className="block break-words text-xs font-medium text-ink">{name}</span>
                <span className="block text-xs tabular-nums text-ink-3">
                  {hex}
                  {note ? ` · ${note}` : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
        {V4_TYPE.map((name) => {
          const [size, meta] = fontSize[name]!;
          return (
            <div key={name} className="flex flex-wrap items-baseline gap-x-4">
              <span className="w-[168px] shrink-0 font-mono text-xs text-ink-3">
                text-{name} · {size}
                {meta.lineHeight ? ` / ${meta.lineHeight}` : ""}
              </span>
              <span className={`${SIZE_CLASS[name]} ${meta.lineHeight ? "" : "leading-tight "}font-sans font-semibold text-ink`}>Knitwear exporters in Gazipur</span>
            </div>
          );
        })}
      </div>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-ink">Spacing (named)</dt>
          <dd className="font-mono text-xs text-ink-3">
            {Object.entries(spacing).map(([k, v]) => `${k} ${v}`).join(" · ")}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">Containers</dt>
          <dd className="font-mono text-xs text-ink-3">
            {Object.entries(containers).map(([k, v]) => `${k} ${v}`).join(" · ")}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">Breakpoints</dt>
          <dd className="font-mono text-xs text-ink-3">
            {Object.entries(screens).map(([k, v]) => `${k} ${v}`).join(" · ")}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">Radius</dt>
          <dd className="flex flex-wrap gap-3">
            {V4_RADIUS.map((k) => (
              <span key={k} className={`${RADIUS_CLASS[k]} border border-line-strong bg-subtle px-3 py-2 font-mono text-xs text-ink-2`}>
                {k} {borderRadius[k]}
              </span>
            ))}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">Shadows (added in code)</dt>
          <dd className="flex flex-wrap gap-4 pt-2">
            <span className="rounded-lg bg-surface px-3 py-2 font-mono text-xs text-ink-2 shadow-menu">menu</span>
            <span className="rounded-lg bg-surface px-3 py-2 font-mono text-xs text-ink-2 shadow-dialog">dialog</span>
          </dd>
        </div>
      </dl>
    </div>
  );
}
