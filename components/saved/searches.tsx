"use client";

// The saved searches (Paper `10 · Saved · saved searches`, `11 · Saved · searches`): each is its
// name, its filters in words, how many suppliers it finds (a remembered count, and the row says
// when it was taken), Run search, and a menu with Delete. Delete asks first (a dialog; a sheet on a
// phone) because a deleted search cannot be brought back. Paper's "Email me new matches" switch is
// not here: no alert is stored or sent, so a switch would promise an email nobody sends.

import { DotsThree } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink, Dialog, IconButton, Menu, MenuItem, Sheet } from "@/components/kit";
import { useIsPhone } from "@/components/kit/use-phone";
import type { SearchItem } from "./words";

function useDelete(item: SearchItem) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/saved-searches?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Could not delete it. Nothing was removed. Try again.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not delete it. Nothing was removed. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return { open, setOpen, busy, error, run };
}

function DeleteConfirm({ item, d }: { item: SearchItem; d: ReturnType<typeof useDelete> }) {
  const phone = useIsPhone();
  const title = `Delete “${item.name}”?`;
  const body = (
    <>
      <p>It is removed from your saved searches and cannot be brought back. Run it again from search to save it anew.</p>
      {d.error ? (
        <p role="alert" className="pt-2 text-sm text-danger">
          {d.error}
        </p>
      ) : null}
    </>
  );
  return phone ? (
    <Sheet
      open={d.open}
      onOpenChange={d.setOpen}
      kind="confirm"
      title={title}
      footer={
        <>
          <Button kind="danger" size="touch" full loading={d.busy} loadingLabel="Deleting" onClick={d.run}>
            Delete search
          </Button>
          <Button kind="secondary" size="touch" full data-autofocus onClick={() => d.setOpen(false)}>
            Keep search
          </Button>
        </>
      }
    >
      {body}
    </Sheet>
  ) : (
    <Dialog
      open={d.open}
      onOpenChange={d.setOpen}
      kind="confirm"
      title={title}
      footer={
        <>
          <Button kind="secondary" data-autofocus onClick={() => d.setOpen(false)}>
            Keep search
          </Button>
          <Button kind="danger" loading={d.busy} loadingLabel="Deleting" onClick={d.run}>
            Delete search
          </Button>
        </>
      }
    >
      {body}
    </Dialog>
  );
}

function RowMenu({ item, d }: { item: SearchItem; d: ReturnType<typeof useDelete> }) {
  return (
    <Menu align="end" trigger={<IconButton icon={DotsThree} label={`More actions for ${item.name}`} kind="quiet" className="max-md:size-11" />}>
      <MenuItem href={item.runHref}>Run search</MenuItem>
      <MenuItem onSelect={() => d.setOpen(true)}>Delete search</MenuItem>
    </Menu>
  );
}

/** What it finds: "101" over "suppliers today", or the count's age. */
function Count({ item }: { item: SearchItem }) {
  return (
    <div className="flex w-[140px] shrink-0 flex-col items-end max-md:w-auto">
      {item.count ? <p className="text-lg font-semibold tabular-nums text-ink">{item.count}</p> : <p className="text-lg font-semibold text-ink-3">—</p>}
      <p className="text-xs text-ink-3">{item.countWords}</p>
    </div>
  );
}

function SearchRow({ item }: { item: SearchItem }) {
  const d = useDelete(item);
  return (
    <li className="border-b border-line">
      <div className="flex items-center gap-6 py-4 max-md:hidden">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-md font-semibold text-ink [overflow-wrap:anywhere]">{item.name}</p>
          <p className="text-sm text-ink-2">{item.filters}</p>
        </div>
        <Count item={item} />
        <div className="flex shrink-0 items-center gap-2">
          <ButtonLink href={item.runHref} prefetch={false}>
            Run search
          </ButtonLink>
          <RowMenu item={item} d={d} />
        </div>
      </div>
      <div className="flex flex-col gap-2 py-4 md:hidden">
        <div className="flex items-start justify-between gap-3">
          <p className="text-md font-semibold text-ink [overflow-wrap:anywhere]">{item.name}</p>
          <RowMenu item={item} d={d} />
        </div>
        <p className="text-base text-ink-2">{[item.filters, item.count ? `${item.count} ${item.countWords}` : item.countWords].join(" · ")}</p>
        <ButtonLink href={item.runHref} prefetch={false} size="touch" full>
          Run search
        </ButtonLink>
      </div>
      <DeleteConfirm item={item} d={d} />
    </li>
  );
}

export function SearchList({ items }: { items: readonly SearchItem[] }) {
  return (
    <ul aria-label="Saved searches" className="px-6 py-2 max-md:px-4">
      {items.map((i) => (
        <SearchRow key={i.id} item={i} />
      ))}
    </ul>
  );
}
