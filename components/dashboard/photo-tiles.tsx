// HS-keyed photo tiles (REZ-A, handoff §6): the 132px strip tile, the 28px
// table thumb, the six-up grid, and the dashed quiet slot a record with no
// export lines shows. A heading without a photo shows its code on the sunken
// ground with "no photo yet" — nothing is substituted. Every photo is
// captioned as illustrative.

/* eslint-disable @next/next/no-img-element -- static catalogue files under /public, sized by the tile */
import type { PhotoTileModel } from "@/lib/dashboard/hs-photos";
import { cn } from "@/lib/utils";
import { Icon } from "./icons";
import { Caption, Code } from "./type";

export const PHOTO_NOTE = "Illustrative photos, one per HS heading · rarest lines first";
/** The caption handoff §6 settled on, carried by every single photo. */
export const PHOTO_CAPTION = "Illustrative photo, keyed to the HS code";

/** The image inside a tile, zoomed the way the artifact crops it. */
function Photo({ src, className }: { src: string; className?: string }) {
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn("size-full origin-[50%_46%] scale-[1.32] object-cover", className)}
    />
  );
}

/** `.pt`: a 132px tile with `HS 6105` and the short heading under it. */
export function PhotoTile({ tile, fluid = false }: { tile: PhotoTileModel; fluid?: boolean }) {
  return (
    <div className={cn("shrink-0", fluid ? "w-auto" : "w-[132px]")}>
      <div
        className={cn(
          "overflow-hidden rounded-sm border border-line-subtle bg-surface-sunken",
          fluid ? "aspect-square w-auto" : "size-[132px]",
          !tile.src && "flex flex-col items-center justify-center gap-0.5 text-ink-subtle",
        )}
      >
        {tile.src ? (
          <Photo src={tile.src} />
        ) : (
          <>
            <Code className="text-title text-ink-muted">{tile.hs}</Code>
            <Caption>no photo yet</Caption>
          </>
        )}
      </div>
      <div className="px-0.5 pt-[5px]">
        <Code className="block text-xs text-ink-muted">HS {tile.hs}</Code>
        <span className="block whitespace-nowrap text-xs text-ink">{tile.short}</span>
      </div>
    </div>
  );
}

/** `.strip`: six rarest tiles, the "+N ›" pill, the illustrative note. */
export function PhotoStrip({
  tiles,
  totalLines,
  registerChecked,
  readDate,
  unknown = false,
}: {
  tiles: readonly PhotoTileModel[];
  totalLines: number;
  /** Shown when there are no lines: the register that was checked. */
  registerChecked?: string;
  /** The register's read date for this supplier; null when it holds no record. */
  readDate?: string | null;
  /** The lines could not be read: say so, never "no lines". */
  unknown?: boolean;
}) {
  if (tiles.length === 0) {
    return (
      <div className="relative min-w-0 flex-1">
        <div className="flex gap-2 overflow-hidden">
          <NoLinesSlot registerChecked={registerChecked ?? "EPB"} readDate={readDate ?? null} unknown={unknown} />
        </div>
      </div>
    );
  }
  const more = Math.max(0, totalLines - tiles.length);
  return (
    <div className="relative min-w-0 flex-1">
      <div className="flex gap-2 overflow-hidden">
        {tiles.map((t) => (
          <PhotoTile key={t.hs} tile={t} />
        ))}
      </div>
      {more > 0 ? (
        <button
          type="button"
          aria-label={`All ${totalLines} lines`}
          // A real button, so its outline is a control outline (accessibility,
          // cycle 19, BLOCKING F4 — same reasoning as sheet.tsx's report links).
          className="absolute -right-1 top-[50px] inline-flex h-8 items-center gap-0.5 rounded-full border border-line-strong bg-surface pl-2.5 pr-2 text-sm font-medium text-ink shadow-sm"
        >
          +{more} <Icon name="chev-r" />
        </button>
      ) : null}
      <div className="flex justify-end pt-1">
        <Caption>{PHOTO_NOTE}</Caption>
      </div>
    </div>
  );
}

/**
 * The dashed quiet slot: "No export lines on file · EPB · read <date>" when
 * the register holds a record without lines, "no EPB record" when it holds
 * none, "could not be read" when the RPC failed.
 */
export function NoLinesSlot({ registerChecked, readDate, unknown = false }: { registerChecked: string; readDate: string | null; unknown?: boolean }) {
  return (
    <div className="w-[132px] shrink-0">
      <div className="flex size-[132px] flex-col items-center justify-center gap-1 rounded-sm border border-dashed border-quiet-line bg-surface p-3 text-center text-quiet-ink">
        <Icon name="image" />
        <span className="text-xs">{unknown ? "Export lines could not be read" : "No export lines on file"}</span>
      </div>
      <div className="px-0.5 pt-[5px]">
        <Code className="block text-xs text-ink-muted">{registerChecked}</Code>
        <span className="block whitespace-nowrap text-xs text-ink-subtle">
          {unknown ? "try again later" : readDate ? `read ${readDate}` : `no ${registerChecked} record`}
        </span>
      </div>
    </div>
  );
}

/** `.pgrid`: the sheet's six-up grid. */
export function PhotoGrid({ tiles }: { tiles: readonly PhotoTileModel[] }) {
  return (
    <div className="grid grid-cols-6 gap-2">
      {tiles.map((t) => (
        <PhotoTile key={t.hs} tile={t} fluid />
      ))}
    </div>
  );
}

/** `.thumbs`: 28px thumbs in a table row with "+N". */
export function PhotoThumbs({ tiles, totalLines }: { tiles: readonly PhotoTileModel[]; totalLines: number }) {
  const more = Math.max(0, totalLines - tiles.length);
  return (
    <span className="inline-flex items-center gap-1">
      {tiles.map((t) => (
        // `title` alone on a plain span is not announced; the label is what a
        // screen reader reads for this whole column.
        <span
          key={t.hs}
          role="img"
          aria-label={`HS ${t.hs} · ${t.short}`}
          className={cn(
            "size-7 overflow-hidden rounded-xs border border-line-subtle bg-surface-sunken",
            !t.thumb && "grid place-items-center font-mono text-[7px] text-ink-subtle",
          )}
          title={`HS ${t.hs} · ${t.short}`}
        >
          {t.thumb ? <Photo src={t.thumb} /> : t.hs}
        </span>
      ))}
      {more > 0 ? <span className="ml-1 text-xs text-ink-subtle">+{more}</span> : null}
    </span>
  );
}
