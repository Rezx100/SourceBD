import type { ProfileEpbHscode } from "@/lib/epb-hscodes";
import { epbRegistryVerifyHref } from "@/lib/epb-hscodes";

/** Same control as ProfileActionLink — kept here so HS href tests stay light. */
export function EpbOpenAnchor({
  href,
  children = "Open source",
}: {
  href: string | null;
  children?: string;
}) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-8 items-center rounded-md px-2 py-1 text-[13px] font-semibold text-brand-forest underline decoration-brand-forest/30 underline-offset-2 hover:bg-brand-forest-soft"
    >
      {children}
    </a>
  );
}

export function EpbHscodesMarkup({
  hscodes,
}: {
  hscodes: readonly ProfileEpbHscode[];
}) {
  if (hscodes.length === 0) return null;
  return (
    <div data-epb-hscodes="">
      {hscodes.map((row) => (
        <div key={row.code} data-epb-hscode={row.code}>
          <span>{row.code}</span>
          {row.description ? <span>{row.description}</span> : null}
          <EpbOpenAnchor href={row.source_url} />
        </div>
      ))}
    </div>
  );
}

export function EpbHscodesUnavailable() {
  return (
    <p
      data-epb-hscodes-error=""
      className="text-[14px] leading-6 text-neutral-600"
    >
      EPB export products could not load just now.
    </p>
  );
}

export function EpbRegistryOpenMarkup({
  sourceUrl,
}: {
  sourceUrl: string | null;
}) {
  return <EpbOpenAnchor href={epbRegistryVerifyHref(sourceUrl)} />;
}
